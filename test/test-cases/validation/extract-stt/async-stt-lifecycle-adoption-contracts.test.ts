import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { readSingleManifestProviderState } from '~/cli/commands/process-steps/pipeline-manifest'
import { runAssemblyAiTranscribe } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/assemblyai/run-assemblyai-stt'
import { runGladiaStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/gladia/run-gladia-stt'
import { runSonioxStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/soniox/run-soniox-stt'
import { ASYNC_STT_PROGRESS_METADATA_KEY, createSttProviderProgressLifecycle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-provider-progress'
import type { AsyncSttLifecycleHooks, Step2Metadata, SttTarget, TranscriptionResult } from '~/types'
import { expectProviderHttpError, installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['ASSEMBLYAI_API_KEY', 'GLADIA_API_KEY', 'SONIOX_API_KEY'],
  tempPrefix: 'autoshow-async-stt-adoption-',
  restoreBunSleep: true,
  beforeEachExtra: () => {
    installMockFetch(() => {
      throw new Error('Unexpected unmocked provider request')
    })
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
  }
})

const seedAsyncProviderManifest = async (
  outputDir: string,
  target: Pick<SttTarget, 'service' | 'model'>
): Promise<Pick<AsyncSttLifecycleHooks, 'readProgressMetadata' | 'writeProgressMetadata'>> => {
  await writeSingleManifestFixture(outputDir, 'extract', {
    completionStatus: 'incomplete',
    requestedProviders: [{ service: target.service, model: target.model, local: false }],
    providerStates: [{
      service: target.service,
      model: target.model,
      local: false,
      artifactDir: '.',
      status: 'running',
      attempts: 1
    }],
    missingProviders: [{ service: target.service, model: target.model, local: false }]
  }, { extractRoute: 'media' })

  return createSttProviderProgressLifecycle({ rootDir: outputDir, artifactDir: outputDir, target })
}

const expectLifecycleArtifacts = async (
  outputDir: string,
  actual: { result: TranscriptionResult, metadata: Step2Metadata },
  expected: {
    service: Step2Metadata['transcriptionService']
    model: string
    text: string
    speaker: string
    remoteJobId: string
    remoteAssetId?: string | undefined
    remoteAssetUrl?: string | undefined
  },
  target: Pick<SttTarget, 'service' | 'model'>
): Promise<void> => {
  expect(actual.result).toEqual({
    text: expected.text,
    segments: [{
      start: '00:00:00.000',
      end: '00:00:01.000',
      text: expected.text,
      speaker: expected.speaker
    }],
    evidence: expect.any(Object)
  })
  expect(await Bun.file(join(outputDir, 'transcription.txt')).text()).toBe(
    `[00:00:00.000] [${expected.speaker}] ${expected.text}`
  )
  expect(actual.metadata).toMatchObject({
    transcriptionService: expected.service,
    transcriptionModel: expected.model,
    tokenCount: expected.text.split(' ').length,
    runtime: {
      mode: 'fresh',
      remoteJobId: expected.remoteJobId,
      ...(expected.remoteAssetId ? { remoteAssetId: expected.remoteAssetId } : {}),
      ...(expected.remoteAssetUrl ? { remoteAssetUrl: expected.remoteAssetUrl } : {})
    }
  })

  const provider = await readSingleManifestProviderState(outputDir, {
    service: target.service,
    model: target.model,
    artifactDir: outputDir
  })
  expect(provider?.metadata[ASYNC_STT_PROGRESS_METADATA_KEY]).toMatchObject({ whole: { runtime: {
    mode: 'fresh',
    stage: 'polling',
    remoteJobId: expected.remoteJobId,
    ...(expected.remoteAssetId ? { remoteAssetId: expected.remoteAssetId } : {}),
    ...(expected.remoteAssetUrl ? { remoteAssetUrl: expected.remoteAssetUrl } : {})
  } } })
}

describe('async STT lifecycle adoption contracts', () => {
  test('AssemblyAI keeps its hand-rolled upload validation and provider stage', async () => {
    const outputDir = await tempDirs.make()
    const audioPath = join(outputDir, 'audio.mp3')
    await Bun.write(audioPath, 'audio')
    process.env['ASSEMBLYAI_API_KEY'] = 'test-assemblyai-key'
    installMockFetch(() => jsonResponse({}))

    await expectProviderHttpError(async () => await runAssemblyAiTranscribe(audioPath, outputDir, {
      model: 'universal-2',
      segmentOffsetMinutes: 0
    }), {
      kind: 'validation',
      stage: 'stt:assemblyai',
      messageContains: 'AssemblyAI upload response missing upload_url'
    })
  })

  test('AssemblyAI keeps its hand-rolled creation validation and provider stage', async () => {
    const outputDir = await tempDirs.make()
    const audioPath = join(outputDir, 'audio.mp3')
    await Bun.write(audioPath, 'audio')
    process.env['ASSEMBLYAI_API_KEY'] = 'test-assemblyai-key'
    installMockFetch((call) => new URL(call.url).pathname === '/v2/upload'
      ? jsonResponse({ upload_url: 'https://cdn.assemblyai.test/audio-1' })
      : jsonResponse({}))

    await expectProviderHttpError(async () => await runAssemblyAiTranscribe(audioPath, outputDir, {
      model: 'universal-2',
      segmentOffsetMinutes: 0
    }), {
      kind: 'validation',
      stage: 'stt:assemblyai',
      messageContains: 'AssemblyAI transcript creation response missing id'
    })
  })

  test('AssemblyAI preserves request, result, transcript, and canonical progress shapes', async () => {
    const outputDir = await tempDirs.make()
    const audioPath = join(outputDir, 'audio.mp3')
    await Bun.write(audioPath, 'audio')
    process.env['ASSEMBLYAI_API_KEY'] = 'test-assemblyai-key'
    const target = { service: 'assemblyai', model: 'universal-2' } as const
    const lifecycle = await seedAsyncProviderManifest(outputDir, target)

    const calls = installMockFetch((call) => {
      const path = new URL(call.url).pathname
      if (path === '/v2/upload') {
        return jsonResponse({ upload_url: 'https://cdn.assemblyai.test/audio-1' })
      }
      if (path === '/v2/transcript' && call.method === 'POST') {
        return jsonResponse({ id: 'assembly-job-1' })
      }
      if (path === '/v2/transcript/assembly-job-1') {
        return jsonResponse({
          id: 'assembly-job-1',
          status: 'completed',
          text: 'hello assembly',
          utterances: [{ start: 0, end: 1000, text: 'hello assembly', speaker: 'A', confidence: 0.99 }],
          words: [{ start: 0, end: 1000, text: 'hello assembly', speaker: 'A', confidence: 0.99 }]
        })
      }
      throw new Error(`Unexpected AssemblyAI request: ${call.method} ${call.url}`)
    })

    const actual = await runAssemblyAiTranscribe(audioPath, outputDir, {
      model: 'universal-2',
      segmentOffsetMinutes: 0,
      lifecycle
    })

    await expectLifecycleArtifacts(outputDir, actual, {
      service: 'assemblyai',
      model: 'universal-2',
      text: 'hello assembly',
      speaker: 'speaker-A',
      remoteJobId: 'assembly-job-1',
      remoteAssetUrl: 'https://cdn.assemblyai.test/audio-1'
    }, target)
    expect(calls.map((call) => `${call.method} ${new URL(call.url).pathname}`)).toEqual([
      'POST /v2/upload',
      'POST /v2/transcript',
      'GET /v2/transcript/assembly-job-1'
    ])
  })

  test('Gladia preserves request, result, transcript, and canonical progress shapes', async () => {
    const outputDir = await tempDirs.make()
    const audioPath = join(outputDir, 'audio.mp3')
    await Bun.write(audioPath, 'audio')
    process.env['GLADIA_API_KEY'] = 'test-gladia-key'
    const target = { service: 'gladia', model: 'solaria-1' } as const
    const lifecycle = await seedAsyncProviderManifest(outputDir, target)

    const calls = installMockFetch((call) => {
      const path = new URL(call.url).pathname
      if (path === '/v2/upload') {
        return jsonResponse({
          audio_url: 'https://cdn.gladia.test/audio-1',
          audio_metadata: {
            id: 'gladia-asset-1',
            extension: 'mp3',
            size: 5,
            audio_duration: 1,
            number_of_channels: 1
          }
        })
      }
      if (path === '/v2/pre-recorded' && call.method === 'POST') {
        return jsonResponse({ id: 'gladia-job-1', result_url: 'https://api.gladia.test/v2/pre-recorded/gladia-job-1' })
      }
      if (path === '/v2/pre-recorded/gladia-job-1') {
        return jsonResponse({
          id: 'gladia-job-1',
          status: 'done',
          result: {
            transcription: {
              full_transcript: 'hello gladia',
              utterances: [{
                start: 0,
                end: 1,
                confidence: 0.99,
                text: 'hello gladia',
                speaker: 1,
                words: [{ word: 'hello gladia', start: 0, end: 1, confidence: 0.99 }]
              }]
            }
          }
        })
      }
      throw new Error(`Unexpected Gladia request: ${call.method} ${call.url}`)
    })

    const actual = await runGladiaStt(audioPath, outputDir, {
      model: 'solaria-1',
      segmentOffsetMinutes: 0,
      lifecycle
    })

    await expectLifecycleArtifacts(outputDir, actual, {
      service: 'gladia',
      model: 'solaria-1',
      text: 'hello gladia',
      speaker: 'speaker-1',
      remoteJobId: 'gladia-job-1',
      remoteAssetId: 'gladia-asset-1',
      remoteAssetUrl: 'https://cdn.gladia.test/audio-1'
    }, target)
    expect(calls.map((call) => `${call.method} ${new URL(call.url).pathname}`)).toEqual([
      'POST /v2/upload',
      'POST /v2/pre-recorded',
      'GET /v2/pre-recorded/gladia-job-1'
    ])
  })

  test('Soniox preserves request, result, transcript, and canonical progress shapes', async () => {
    const outputDir = await tempDirs.make()
    const audioPath = join(outputDir, 'audio.mp3')
    await Bun.write(audioPath, 'audio')
    process.env['SONIOX_API_KEY'] = 'test-soniox-key'
    const target = { service: 'soniox', model: 'stt-async-v5' } as const
    const lifecycle = await seedAsyncProviderManifest(outputDir, target)

    const calls = installMockFetch((call) => {
      const path = new URL(call.url).pathname
      if (path === '/v1/files' && call.method === 'POST') {
        return jsonResponse({ id: 'soniox-asset-1' })
      }
      if (path === '/v1/transcriptions' && call.method === 'POST') {
        return jsonResponse({ id: 'soniox-job-1', status: 'queued' })
      }
      if (path === '/v1/transcriptions/soniox-job-1' && call.method === 'GET') {
        return jsonResponse({ id: 'soniox-job-1', status: 'completed' })
      }
      if (path === '/v1/transcriptions/soniox-job-1/transcript') {
        return jsonResponse({
          id: 'soniox-job-1',
          text: 'hello soniox',
          tokens: [{ text: ' hello soniox', start_ms: 0, end_ms: 1000, speaker: 'speaker-1', confidence: 0.99 }]
        })
      }
      if (call.method === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      throw new Error(`Unexpected Soniox request: ${call.method} ${call.url}`)
    })

    const actual = await runSonioxStt(audioPath, outputDir, {
      model: 'stt-async-v5',
      segmentOffsetMinutes: 0,
      lifecycle
    })

    await expectLifecycleArtifacts(outputDir, actual, {
      service: 'soniox',
      model: 'stt-async-v5',
      text: 'hello soniox',
      speaker: 'speaker-1',
      remoteJobId: 'soniox-job-1',
      remoteAssetId: 'soniox-asset-1'
    }, target)
    expect(calls.map((call) => `${call.method} ${new URL(call.url).pathname}`)).toEqual([
      'POST /v1/files',
      'POST /v1/transcriptions',
      'GET /v1/transcriptions/soniox-job-1',
      'GET /v1/transcriptions/soniox-job-1/transcript',
      'DELETE /v1/transcriptions/soniox-job-1',
      'DELETE /v1/files/soniox-asset-1'
    ])
  })
})
