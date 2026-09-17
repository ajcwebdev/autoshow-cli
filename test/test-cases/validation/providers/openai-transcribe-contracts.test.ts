import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { buildOpenAISttFormFields, runOpenAIStt } from '~/cli/commands/stt/diarization-off-by-default/openai-stt/run-openai-stt'
import { SUPPORTED_OPENAI_STT_MODELS, validateOpenAISttModel } from '~/cli/commands/setup-and-utilities/models/stt-models'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { getSttEngineCapabilities } from '~/cli/commands/stt/stt-cli'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectSttTargets } from '~/cli/commands/stt/stt-targets'
import { computeSttCost } from '~/cli/commands/pricing-orchestration/cost-helpers'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { requireDefined } from '../../../test-utils/value-assertions'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['OPENAI_API_KEY'],
  tempPrefix: 'autoshow-openai-stt-',
  beforeEachExtra: () => { process.env['OPENAI_API_KEY'] = 'synthetic-key' }
})

const model = 'gpt-transcribe'

// Live shape captured on 2026-09-16: response_format json returns transcript text,
// detected languages, and billed duration, with no words or segments.
const TRANSCRIBE_RESPONSE = {
  text: 'Synthetic OpenAI transcript.',
  languages: [{ code: 'en' }],
  usage: { type: 'duration', seconds: 2 }
}

const writeAudioFixture = async (): Promise<{ audioPath: string, outputDir: string }> => {
  const dir = await tempDirs.make()
  const audioPath = join(dir, 'synthetic.mp3')
  await Bun.write(audioPath, new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]))
  return { audioPath, outputDir: dir }
}

describe('OpenAI gpt-transcribe STT contracts', () => {
  test('the selector exposes only the non-deprecated batch identity', () => {
    expect([...SUPPORTED_OPENAI_STT_MODELS]).toEqual([model])
    expect(validateOpenAISttModel(model)).toBe(model)
    // whisper-1 and the gpt-4o-transcribe family are deprecated with a 2027-02-26 shutdown,
    // and gpt-live-transcribe is streaming-only.
    for (const rejected of ['whisper-1', 'gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'gpt-4o-transcribe-diarize', 'gpt-live-transcribe']) {
      expect(() => validateOpenAISttModel(rejected)).toThrow('Invalid model')
    }
  })

  test('registry rates and capabilities match the published 2026-09-16 transcription tier', () => {
    const entry = requireDefined(getModelRegistry().stt['openai-stt']?.models[model], 'OpenAI STT model')
    expect(entry.costPerHourCents).toBe(27)
    expect(entry.pricingCheckedAt).toBe('2026-09-16')
    expect(entry.limits?.directUploadBytes).toBe(26214400)
    expect(computeSttCost('openai-stt', model, 3600)).toBeCloseTo(27, 6)
    expect(resolveCheapestModelForFlag('openai-stt')).toBe(model)
    expect(getSttEngineCapabilities('openai-stt', model)).toMatchObject({
      diarizationByDefault: false,
      diarizationKind: 'unavailable',
      supportsSpeakerCountHint: false,
      nativeWordTiming: 'unavailable'
    })
  })

  test('the provider selector routes media inputs to the openai-stt target', () => {
    const opts = buildOptsFromFlags({ 'openai-stt': model })
    expect(opts.openaiSttModels).toEqual([model])
    expect(collectSttTargets(opts).map((target) => `${target.service}:${target.model}`)).toEqual([`openai-stt:${model}`])
    expect(buildOptsFromFlags({ 'all-stt': true }).openaiSttModels).toEqual([model])
  })

  test('the request stays on response_format json because verbose_json is rejected upstream', async () => {
    expect(buildOpenAISttFormFields()).toEqual({ response_format: 'json' })

    const { audioPath, outputDir } = await writeAudioFixture()
    const calls = installMockFetch(() => jsonResponse(TRANSCRIBE_RESPONSE))
    const { result, metadata } = await runOpenAIStt(audioPath, outputDir, { model, segmentOffsetMinutes: 0, audioDurationSeconds: 2 })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('https://api.openai.com/v1/audio/transcriptions')
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer synthetic-key')
    const form = requireDefined(calls[0]?.form, 'multipart form')
    expect(form.get('model')).toBe(model)
    expect(form.get('response_format')).toBe('json')
    expect(form.getAll('timestamp_granularities[]')).toEqual([])

    expect(metadata).toMatchObject({ transcriptionService: 'openai-stt', transcriptionModel: model })
    expect(result.text).toBe('Synthetic OpenAI transcript.')
    expect(result.segments).toHaveLength(1)
    expect(result.segments[0]?.text).toBe('Synthetic OpenAI transcript.')
    expect(result.evidence?.words?.length ?? 0).toBe(0)
  })

  test('a rejected response_format surfaces the provider error instead of an empty transcript', async () => {
    const { audioPath, outputDir } = await writeAudioFixture()
    const calls = installMockFetch(() => jsonResponse({
      error: { message: "response_format 'verbose_json' is not compatible with model 'gpt-transcribe'. Use 'json' or 'text' instead.", type: 'invalid_request_error', code: 'unsupported_value' }
    }, { status: 400 }))
    await expect(runOpenAIStt(audioPath, outputDir, { model, segmentOffsetMinutes: 0 }))
      .rejects.toThrow('OpenAI transcription failed')
    expect(calls.length).toBeGreaterThanOrEqual(1)
  })

  test('the segment offset moves the synthesized whole-request segment', async () => {
    const { audioPath, outputDir } = await writeAudioFixture()
    installMockFetch(() => jsonResponse(TRANSCRIBE_RESPONSE))
    const { result } = await runOpenAIStt(audioPath, outputDir, { model, segmentOffsetMinutes: 1, segmentNumber: 2, totalSegments: 2 })
    expect(result.segments[0]?.start).toBe('00:01:00.000')
  })
})
