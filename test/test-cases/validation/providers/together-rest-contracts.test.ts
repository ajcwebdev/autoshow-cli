import { describe, expect, test } from 'bun:test'
import { buildTogetherSttFormFields } from '~/cli/commands/stt/diarization-off-by-default/together/run-together-stt'
import { SUPPORTED_TOGETHER_STT_MODELS, validateTogetherSttModel } from '~/cli/commands/setup-and-utilities/models/stt-models'
import { getModelRegistry, getSttLimits } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { computeSttCost } from '~/cli/commands/pricing-orchestration/cost-helpers'
import { resolveSttSplitPolicy } from '~/cli/commands/stt/stt-split-policy'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { requireDefined } from '../../../test-utils/value-assertions'

setupContractSuiteLifecycle({ envKeys: ['TOGETHER_API_KEY'], tempPrefix: 'autoshow-together-stt-' })

const WHISPER = 'openai/whisper-large-v3'
const PARAKEET = 'nvidia/parakeet-tdt-0.6b-v3'
// Together's batch transcription page lists this string as a serverless model, but on 2026-10-17 a multipart
// POST /v1/audio/transcriptions request for it returned 400 "This model only supports WebSocket streaming."
// (retained in docs/benchmarks/stt-without-speakers/1-audio/providers/together-nvidia_nemotron-3.5-asr-streaming-0.6b/).
const NEMOTRON = 'nvidia/nemotron-3.5-asr-streaming-0.6b'

describe('Together STT REST contracts', () => {
  test('builds verbose segment requests for each current batch model', () => {
    for (const model of SUPPORTED_TOGETHER_STT_MODELS) {
      expect(buildTogetherSttFormFields(model)).toEqual({
        response_format: 'verbose_json',
        'timestamp_granularities[0]': 'word',
        'timestamp_granularities[1]': 'segment',
        diarize: 'false'
      })
    }
  })

  test('sends a decoding prompt only to the Whisper family', () => {
    expect(buildTogetherSttFormFields(WHISPER, '  AutoShow names  ')).toEqual({
      response_format: 'verbose_json',
      'timestamp_granularities[0]': 'word',
      'timestamp_granularities[1]': 'segment',
      diarize: 'false',
      prompt: 'AutoShow names'
    })
    expect(buildTogetherSttFormFields(PARAKEET, 'AutoShow names')).toEqual({
      response_format: 'verbose_json',
      'timestamp_granularities[0]': 'word',
      'timestamp_granularities[1]': 'segment',
      diarize: 'false'
    })
  })

  test('the WebSocket-only Nemotron streaming models are rejected before any request', () => {
    const calls = installMockFetch(() => { throw Error('Provider must not be called') })
    expect([...SUPPORTED_TOGETHER_STT_MODELS]).toEqual([WHISPER, PARAKEET])
    for (const rejected of [NEMOTRON, 'nvidia/nemotron-3-asr-streaming-0.6b']) {
      expect(() => validateTogetherSttModel(rejected)).toThrow('the Nemotron ASR Streaming models accept only WebSocket streaming')
      expect(() => buildOptsFromFlags({ 'together-stt': [rejected] })).toThrow('Invalid model')
    }
    expect(getModelRegistry().stt['together']?.models[NEMOTRON]).toBeUndefined()
    expect(computeSttCost('together', PARAKEET, 60)).toBeCloseTo(0.15, 6)
    expect(resolveCheapestModelForFlag('together-stt')).toBe(PARAKEET)
    expect(calls).toHaveLength(0)
  })

  test('every model records the documented 80 MB upload limit under a 20 MiB operational cap', () => {
    for (const model of SUPPORTED_TOGETHER_STT_MODELS) {
      expect(requireDefined(getModelRegistry().stt['together']?.models[model], model).pricingCheckedAt).toBe('2026-10-17')
      expect(getSttLimits('together', model)).toMatchObject({
        effectiveBytes: 20 * 1024 * 1024,
        directUploadBytes: 80_000_000,
        remoteUrlBytes: 1024 * 1024 * 1024,
        durationSeconds: 14_400
      })
      expect(resolveSttSplitPolicy({ service: 'together', model })).toEqual({ attachmentCapBytes: 20 * 1024 * 1024, maxDurationSeconds: 14_400 })
    }
  })
})
