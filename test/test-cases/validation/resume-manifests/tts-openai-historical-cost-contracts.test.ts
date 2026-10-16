import { describe, expect, test } from 'bun:test'
import { ttsResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/tts-resume'
import type { ActualCostBreakdown, Step4Metadata } from '~/types'

const INPUT = 'x'.repeat(453)
// The retained hard-input run counted 453 characters in its manifest receipt and
// 452 in its immutable slot reservation. They are separate historical records.
const RECORDED_CENTS = 0.57078
const COMPACT_RESERVATION_CENTS = 0.56952
const historicalStep: ActualCostBreakdown['steps'][number] = {
  step: 'tts', provider: 'openai', model: 'gpt-4o-mini-tts-2025-12-15',
  cost: RECORDED_CENTS, costSource: 'computed_usage', inputMetric: 'characters', inputValue: 453,
}
const retainedEntry: Step4Metadata = {
  ttsService: 'openai', ttsModel: 'gpt-4o-mini-tts-2025-12-15',
  processingTime: 100, audioFileName: 'retained-openai.wav', audioFileSize: 1000, chunkCount: 1,
  targetKey: 'retained-openai-target', renderIdentity: 'retained-render', resultIdentity: 'retained-result', audioRunId: 'retained-audio-run',
}
// Published rates are 60 cents / million text tokens and 1200 cents / million
// audio tokens. 580 text tokens + 1884 audio tokens cost 2.2956 cents.
const nativeEstimate = {
  inputCostPer1MTokensCents: 60, outputCostPer1MAudioTokensCents: 1200, rateIdentity: 'openai-tts-2026-10-15',
  requestCount: 1, estimatedTextTokens: 580, estimatedAudioTokens: 1884, estimatedDurationSeconds: 75.36,
  estimateProvenance: 'Heuristic: independently calculated native-unit test estimate, not measured provider usage.', totalCost: 2.2956,
}
const currentMetadata = () => ({
  tts: [structuredClone(retainedEntry)],
  cost: {
    estimated: { totalCost: COMPACT_RESERVATION_CENTS },
    observedEstimate: { totalCost: RECORDED_CENTS },
    actual: { totalCost: RECORDED_CENTS, steps: [structuredClone(historicalStep)] },
  },
})
const actualCosts = (entries: Step4Metadata[], metadata: Record<string, unknown>): ActualCostBreakdown => {
  const updated = ttsResumeConfig.rebuildRunMetadata(entries, metadata, INPUT)
  return (updated['cost'] as { actual: ActualCostBreakdown }).actual
}

describe('OpenAI TTS historical cost preservation', () => {
  test('adding another provider preserves the unchanged recorded character-price receipt verbatim', () => {
    const previous = currentMetadata()
    const before = JSON.stringify(previous)
    const grok: Step4Metadata = { ttsService: 'grok', ttsModel: 'grok-tts', processingTime: 10, audioFileName: 'new-grok.wav', audioFileSize: 1000, chunkCount: 1 }
    const actual = actualCosts([retainedEntry, grok], previous)
    expect(JSON.stringify(actual.steps[0])).toBe(JSON.stringify(historicalStep))
    expect(actual.steps[0]!.cost).not.toBe(COMPACT_RESERVATION_CENTS)
    // Grok remains independently computed at 1.5 cents per 1000 input characters.
    expect(actual.steps[1]).toMatchObject({ provider: 'grok', cost: 0.6795 })
    expect(actual.totalCost).toBeCloseTo(1.25028, 10)
    actual.steps[0]!.cost = 1
    expect(JSON.stringify(previous)).toBe(before)
  })

  test('local recovery of the same selected result does not replace or double-count its old receipt', () => {
    const recovered: Step4Metadata = { ...retainedEntry, audioFileName: 'reassembled.wav', openaiTtsEstimate: nativeEstimate }
    const actual = actualCosts([retainedEntry, recovered], currentMetadata())
    expect(actual).toEqual({ totalCost: RECORDED_CENTS, steps: [historicalStep] })
  })

  test('a local-only delivery rebuild preserves the old receipt despite new output identities', () => {
    const recovered: Step4Metadata = {
      ...retainedEntry, renderIdentity: 'new-delivery-render', resultIdentity: 'new-delivery-result', audioRunId: 'new-delivery-audio',
      openaiTtsRetainedOnly: true, openaiTtsEstimate: nativeEstimate,
    }
    expect(actualCosts([retainedEntry, recovered], currentMetadata())).toEqual({ totalCost: RECORDED_CENTS, steps: [historicalStep] })
  })

  test('a newly synthesized selected result uses its native-unit heuristic instead of an old receipt', () => {
    const fresh: Step4Metadata = { ...retainedEntry, resultIdentity: 'new-provider-result', audioRunId: 'new-provider-audio', openaiTtsEstimate: nativeEstimate }
    const actual = actualCosts([fresh], currentMetadata())
    expect(actual.totalCost).toBe(2.2956)
    expect(actual.steps).toHaveLength(1)
    expect(actual.steps[0]).toMatchObject({ costSource: 'heuristic', inputMetric: 'estimatedTextTokens', promptTokens: 580, completionTokens: 1884 })
  })

  test('a local-only result for another target cannot inherit a retained receipt', () => {
    const another: Step4Metadata = { ...retainedEntry, targetKey: 'another-openai-target', openaiTtsRetainedOnly: true, openaiTtsEstimate: nativeEstimate }
    expect(actualCosts([another], currentMetadata()).totalCost).toBe(2.2956)
  })

  test('malformed historical amounts do not poison a valid native-unit estimate', () => {
    const previous = currentMetadata()
    previous.cost.actual.steps[0]!.cost = Number.NaN
    const actual = actualCosts([{ ...retainedEntry, openaiTtsEstimate: nativeEstimate }], previous)
    expect(actual.totalCost).toBe(2.2956)
    expect(actual.steps[0]!.costSource).toBe('heuristic')
  })
})
