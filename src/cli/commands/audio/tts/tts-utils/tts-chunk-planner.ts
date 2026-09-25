import type { PlannedTtsChunk, TtsChunkBoundary, TtsChunkingOptions } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { replaySavedTtsChunks } from './tts-saved-chunk-replay'

const CLOSERS = `["'”’)\\]]*`
const SENTENCE_END = new RegExp(`[.!?…]${CLOSERS}$`, 'u')
const CLAUSE_END = new RegExp(`[,;:—–]${CLOSERS}$`, 'u')
const BOUNDARY_RANK: Record<Exclude<TtsChunkBoundary, 'end'>, number> = { paragraph: 0, sentence: 1, clause: 2, word: 3, hard: 4 }
const MIN_WINDOW_RATIO = 0.6

export const resolveTtsChunkMaxChars = (limit: number, chunking?: TtsChunkingOptions | undefined): number => {
  const requested = chunking?.maxChars ?? limit
  if (!Number.isFinite(limit) || !Number.isFinite(requested) || limit < 1 || requested < 1) throw UsageError('TTS chunk budget must be a positive number.')
  return Math.floor(Math.min(limit, requested))
}

const isSentenceEnd = (text: string): boolean => {
  if (!SENTENCE_END.test(text)) return false
  const bare = text.replace(/["'”’)\]]+$/u, '')
  // Titles, initials, decimals, and common dotted abbreviations are unsafe sentence cuts.
  return !/(?:\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|a\.m|p\.m)|\b[A-Z]|\b(?:[A-Za-z]\.)+[A-Za-z]|\d)\.$/u.test(bare)
}

const classifySeam = (chunkText: string, separator: string, hardCut: boolean): TtsChunkBoundary => {
  if (hardCut) return 'hard'
  if (separator.includes('\n')) return 'paragraph'
  if (isSentenceEnd(chunkText)) return 'sentence'
  if (CLAUSE_END.test(chunkText)) return 'clause'
  return 'word'
}

const insideInlineTag = (text: string, index: number): boolean => {
  const open = text.lastIndexOf('[', index - 1)
  if (open < 0 || text.lastIndexOf(']', index - 1) > open) return false
  const close = text.indexOf(']', index)
  return close >= 0
}

export const preserveTtsInlineBoundary = (text: string, index: number, limit: number, pairs: readonly (readonly [string, string])[] = [['[', ']']]): number => {
  for (const [open, close] of pairs) {
    const start = text.lastIndexOf(open, index - 1), end = text.indexOf(close, index)
    if (start < 0 || text.lastIndexOf(close, index - 1) > start || end < 0) continue
    if (start > 0) return start
    if (end + 1 <= limit) return end + 1
    throw UsageError('TTS inline notation exceeds the available chunk budget; shorten the notation or increase --tts-chunk-size.')
  }
  if (splitsSurrogatePair(text, index)) {
    if (index === 1) throw UsageError('TTS chunk size is too small for a complete Unicode character.')
    return index - 1
  }
  return index
}

const splitsSurrogatePair = (text: string, index: number): boolean => {
  const before = text.charCodeAt(index - 1)
  return before >= 0xd800 && before <= 0xdbff
}

const selectSmartCut = (remaining: string, maxChars: number): { index: number, hardCut: boolean } => {
  const parts = Math.ceil(remaining.length / maxChars)
  const target = Math.min(maxChars, Math.ceil(remaining.length / parts))
  const lowest = Math.max(1, Math.floor(target * MIN_WINDOW_RATIO))
  let best: { index: number, rank: number, distance: number } | undefined
  for (let index = lowest; index <= maxChars && index < remaining.length; index += 1) {
    if (!/\s/u.test(remaining[index] as string) || /\s/u.test(remaining[index - 1] as string)) continue
    if (insideInlineTag(remaining, index)) continue
    const separator = /^\s+/u.exec(remaining.slice(index))?.[0] ?? ''
    const rank = BOUNDARY_RANK[classifySeam(remaining.slice(0, index), separator, false) as Exclude<TtsChunkBoundary, 'end'>]
    const distance = Math.abs(index - target)
    if (!best || rank < best.rank || (rank === best.rank && distance < best.distance)) best = { index, rank, distance }
  }
  if (best) return { index: best.index, hardCut: false }
  let index = Math.min(maxChars, remaining.length - 1)
  if (splitsSurrogatePair(remaining, index)) index -= 1
  return { index: Math.max(1, index), hardCut: true }
}

const planSmartChunks = (text: string, maxChars: number, adjustBoundary?: (text: string, index: number, limit: number) => number): PlannedTtsChunk[] => {
  const chunks: PlannedTtsChunk[] = []
  let remaining = text.trim()
  while (remaining.length > maxChars) {
    const cut = selectSmartCut(remaining, maxChars)
    cut.index = (adjustBoundary ?? preserveTtsInlineBoundary)(remaining, cut.index, maxChars)
    if (cut.index < 1 || cut.index > maxChars) throw UsageError('TTS chunk policy produced an invalid boundary.')
    const chunkText = remaining.slice(0, cut.index).trim()
    const rest = remaining.slice(cut.index)
    const separator = /^\s+/u.exec(rest)?.[0] ?? ''
    if (chunkText) chunks.push({ text: chunkText, boundaryAfter: classifySeam(chunkText, separator, cut.hardCut) })
    remaining = rest.trimStart()
  }
  if (remaining) chunks.push({ text: remaining, boundaryAfter: 'end' })
  return chunks
}

export const planTtsChunks = (text: string, limit: number, chunking?: TtsChunkingOptions | undefined, adjustBoundary?: (text: string, index: number, limit: number) => number): PlannedTtsChunk[] => {
  const maxChars = resolveTtsChunkMaxChars(limit, chunking)
  return chunking?.replay ? replaySavedTtsChunks(text, maxChars, chunking.replay, adjustBoundary) : planSmartChunks(text, maxChars, adjustBoundary)
}

export const splitTtsText = (text: string, limit: number, chunking?: TtsChunkingOptions | undefined, adjustBoundary?: (text: string, index: number, limit: number) => number): string[] =>
  planTtsChunks(text, limit, chunking, adjustBoundary).map((chunk) => chunk.text)
