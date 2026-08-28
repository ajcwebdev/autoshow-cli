import { describe,expect,test } from 'bun:test'
import { join } from 'node:path'
import { readSingleManifestProviderState } from '~/cli/commands/process-steps/pipeline-manifest'
import { ASYNC_STT_PROGRESS_METADATA_KEY,createSttProviderProgressLifecycle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-provider-progress'
import { runHappyScribeStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/happyscribe/run-happyscribe-stt'
import { runSonioxStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/soniox/run-soniox-stt'
import type { PipelineProviderStatus,Step2Metadata,Step2RuntimeMetadata,SttTarget } from '~/types'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'
import { installMockFetch,jsonResponse,setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['HAPPYSCRIBE_API_KEY', 'SONIOX_API_KEY'],
  tempPrefix: 'autoshow-async-stt-resume-',
  restoreBunSleep: true,
  beforeEachExtra: () => {
    installMockFetch(() => {
      throw new Error('Unexpected unmocked provider request')
    })
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
  }
})

const makeTempDir = tempDirs.make

const seedAsyncProviderManifest = async (
  outputDir: string,
  target: Pick<SttTarget, 'service' | 'model'>,
  options: {
    status?: PipelineProviderStatus | undefined
    runtime?: Step2RuntimeMetadata | undefined
    billing?: Step2Metadata['billing'] | undefined
  } = {}
) => {
  const progressMetadata = options.runtime
    ? {
        transcriptionService: target.service,
        transcriptionModel: target.model,
        processingTime: 0,
        tokenCount: 0,
        timings: {},
        runtime: options.runtime,
        ...(options.billing ? { billing: options.billing } : {})
      }
    : undefined
  await writeSingleManifestFixture(outputDir, 'extract', {
    completionStatus: 'incomplete',
    requestedProviders: [{ service: target.service, model: target.model, local: false }],
    providerStates: [{
      service: target.service,
      model: target.model,
      local: false,
      artifactDir: '.',
      status: options.status ?? 'running',
      attempts: 1,
      ...(progressMetadata
        ? { metadata: { [ASYNC_STT_PROGRESS_METADATA_KEY]: { whole: progressMetadata } } }
        : {})
    }],
    missingProviders: [{ service: target.service, model: target.model, local: false }]
  }, { extractRoute: 'media' })
  return createSttProviderProgressLifecycle({ rootDir: outputDir, artifactDir: outputDir, target })
}

const readProvider = async (
  outputDir: string,
  target: Pick<SttTarget, 'service' | 'model'>
) => await readSingleManifestProviderState(outputDir, {
  service: target.service,
  model: target.model,
  artifactDir: outputDir
})

describe('async STT resume contracts', () => {
  test('Happy Scribe keeps the paid order resumable when export retrieval fails', async () => {
    const outputDir = await makeTempDir('autoshow-happyscribe-export-resume-')
    const audioPath = join(outputDir, 'audio.mp3')
    await Bun.write(audioPath, 'audio')
    process.env['HAPPYSCRIBE_API_KEY'] = 'test-happyscribe-key'
    const target = { service: 'happyscribe', model: 'auto' } as const
    const lifecycle = await seedAsyncProviderManifest(outputDir, target)

    let orderCreates = 0
    let exportCreates = 0
    let downloadAttempts = 0
    installMockFetch((call) => {
      const url = new URL(call.url)
      const method = call.method

      if (url.pathname.endsWith('/organizations')) {
        return jsonResponse({ organizations: [{ id: 'organization-1', currency: 'usd' }] })
      }
      if (url.pathname.endsWith('/uploads/new')) {
        return jsonResponse({ signedUrl: 'https://upload.mock/audio' })
      }
      if (url.hostname === 'upload.mock' && method === 'PUT') {
        return new Response(null, { status: 200 })
      }
      if (url.pathname.endsWith('/orders') && method === 'POST') {
        orderCreates += 1
        return jsonResponse({ id: 'order-1', state: 'submitted' })
      }
      if (url.pathname.endsWith('/orders/order-1')) {
        return jsonResponse({
          id: 'order-1',
          state: 'fulfilled',
          transcriptions: [{ uuid: 'transcription-1', state: 'automatic_done' }]
        })
      }
      if (url.pathname.endsWith('/transcriptions/transcription-1')) {
        return jsonResponse({ id: 'transcription-1', state: 'automatic_done' })
      }
      if (url.pathname.endsWith('/exports') && method === 'POST') {
        exportCreates += 1
        return jsonResponse({ id: `export-${exportCreates}`, state: 'pending' })
      }
      if (url.pathname.endsWith(`/exports/export-${exportCreates}`)) {
        return jsonResponse({
          id: `export-${exportCreates}`,
          state: 'ready',
          download_link: `https://download.mock/export-${exportCreates}`
        })
      }
      if (url.hostname === 'download.mock') {
        downloadAttempts += 1
        if (downloadAttempts <= 2) {
          return jsonResponse({ error: 'export temporarily unavailable' }, { status: 503 })
        }
        return jsonResponse({
          transcript: 'hello from resumed export',
          segments: [{ text: 'hello from resumed export', start_seconds: 0, end_seconds: 1 }]
        })
      }

      throw new Error(`Unexpected Happy Scribe request: ${method} ${url.toString()}`)
    })

    await expect(runHappyScribeStt(audioPath, outputDir, {
      model: 'auto',
      segmentOffsetMinutes: 0,
      lifecycle
    })).rejects.toThrow('Happy Scribe transcript download failed')

    const failedProvider = await readProvider(outputDir, target)
    expect(failedProvider?.metadata[ASYNC_STT_PROGRESS_METADATA_KEY]).toMatchObject({ whole: { runtime: {
      stage: 'polling',
      remoteJobId: 'order-1'
    } } })
    const resumed = await runHappyScribeStt(audioPath, outputDir, {
      model: 'auto',
      segmentOffsetMinutes: 0,
      lifecycle
    })

    expect(resumed.result.text).toBe('hello from resumed export')
    expect(resumed.metadata.runtime).toMatchObject({
      mode: 'resumed',
      stage: 'completed',
      remoteJobId: 'order-1'
    })
    expect(orderCreates).toBe(1)
    expect(exportCreates).toBe(2)
  })

  test('Soniox retains remote resources while canonical polling progress remains retryable', async () => {
    const outputDir = await makeTempDir('autoshow-soniox-poll-resume-')
    process.env['SONIOX_API_KEY'] = 'test-soniox-key'
    const target = { service: 'soniox', model: 'stt-async-v5' } as const
    const lifecycle = await seedAsyncProviderManifest(outputDir, target, {
      status: 'failed',
      runtime: {
        mode: 'fresh',
        stage: 'polling',
        remoteJobId: 'transcription-1',
        remoteAssetId: 'file-1'
      }
    })

    const calls = installMockFetch(() => {
      return jsonResponse({ id: 'transcription-1', status: 'processing' })
    })

    await expect(runSonioxStt(join(outputDir, 'audio.mp3'), outputDir, {
      model: 'stt-async-v5',
      segmentOffsetMinutes: 0,
      lifecycle
    })).rejects.toThrow('is still pending after 5 resume status checks')

    expect(calls.filter((call) => call.method === 'GET')).toHaveLength(5)
    expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(0)
    const provider = await readProvider(outputDir, target)
    expect(provider?.metadata[ASYNC_STT_PROGRESS_METADATA_KEY]).toMatchObject({ whole: { runtime: {
      stage: 'polling',
      remoteJobId: 'transcription-1',
      remoteAssetId: 'file-1'
    } } })
  })

  test('Soniox deletes remote resources after a terminal provider failure', async () => {
    const outputDir = await makeTempDir('autoshow-soniox-terminal-cleanup-')
    process.env['SONIOX_API_KEY'] = 'test-soniox-key'
    const target = { service: 'soniox', model: 'stt-async-v5' } as const
    const lifecycle = await seedAsyncProviderManifest(outputDir, target, {
      status: 'failed',
      runtime: {
        mode: 'fresh',
        stage: 'polling',
        remoteJobId: 'transcription-1',
        remoteAssetId: 'file-1'
      }
    })

    const calls = installMockFetch((call) => {
      if (call.method === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      return jsonResponse({
        id: 'transcription-1',
        status: 'error',
        error_message: 'provider rejected the audio'
      })
    })

    await expect(runSonioxStt(join(outputDir, 'audio.mp3'), outputDir, {
      model: 'stt-async-v5',
      segmentOffsetMinutes: 0,
      lifecycle
    })).rejects.toThrow('Soniox transcription failed: provider rejected the audio')

    expect(calls.filter((call) => call.method === 'DELETE').map((call) => new URL(call.url).pathname).sort()).toEqual([
      '/v1/files/file-1',
      '/v1/transcriptions/transcription-1'
    ])
    const provider = await readProvider(outputDir, target)
    expect(provider?.metadata[ASYNC_STT_PROGRESS_METADATA_KEY]).toMatchObject({ whole: { runtime: {
      stage: 'cleanup-complete',
      remoteJobId: 'transcription-1',
      remoteAssetId: 'file-1',
      cleanup: {
        remoteJobDeleted: true,
        remoteAssetDeleted: true
      }
    } } })
  })
})
