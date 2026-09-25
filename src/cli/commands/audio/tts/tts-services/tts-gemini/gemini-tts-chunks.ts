import type { TtsChunkingOptions } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { splitTtsText } from '../../tts-utils/tts-chunk-planner'
import { validateGeminiTurns, type GeminiSpeechTurn } from './gemini-tts-request'

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

export const splitGeminiTtsText = (model: string, turn: GeminiSpeechTurn, chunking?: TtsChunkingOptions): string[] => {
  const budget = 8192 - 512 - Buffer.byteLength(JSON.stringify([{ ...turn, text: '' }]))
  if (budget < 4) throw UsageError('Gemini style and voice metadata exhaust the 8,192 input-token budget.')
  // A UTF-16 code unit needs at most three UTF-8 bytes (escaped controls up to six).
  const limit = Math.min(2000, Math.floor(budget / 6))
  const chunks = splitTtsText(turn.text, Math.max(1, limit), chunking, preserveInlineNotation)
  for (const text of chunks) validateGeminiTurns(model, [{ ...turn, text }])
  return chunks
}
