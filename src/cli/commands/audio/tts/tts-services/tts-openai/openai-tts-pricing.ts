import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import type { AttemptSlot, AttemptTurn, PlannedCost, TtsTarget } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { OPENAI_TOKEN_TTS_MODEL, OPENAI_TTS_TOKEN_RESERVE, openAITtsTextByteBudget, validateOpenAITtsControls } from './openai-tts-request'

export const openAITtsRates = () => {
  const model = getModelRegistry().tts['openai']!.models[OPENAI_TOKEN_TTS_MODEL]!
  return { inputCostPer1MTokensCents: model.inputCostPer1MTokensCents!, outputCostPer1MAudioTokensCents: model.outputCostPer1MAudioTokensCents!, rateIdentity: 'openai-tts-2026-10-15' }
}

// Official units: https://developers.openai.com/api/docs/models/gpt-4o-mini-tts
// Duration/token conversion is deliberately a local heuristic: slow 6 characters/s
// and 25 audio tokens/s provide narration headroom, not a guaranteed spending cap.
// Language, pronunciation, free-form delivery and pauses may exceed this estimate.
export const estimateOpenAITtsCost = (characters: number, options: { instructions?: string | undefined, speed?: number | undefined, requestCount?: number | undefined, textBytes?: number | undefined, providerAudioSeconds?: number | undefined } = {}) => {
  validateOpenAITtsControls(options.instructions, options.speed)
  for (const [name, value] of Object.entries({ characters, requestCount: options.requestCount, textBytes: options.textBytes })) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) throw UsageError(`OpenAI TTS ${name} must be a non-negative safe integer.`)
  }
  if (characters > 0 && options.requestCount === 0) throw UsageError('OpenAI TTS nonempty text requires at least one request.')
  if (options.providerAudioSeconds !== undefined && (!Number.isFinite(options.providerAudioSeconds) || options.providerAudioSeconds < 0)) throw UsageError('OpenAI TTS provider audio duration must be finite and non-negative.')
  const count = characters
  const textBytes = options.textBytes ?? count * 4
  const requestCount = count === 0 ? 0 : options.requestCount ?? Math.max(1, Math.ceil(textBytes / openAITtsTextByteBudget(options.instructions)))
  const estimatedTextTokens = textBytes + requestCount * (Buffer.byteLength(options.instructions ?? '') + OPENAI_TTS_TOKEN_RESERVE)
  const estimatedDurationSeconds = options.providerAudioSeconds ?? count / 6 / (options.speed ?? 1)
  const estimatedAudioTokens = Math.ceil(estimatedDurationSeconds * 25)
  const rates = openAITtsRates()
  return {
    ...rates, requestCount, estimatedTextTokens, estimatedAudioTokens, estimatedDurationSeconds,
    estimateProvenance: `Heuristic: one estimated text token per UTF-8 byte (local upper estimate), ${options.textBytes === undefined ? '4 bytes/character without source text' : 'using source bytes'}; repeated instruction UTF-8 bytes plus 128 local framing tokens/request; ${options.providerAudioSeconds === undefined ? '6 characters/second adjusted for numeric speed' : 'measured provider audio excluding local silence'}; 25 estimated audio tokens/second. These conversions are local assumptions, not provider token usage or a guaranteed maximum. Binary WAV exposes no authoritative usage; language, delivery and pauses may exceed the estimate.`,
    totalCost: (estimatedTextTokens * rates.inputCostPer1MTokensCents + estimatedAudioTokens * rates.outputCostPer1MAudioTokensCents) / 1e6,
  }
}

export const currentOpenAITtsSlotCost = (target: TtsTarget, slot: Pick<AttemptSlot, 'providerText' | 'turnIds' | 'plannedCost'>, turns: readonly Pick<AttemptTurn, 'canonical' | 'effectiveControls'>[], includeSetup = false): PlannedCost => {
  if (target.service !== 'openai' || target.model !== OPENAI_TOKEN_TTS_MODEL) return slot.plannedCost
  const estimate = estimateOpenAITtsSlots([slot], turns)
  return { amounts: [{ currency: 'USD', amount: (estimate.totalCost + (includeSetup ? target.setupCostCents ?? 0 : 0)) / 100 }] }
}

export const openaiRetainedCostBasis = (provider: string, slots: readonly Pick<AttemptSlot, 'providerText' | 'turnIds'>[], turns: readonly Pick<AttemptTurn, 'canonical' | 'effectiveControls'>[]) => provider === 'openai' ? { openaiTtsEstimate: estimateOpenAITtsSlots(slots, turns) } : {}

// Binary speech has no verified usage schema. Accept only our native-unit estimate
// receipt; unknown usage fields, missing counters and corrupt receipts cannot become
// authoritative usage or non-finite costs.
export const readOpenAITtsEstimate = (value: unknown): ReturnType<typeof estimateOpenAITtsCost> | undefined => {
  if (!value || typeof value !== 'object') return undefined
  const data = value as Record<string, unknown>
  const rates = openAITtsRates()
  if (data['rateIdentity'] !== rates.rateIdentity || data['inputCostPer1MTokensCents'] !== rates.inputCostPer1MTokensCents || data['outputCostPer1MAudioTokensCents'] !== rates.outputCostPer1MAudioTokensCents || typeof data['estimateProvenance'] !== 'string' || !data['estimateProvenance'].startsWith('Heuristic:')) return undefined
  for (const key of ['requestCount', 'estimatedTextTokens', 'estimatedAudioTokens', 'estimatedDurationSeconds', 'totalCost']) if (typeof data[key] !== 'number' || !Number.isFinite(data[key]) || data[key] < 0) return undefined
  if (!Number.isSafeInteger(data['requestCount']) || !Number.isSafeInteger(data['estimatedTextTokens']) || !Number.isSafeInteger(data['estimatedAudioTokens'])) return undefined
  const expected = ((data['estimatedTextTokens'] as number) * rates.inputCostPer1MTokensCents + (data['estimatedAudioTokens'] as number) * rates.outputCostPer1MAudioTokensCents) / 1e6
  if (Math.abs(expected - (data['totalCost'] as number)) > 1e-9) return undefined
  return data as ReturnType<typeof estimateOpenAITtsCost>
}

export const estimateOpenAITtsSlots = (slots: readonly Pick<AttemptSlot, 'providerText' | 'turnIds'>[], turns: readonly Pick<AttemptTurn, 'canonical' | 'effectiveControls'>[]): ReturnType<typeof estimateOpenAITtsCost> => {
  const costs = slots.map(slot => {
    const controls = turns.find(turn => turn.canonical.turnId === slot.turnIds[0])?.effectiveControls ?? {}
    return estimateOpenAITtsCost([...slot.providerText].length, { textBytes: Buffer.byteLength(slot.providerText), requestCount: 1, instructions: controls['instructions'] as string | undefined, speed: controls['speed'] as number | undefined })
  })
  const first = costs[0] ?? estimateOpenAITtsCost(0)
  return { ...first, requestCount: slots.length, estimatedTextTokens: costs.reduce((sum, cost) => sum + cost.estimatedTextTokens!, 0), estimatedAudioTokens: costs.reduce((sum, cost) => sum + cost.estimatedAudioTokens!, 0), estimatedDurationSeconds: costs.reduce((sum, cost) => sum + cost.estimatedDurationSeconds!, 0), totalCost: costs.reduce((sum, cost) => sum + cost.totalCost, 0) }
}
