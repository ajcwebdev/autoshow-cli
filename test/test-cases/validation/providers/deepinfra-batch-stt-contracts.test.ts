import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { runDeepinfraTranscribe } from '~/cli/commands/stt/diarization-off-by-default/deepinfra/run-deepinfra-stt'
import { validateDeepinfraSttModel, SUPPORTED_DEEPINFRA_STT_MODELS } from '~/cli/commands/setup-and-utilities/models/stt-models'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { getSttEngineCapabilities } from '~/cli/commands/stt/stt-cli'
import { computeSttCost } from '~/cli/commands/pricing-orchestration/cost-helpers'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { requireDefined } from '../../../test-utils/value-assertions'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['DEEPINFRA_API_KEY'],
  tempPrefix: 'autoshow-deepinfra-stt-',
  beforeEachExtra: () => { process.env['DEEPINFRA_API_KEY'] = 'synthetic-key' }
})

// Live shapes captured on 2026-09-16 from https://api.deepinfra.com/v1/audio/transcriptions.
// Qwen3-ASR returns words with one coarse segment, Nemotron returns words with many
// segments, and both Voxtral deployments return transcript text with null words/segments.
const WORDED_RESPONSE = {
  text: 'Synthetic batch transcript.',
  task: 'transcribe',
  language: 'english',
  duration: 2,
  words: [
    { word: 'Synthetic', start: 0.1, end: 0.6 },
    { word: 'batch', start: 0.6, end: 1.1 },
    { word: 'transcript.', start: 1.1, end: 2 }
  ],
  segments: [{ id: 0, seek: 0, start: 0.1, end: 2, text: 'Synthetic batch transcript.' }]
}

const TEXT_ONLY_RESPONSE = {
  text: 'Synthetic batch transcript.',
  task: 'transcribe',
  language: null,
  duration: 2,
  words: null,
  segments: null
}

const CATALOG = [
  { model: 'openai/whisper-large-v3-turbo', hourCents: 1.2, shape: WORDED_RESPONSE, nativeWordTiming: 'available' },
  { model: 'openai/whisper-large-v3', hourCents: 2.7, shape: WORDED_RESPONSE, nativeWordTiming: 'available' },
  { model: 'Qwen/Qwen3-ASR-0.6B', hourCents: 1.2, shape: WORDED_RESPONSE, nativeWordTiming: 'available' },
  { model: 'Qwen/Qwen3-ASR-1.7B', hourCents: 2.7, shape: WORDED_RESPONSE, nativeWordTiming: 'available' },
  { model: 'mistralai/Voxtral-Mini-3B-2507', hourCents: 6, shape: TEXT_ONLY_RESPONSE, nativeWordTiming: 'unavailable' },
  { model: 'mistralai/Voxtral-Small-24B-2507', hourCents: 18, shape: TEXT_ONLY_RESPONSE, nativeWordTiming: 'unavailable' },
  { model: 'nvidia/Nemotron-3.5-ASR-Streaming-Multilingual-0.6b', hourCents: 1.2, shape: WORDED_RESPONSE, nativeWordTiming: 'available' }
] as const

const writeAudioFixture = async (): Promise<{ audioPath: string, outputDir: string }> => {
  const dir = await tempDirs.make()
  const audioPath = join(dir, 'synthetic.mp3')
  await Bun.write(audioPath, new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]))
  return { audioPath, outputDir: dir }
}

describe('DeepInfra batch STT catalog contracts', () => {
  test('the selector accepts every registered batch deployment and rejects unregistered ids', () => {
    expect([...SUPPORTED_DEEPINFRA_STT_MODELS]).toEqual(CATALOG.map((entry) => entry.model))
    for (const { model } of CATALOG) expect(validateDeepinfraSttModel(model)).toBe(model)
    // Streaming-only Together identities and chat-only DeepInfra ids stay out of the STT selector.
    for (const rejected of ['nvidia/nemotron-3-asr-streaming-0.6b', 'nvidia/nemotron-3.5-asr-streaming-0.6b', 'Qwen/Qwen3.8-27B', 'mistralai/Voxtral-Mini-2507']) {
      expect(() => validateDeepinfraSttModel(rejected)).toThrow('Invalid model')
    }
  })

  test('registry rates, estimation, and the pinned bare-provider default match the 2026-09-16 catalog', () => {
    for (const { model, hourCents } of CATALOG) {
      const entry = requireDefined(getModelRegistry().stt['deepinfra']?.models[model], `DeepInfra STT ${model}`)
      expect(entry.costPerHourCents).toBe(hourCents)
      expect(entry.estimation?.msPerSecond).toBeGreaterThan(0)
      expect(computeSttCost('deepinfra', model, 3600)).toBeCloseTo(hourCents, 6)
    }
    // whisper-large-v3-turbo ties the two $0.00020/min deployments on price and wins on runtime rank.
    expect(resolveCheapestModelForFlag('deepinfra-stt')).toBe('openai/whisper-large-v3-turbo')
  })

  test('word-timing capability follows the observed response shape per model', () => {
    for (const { model, nativeWordTiming } of CATALOG) {
      expect(getSttEngineCapabilities('deepinfra', model)).toMatchObject({
        diarizationByDefault: false,
        diarizationKind: 'unavailable',
        nativeWordTiming
      })
    }
  })

  for (const { model, shape, nativeWordTiming } of CATALOG) {
    test(`${model} dispatches the OpenAI-compatible batch request and decodes its response shape`, async () => {
      const { audioPath, outputDir } = await writeAudioFixture()
      const calls = installMockFetch(() => jsonResponse(shape))
      const { result, metadata } = await runDeepinfraTranscribe(audioPath, outputDir, { model, segmentOffsetMinutes: 0, audioDurationSeconds: 2 })

      expect(calls).toHaveLength(1)
      expect(calls[0]?.url).toBe('https://api.deepinfra.com/v1/audio/transcriptions')
      expect(calls[0]?.headers.get('authorization')).toBe('Bearer synthetic-key')
      const form = requireDefined(calls[0]?.form, 'multipart form')
      expect(form.get('model')).toBe(model)
      expect(form.get('response_format')).toBe('verbose_json')
      expect(form.getAll('timestamp_granularities[]')).toEqual(['word', 'segment'])

      expect(metadata).toMatchObject({ transcriptionService: 'deepinfra', transcriptionModel: model })
      expect(result.text).toBe('Synthetic batch transcript.')
      expect(result.segments).toHaveLength(1)
      // A text-only response still produces one whole-request segment with no native words.
      expect(result.evidence?.words?.length ?? 0).toBe(nativeWordTiming === 'available' ? 3 : 0)
    })
  }

  test('a rejected batch request surfaces the provider status instead of an empty transcript', async () => {
    const { audioPath, outputDir } = await writeAudioFixture()
    const calls = installMockFetch(() => jsonResponse({ detail: 'Not Found' }, { status: 404 }))
    await expect(runDeepinfraTranscribe(audioPath, outputDir, { model: 'Qwen/Qwen3-ASR-0.6B', segmentOffsetMinutes: 0 }))
      .rejects.toThrow('DeepInfra transcription failed')
    expect(calls.length).toBeGreaterThanOrEqual(1)
  })
})
