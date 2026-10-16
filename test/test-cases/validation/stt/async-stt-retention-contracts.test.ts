import { describe,expect,test } from 'bun:test'
import { join } from 'node:path'
import { readSingleManifestProviderState } from '~/cli/commands/command-shared/pipeline-manifest'
import { ASYNC_STT_PROGRESS_METADATA_KEY } from '~/cli/commands/stt/stt-provider-progress'
import { runSonioxStt } from '~/cli/commands/stt/diarization/soniox/run-soniox-stt'
import type { SttTarget } from '~/types'
import { installMockFetch,jsonResponse,setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { seedAsyncProviderManifest } from '../../../test-utils/async-stt-provider-manifest-fixture'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['SONIOX_API_KEY'],
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


const readProvider = async (
  outputDir: string,
  target: Pick<SttTarget, 'service' | 'model'>
) => await readSingleManifestProviderState(outputDir, {
  service: target.service,
  model: target.model,
  artifactDir: outputDir
})

describe('async STT resume contracts', () => {

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
