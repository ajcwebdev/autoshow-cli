import type { ResolvedTtsChunk, TtsChunkingOptions, TtsProvider, TtsRequestEvidenceScope } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { planTtsChunks, preserveTtsInlineBoundary, resolveTtsChunkMaxChars } from './tts-chunk-planner'
import { resolveTtsChunkCharacterLimit } from './tts-chunk-limits'
import { validateGeminiTurns } from '../tts-services/tts-gemini/gemini-tts-request'

// Compatibility callbacks preserve the exact boundaries of older provider plans.
const preserveInlineNotation = (text: string, index: number, limit: number): number => {
  for (const [open, close] of [['<', '>'], ['[', ']']] as const) {
    const start = text.lastIndexOf(open, index - 1), end = text.indexOf(close, index)
    if (start < 0 || text.lastIndexOf(close, index - 1) > start || end < 0) continue
    if (start > 0) return start
    if (end + 1 <= limit) return end + 1
    throw UsageError('Gemini inline notation exceeds the available chunk budget; shorten the style or notation.')
  }
  // Legacy chunk boundaries must also preserve Unicode surrogate pairs.
  const preceding = text.charCodeAt(index - 1)
  if (preceding >= 0xd800 && preceding <= 0xdbff) {
    if (index === 1) throw UsageError('Gemini metadata leaves too little room for a complete Unicode character.')
    return index - 1
  }
  return index
}


const preserveSonioxBoundary = (text: string, index: number, limit: number): number => {
  const start = text.lastIndexOf('[', index - 1), end = text.indexOf(']', index)
  if (start >= 0 && text.lastIndexOf(']', index - 1) < start && end >= 0) {
    if (start > 0) return start
    if (end + 1 <= limit) return end + 1
    throw UsageError('Soniox inline tag exceeds the chunk budget; shorten the tag or increase --tts-chunk-size up to 500.')
  }
  const preceding = text.charCodeAt(index - 1)
  if (preceding >= 0xd800 && preceding <= 0xdbff) {
    if (index === 1) throw UsageError('Soniox chunk size is too small for a complete Unicode character.')
    return index - 1
  }
  return index
}


export type TtsChunkPolicyInput = {
  provider: TtsProvider
  model: string
  text: string
  voice?: string | undefined
  speaker?: string | undefined
  style?: string | undefined
  characterLimit?: number | undefined
  chunking?: TtsChunkingOptions | undefined
}

export type TtsProviderChunkPolicy = {
  providerMaxChars: number
  effectiveMaxChars: number
  policyVersion: ResolvedTtsChunk['policyVersion']
  chunking: TtsChunkingOptions | undefined
  adjustBoundary: (text: string, index: number, limit: number) => number
  validate: (text: string) => void
}

export const resolveTtsProviderChunkPolicy = (input: TtsChunkPolicyInput): TtsProviderChunkPolicy => {
  let providerMaxChars = resolveTtsChunkCharacterLimit(input.provider, input.model) ?? 2000
  const turn = { text: '', speaker: input.speaker ?? 'NARRATOR', voice: input.voice ?? 'Kore', ...(input.style !== undefined ? { style: input.style } : {}) }
  if (input.provider === 'gemini') {
    const budget = 8192 - 512 - Buffer.byteLength(JSON.stringify([turn]))
    if (budget < 4) throw UsageError('Gemini style and voice metadata exhaust the 8,192 input-token budget.')
    providerMaxChars = Math.max(1, Math.min(providerMaxChars, Math.floor(budget / 6)))
  }
  if (input.characterLimit !== undefined) providerMaxChars = Math.min(providerMaxChars, input.characterLimit)
  // Soniox has always used smart boundaries, including before smart became the shared default.
  const chunking = input.provider === 'soniox' && input.chunking?.replay === 'legacy-v0'
    ? { ...input.chunking, replay: 'smart-v1' as const } : input.chunking
  const effectiveMaxChars = resolveTtsChunkMaxChars(providerMaxChars, chunking)
  return {
    providerMaxChars, effectiveMaxChars, chunking, policyVersion: chunking?.replay ?? 'smart-v2',
    adjustBoundary: chunking?.replay
      ? input.provider === 'gemini' ? preserveInlineNotation : input.provider === 'soniox' ? preserveSonioxBoundary : (_text, index) => index
      : (text, index, limit) => preserveTtsInlineBoundary(text, index, limit, input.provider === 'gemini' ? [['<', '>'], ['[', ']']] : [['[', ']']]),
    validate: (text) => {
      if (text.length > effectiveMaxChars) throw UsageError('TTS request exceeds its resolved chunk budget.')
      if (input.provider === 'gemini') validateGeminiTurns(input.model, [{ ...turn, text }])
    },
  }
}

export const planProviderTtsChunks = (input: TtsChunkPolicyInput): ResolvedTtsChunk[] => {
  const policy = resolveTtsProviderChunkPolicy(input)
  let cursor = 0
  return planTtsChunks(input.text, policy.providerMaxChars, policy.chunking, policy.adjustBoundary).map(chunk => {
    policy.validate(chunk.text)
    const sourceStart = input.text.indexOf(chunk.text, cursor)
    if (sourceStart < 0) throw UsageError('TTS chunk plan lost its source position.')
    cursor = sourceStart + chunk.text.length
    return { ...chunk, sourceStart, sourceEnd: cursor, providerMaxChars: policy.providerMaxChars, effectiveMaxChars: policy.effectiveMaxChars, policyVersion: policy.policyVersion }
  })
}

// A retained plan is authoritative. Never split its slots again at transport time.
export const resolveTtsDispatchChunks = (input: TtsChunkPolicyInput, evidence?: TtsRequestEvidenceScope): string[] => {
  if (!evidence?.plannedChunks) return planProviderTtsChunks(input).map(chunk => chunk.text)
  const chunks = [...evidence.plannedChunks]
  // Provider serializers still validate native request contracts before dispatch. Saved budgets
  // may predate the current heuristic; identity checks enforce the exact authorized text.
  return chunks
}
