import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'

export const sonioxRetainedCostBasis = (provider: string, slots: readonly { providerText: string }[], outputs: readonly { durationMs?: number | undefined }[]) => provider === 'soniox' ? {
  sonioxInputCharacters: slots.reduce((sum, slot) => sum + [...slot.providerText].length, 0),
  sonioxProviderAudioSeconds: outputs.reduce((sum, output) => sum + (output.durationMs ?? 0), 0) / 1000,
} : {}

export const sonioxTtsRates = () => {
  const model = getModelRegistry().tts['soniox']!.models['tts-rt-v2']!
  return {
    inputCostPer1MTokensCents: model.inputCostPer1MTokensCents!,
    outputCostPer1MAudioTokensCents: model.outputCostPer1MAudioTokensCents!,
    rateIdentity: 'soniox-tts-2026-09-24',
  }
}

export const estimateSonioxTtsCost = (characters: number, speed = 1, providerAudioSeconds?: number) => {
  const rates = sonioxTtsRates()
  const estimatedTextTokens = Math.max(0, characters) * 0.3
  const estimatedDurationSeconds = providerAudioSeconds ?? Math.max(0, characters) / 50_000 * 3600 / speed
  const estimatedAudioTokens = estimatedDurationSeconds / 3600 * 30_000
  return {
    ...rates, estimatedTextTokens, estimatedAudioTokens, estimatedDurationSeconds,
    estimateProvenance: `Estimated: 0.3 input tokens/character; ${providerAudioSeconds === undefined ? '50,000 characters/hour adjusted for numeric speed' : 'measured provider audio, excluding locally inserted silence'}; 30,000 audio tokens/hour. Tags, language and delivery affect usage; REST returns no authoritative token counts.`,
    totalCost: (estimatedTextTokens * rates.inputCostPer1MTokensCents + estimatedAudioTokens * rates.outputCostPer1MAudioTokensCents) / 1e6,
  }
}

// A resume plan has already summed each remaining slot with its own effective speed.
export const sonioxEstimateFromPlannedCost = (characters: number, totalCost: number) => {
  const estimate = estimateSonioxTtsCost(characters)
  const inputCost = estimate.estimatedTextTokens * estimate.inputCostPer1MTokensCents / 1e6
  const estimatedAudioTokens = Math.max(0, totalCost - inputCost) * 1e6 / estimate.outputCostPer1MAudioTokensCents
  return { ...estimate, totalCost, estimatedAudioTokens, estimatedDurationSeconds: estimatedAudioTokens / 30_000 * 3600 }
}
