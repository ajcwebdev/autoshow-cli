import { validateGeminiTtsModel } from '~/cli/commands/setup-and-utilities/models/tts-models'
import { isRecord } from '~/utils/rest-client'
import { UsageError } from '~/utils/error-handler'

// The public Batch guide targets 24 hours, but expires pending/running jobs at
// 48 hours. Reserve a rate transition across the complete processing window.
export const GEMINI_BATCH_EXPIRY_WINDOW_MS = 48 * 60 * 60 * 1000

export const geminiTtsRates = (model: string, mode = 'unary', at = new Date(), completionDeadline = at) => {
  validateGeminiTtsModel(model)
  if (!['unary', 'stream', 'batch'].includes(mode) || !Number.isFinite(at.getTime()) || !Number.isFinite(completionDeadline.getTime())) throw UsageError('Invalid Gemini TTS pricing mode or time.')
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
  const rates = geminiTtsRates(model, mode, at, new Date(at.getTime() + (mode === 'batch' ? GEMINI_BATCH_EXPIRY_WINDOW_MS : 0)))
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
export const readGeminiTtsUsageCounts = (usage: unknown): { textTokens: number, audioTokens: number } | undefined => {
  if (!isRecord(usage)) return undefined
  const count = (list: unknown, modality: string, field: 'tokens' | 'tokenCount'): number | undefined => {
    if (!Array.isArray(list)) return undefined
    const seen = new Set<string>()
    let selected: number | undefined
    for (const item of list) {
      if (!isRecord(item) || typeof item['modality'] !== 'string') return undefined
      const kind = item['modality'].toLowerCase(), value = item[field]
      if (!['text', 'audio', 'image', 'video', 'document'].includes(kind) || seen.has(kind) || typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || kind !== modality && value !== 0) return undefined
      const alternate = item[field === 'tokens' ? 'tokenCount' : 'tokens']
      if (alternate !== undefined && alternate !== value) return undefined
      seen.add(kind)
      if (kind === modality) selected = value
    }
    return selected
  }
  const pairs = []
  for (const [input, output, field] of [['input_tokens_by_modality', 'output_tokens_by_modality', 'tokens'], ['promptTokensDetails', 'candidatesTokensDetails', 'tokenCount']] as const) {
    if (usage[input] === undefined && usage[output] === undefined) continue
    const textTokens = count(usage[input], 'text', field), audioTokens = count(usage[output], 'audio', field)
    if (textTokens === undefined || audioTokens === undefined) return undefined
    pairs.push({ textTokens, audioTokens })
  }
  const pair = pairs[0]
  if (!pair || !Number.isSafeInteger(pair.textTokens + pair.audioTokens) || pairs.some(value => value.textTokens !== pair.textTokens || value.audioTokens !== pair.audioTokens)) return undefined
  for (const key of ['cached_tokens_by_modality', 'tool_use_tokens_by_modality', 'grounding_tool_count']) if (usage[key] !== undefined && (!Array.isArray(usage[key]) || usage[key].length !== 0)) return undefined
  for (const [key, expected] of [['total_input_tokens', pair.textTokens], ['promptTokenCount', pair.textTokens], ['total_output_tokens', pair.audioTokens], ['candidatesTokenCount', pair.audioTokens], ['total_tokens', pair.textTokens + pair.audioTokens], ['totalTokenCount', pair.textTokens + pair.audioTokens], ['total_cached_tokens', 0], ['cachedContentTokenCount', 0], ['total_thought_tokens', 0], ['thoughtsTokenCount', 0], ['total_tool_use_tokens', 0]] as const) {
    if (usage[key] !== undefined && usage[key] !== expected) return undefined
  }
  return pair
}
export const reconcileGeminiTtsUsage = (model: string, mode: string, usage: unknown, startedAt: Date, observedAt = new Date()) => {
  const counts = readGeminiTtsUsageCounts(usage)
  if (!counts || !Number.isFinite(startedAt.getTime()) || !Number.isFinite(observedAt.getTime())) return undefined
  const { textTokens, audioTokens } = counts
  const rates = geminiTtsRates(model, mode, startedAt, observedAt)
  return { ...rates, observedTextTokens: textTokens, observedAudioTokens: audioTokens, totalCost: (textTokens * rates.inputCostPer1MTokensCents + audioTokens * rates.outputCostPer1MAudioTokensCents) / 1e6 }
}

export const readGeminiTtsValuation = (model: string, value: unknown) => {
  if (!isRecord(value) || typeof value['rateIdentity'] !== 'string' || typeof value['executionMode'] !== 'string') return undefined
  const schedule = /^gemini-tts-(2026-09-22|2027-01-01)-(standard|batch)$/.exec(value['rateIdentity'])
  if (!schedule || !['unary', 'stream', 'batch'].includes(value['executionMode']) || (value['executionMode'] === 'batch') !== (schedule[2] === 'batch')) return undefined
  const text = value['observedTextTokens'], audio = value['observedAudioTokens'], cost = value['totalCost']
  if (typeof text !== 'number' || !Number.isSafeInteger(text) || text < 0 || typeof audio !== 'number' || !Number.isSafeInteger(audio) || audio < 0 || !Number.isSafeInteger(text + audio) || typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0) return undefined
  const rates = geminiTtsRates(model, value['executionMode'], new Date(`${schedule[1]}T00:00:00Z`))
  for (const key of ['inputCostPer1MTokensCents', 'outputCostPer1MAudioTokensCents'] as const) if (value[key] !== undefined && value[key] !== rates[key]) return undefined
  const expected = (text * rates.inputCostPer1MTokensCents + audio * rates.outputCostPer1MAudioTokensCents) / 1e6
  if (Math.abs(cost - expected) > Math.max(1e-12, Math.abs(expected) * 1e-12)) return undefined
  // Keep an existing valid recorded value, rather than repricing historical use.
  return { ...rates, observedTextTokens: text, observedAudioTokens: audio, totalCost: cost }
}
