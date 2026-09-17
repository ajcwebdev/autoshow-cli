import { describe, expect, test } from 'bun:test'
import { validateGeminiSttModel } from '~/cli/commands/setup-and-utilities/models/stt-models'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { computeGeminiSttBillingFromUsage } from '~/cli/commands/stt/diarization/gemini-stt/run-gemini-stt'
import { getSttEngineCapabilities } from '~/cli/commands/stt/stt-cli'

const model = 'gemini-3.5-transcribe'

describe('Gemini 3.5 Transcribe catalog contracts', () => {
  test('STT selection, capabilities, and conservative token rates use the transcribe model only', () => {
    expect(validateGeminiSttModel(model)).toBe(model)
    expect(() => validateGeminiSttModel('gemini-3.6-flash')).toThrow('gemini-3.5-transcribe')
    expect(() => validateGeminiSttModel('gemini-3.8-flash')).toThrow('gemini-3.5-transcribe')
    expect(resolveCheapestModelForFlag('gemini-stt')).toBe(model)
    expect(getSttEngineCapabilities('gemini-stt', model)).toMatchObject({
      diarizationByDefault: true,
      diarizationKind: 'native',
      nativeWordTiming: 'available',
      supportsSpeakerCountHint: false
    })
    const entry = getModelRegistry().stt['gemini-stt']?.models[model]
    expect(entry?.costPerHourCents).toBe(30)
    expect(entry?.limits?.durationSeconds).toBe(1800)
    expect(entry?.pricingCheckedAt).toBe('2026-09-14')
    expect(computeGeminiSttBillingFromUsage(model, undefined)).toBeUndefined()
    expect(computeGeminiSttBillingFromUsage(model, { promptTokenCount: 1_000_000 })?.totalCost).toBe(200)
    const billing = computeGeminiSttBillingFromUsage(model, {
      promptTokenCount: 1_000_000,
      candidatesTokenCount: 100,
      promptTokensDetails: [{ modality: 'AUDIO', tokenCount: 500_000 }]
    })
    expect(billing).toMatchObject({
      inputTokens: 1_000_000,
      outputTokens: 100,
      audioInputTokens: 500_000,
      textInputTokens: 500_000
    })
    expect(billing?.totalCost).toBeCloseTo(200.12)
  })
})
