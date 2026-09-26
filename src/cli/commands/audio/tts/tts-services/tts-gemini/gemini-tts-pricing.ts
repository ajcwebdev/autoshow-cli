import { validateGeminiTtsModel } from '~/cli/commands/setup-and-utilities/models/tts-models'

export const geminiTtsRates = (model: string, mode = 'unary', at = new Date(), completionDeadline = at) => {
  validateGeminiTtsModel(model)
  const standard = Math.max(at.getTime(), completionDeadline.getTime()) >= Date.parse('2027-01-01T00:00:00Z')
  const multiplier = (standard ? 2 : 1) * (mode === 'batch' ? 0.5 : 1)
  return {
    rateIdentity: `gemini-tts-${standard ? '2027-01-01' : '2026-09-22'}-${mode === 'batch' ? 'batch' : 'standard'}`,
    inputCostPer1MTokensCents: 50 * multiplier,
    outputCostPer1MAudioTokensCents: (model.includes('lite') ? 600 : 900) * multiplier,
    executionMode: mode,
  }
}
export const estimateGeminiTtsCost = (model: string, characters: number, mode = 'unary', at = new Date(), plannedRequests?: number) => {
  const count = Math.max(0, Math.ceil(characters)), requests = plannedRequests ?? Math.max(1, Math.ceil(count / 1200))
  // Without text and controls, even a one-character segment can consume a request.
  // Prepared inputs provide the actual planned count; a character-only quote uses a safe ceiling.
  const boundedRequests = plannedRequests ?? Math.max(1, count)
  const rates = geminiTtsRates(model, mode, at, new Date(at.getTime() + (mode === 'batch' ? 86400_000 : 0)))
  const estimatedTextTokens = Math.ceil(count / 4) + requests * 128
  const estimatedDurationSeconds = count / 12
  const estimatedAudioTokens = Math.ceil(estimatedDurationSeconds * 25)
  return {
    ...rates, requestCount: requests, estimatedTextTokens, estimatedAudioTokens, estimatedDurationSeconds,
    estimateProvenance: 'local:4-characters-per-text-token;12-characters-per-second;25-audio-tokens-per-second;128-metadata-tokens-per-request',
    totalCost: (estimatedTextTokens * rates.inputCostPer1MTokensCents + estimatedAudioTokens * rates.outputCostPer1MAudioTokensCents) / 1e6,
    authorizationBoundCents: boundedRequests * (8192 * rates.inputCostPer1MTokensCents + 16384 * rates.outputCostPer1MAudioTokensCents) / 1e6,
  }
}
export const reconcileGeminiTtsUsage = (model: string, mode: string, usage: unknown, startedAt: Date, observedAt = new Date()) => {
  if (!usage || typeof usage !== 'object') return undefined
  const data = usage as Record<string, unknown>
  const count = (key: string, modality: string): number | undefined => {
    const list = data[key]
    if (!Array.isArray(list)) return undefined
    const item = list.find(v => v && typeof v === 'object' && String(v.modality).toLowerCase() === modality) as Record<string, unknown> | undefined
    const value = item?.['tokens'] ?? item?.['tokenCount']
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined
  }
  const textTokens = count('input_tokens_by_modality', 'text') ?? count('promptTokensDetails', 'text')
  const audioTokens = count('output_tokens_by_modality', 'audio') ?? count('candidatesTokensDetails', 'audio')
  if (textTokens === undefined || audioTokens === undefined) return undefined
  const rates = geminiTtsRates(model, mode, startedAt, observedAt)
  return { ...rates, observedTextTokens: textTokens, observedAudioTokens: audioTokens, totalCost: (textTokens * rates.inputCostPer1MTokensCents + audioTokens * rates.outputCostPer1MAudioTokensCents) / 1e6 }
}
