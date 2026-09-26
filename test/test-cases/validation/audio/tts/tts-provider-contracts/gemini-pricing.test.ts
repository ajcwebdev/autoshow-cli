import { expect, test } from 'bun:test'
import { estimateGeminiTtsCost, geminiTtsRates, reconcileGeminiTtsUsage } from '~/cli/commands/audio/tts/tts-services/tts-gemini/gemini-tts-pricing'
import { computeTtsCost } from '~/cli/commands/pricing-orchestration/cost-helpers'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { restoreGeminiResumeOptions, recordGeminiResumeOptions } from '~/cli/commands/audio/tts/tts-services/tts-gemini/gemini-resume-options'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { buildTtsTargetEstimates } from '~/cli/commands/pricing-orchestration/aggregate-pricing/tts-estimates'
import { FLASH, LITE, usage } from './gemini-fixtures'
import type { TtsOptions } from '~/types'
const at = new Date('2026-09-24T00:00:00Z')
test('token tariffs, Batch discounts, and January transition have explicit schedule identities', () => {
  for (const [model, output] of [[FLASH, 900], [LITE, 600]] as const) {
    expect(geminiTtsRates(model, 'unary', at)).toMatchObject({ inputCostPer1MTokensCents: 50, outputCostPer1MAudioTokensCents: output })
    expect(geminiTtsRates(model, 'batch', at)).toMatchObject({ inputCostPer1MTokensCents: 25, outputCostPer1MAudioTokensCents: output / 2 })
    expect(geminiTtsRates(model, 'unary', new Date('2027-01-01'))).toMatchObject({ inputCostPer1MTokensCents: 100, outputCostPer1MAudioTokensCents: output * 2 })
    expect(estimateGeminiTtsCost(model, 120, 'unary', at)).toMatchObject({ estimatedDurationSeconds: 10, estimatedAudioTokens: 250, estimatedTextTokens: 158 })
    const crossing = estimateGeminiTtsCost(model, 120, 'batch', new Date('2026-12-31T12:00:00Z'))
    expect(crossing.rateIdentity).toBe('gemini-tts-2027-01-01-batch')
    expect(crossing.authorizationBoundCents).toBeGreaterThan(crossing.totalCost)
  }
})
test('observed text/audio usage is reconciled separately from heuristic estimates', () => {
  const reconciled = reconcileGeminiTtsUsage(LITE, 'unary', usage, at, at)!
  expect(reconciled.totalCost).toBeCloseTo((30 * 50 + 8 * 600) / 1e6, 10)
  expect(reconcileGeminiTtsUsage(LITE, 'unary', { total_tokens: 38 }, at, at)).toBeUndefined()
  const metadata = { ttsService: 'gemini' as const, ttsModel: LITE, processingTime: 1, audioFileName: 'test.wav', audioFileSize: 500, chunkCount: 1, geminiTtsUsage: [reconciled], geminiTtsUsageComplete: true }
  expect(computeActualCosts({ step4: [metadata], ttsCharacterCount: 120 }).steps[0]).toMatchObject({ costSource: 'provider_usage', cost: reconciled.totalCost, inputMetric: 'textTokens' })
  expect(computeActualCosts({ step4: [{ ...metadata, geminiTtsUsageComplete: false }], ttsCharacterCount: 120 }).steps[0]?.costSource).toBe('heuristic')
  expect(computeTtsCost('gemini', LITE, 120).cost).toBeGreaterThan(0)
})
test('aggregate price preserves token provenance; resume restores transport and controls', async () => {
  const options: TtsOptions = { geminiTtsModels: [LITE], geminiTtsMode: 'stream', geminiTtsVoice: 'Puck', geminiTtsInstructions: 'Soft.', geminiTtsResponseFormat: 'pcm' }
  const price = await buildTtsTargetEstimates(collectTtsTargets(options), options, 120)
  expect(price[0]).toMatchObject({ executionMode: 'stream', estimatedAudioTokens: 250 })
  expect(price[0]?.estimateProvenance).toContain('local:')
  const resumed: TtsOptions = {}
  restoreGeminiResumeOptions(resumed, { schemaVersion: 1, settingsSchema: 'gemini.tts.v1', request: {}, local: { geminiResume: recordGeminiResumeOptions(options) } })
  expect(resumed).toMatchObject({ geminiTtsMode: 'stream', geminiTtsVoice: 'Puck', geminiTtsInstructions: 'Soft.' })
})

test('authorization bounds use planned request counts and never assume short text means one request', () => {
  const one = estimateGeminiTtsCost(LITE, 120, 'unary', at, 1)
  const segmented = estimateGeminiTtsCost(LITE, 120, 'unary', at, 3)
  expect(segmented.authorizationBoundCents).toBe(one.authorizationBoundCents * 3)
  expect(segmented.estimatedTextTokens).toBe(30 + 3 * 128)
  expect(estimateGeminiTtsCost(LITE, 120, 'unary', at).authorizationBoundCents).toBeGreaterThanOrEqual(segmented.authorizationBoundCents)
})

test('price reports and persisted estimates retain the token schedule and spending bound', async () => {
  const { stepEstimateToEstimated, stepEstimateToReport } = await import('~/utils/pricing/step-estimate-fields')
  const options: TtsOptions = { geminiTtsModels: [LITE] }
  const [estimate] = await buildTtsTargetEstimates(collectTtsTargets(options), options, 120, [3])
  for (const rendered of [stepEstimateToEstimated(estimate!), stepEstimateToReport(estimate!)]) {
    expect(rendered).toMatchObject({ rateIdentity: expect.stringContaining('gemini-tts-'), executionMode: 'unary', estimatedTextTokens: 414, estimatedAudioTokens: 250, authorizationBoundCents: expect.any(Number) })
  }
})

test('retained settings do not erase explicit local chunking or export requests on resume', () => {
  const options: TtsOptions = { ttsChunking: { boundary: 'smart', maxChars: 100 }, ttsExport: { format: 'flac' } }
  restoreGeminiResumeOptions(options, { schemaVersion: 1, settingsSchema: 'gemini.tts.v1', request: {}, local: { geminiResume: { ttsChunking: { boundary: 'legacy', maxChars: 500 }, ttsExport: { format: 'mp3' } } } }, new Set(['tts-chunk-size', 'tts-export-format']))
  expect(options).toMatchObject({ ttsChunking: { boundary: 'smart', maxChars: 100 }, ttsExport: { format: 'flac' } })
})
