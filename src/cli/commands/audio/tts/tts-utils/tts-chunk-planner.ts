import type { PlannedTtsChunk, TtsChunkBoundary, TtsChunkingOptions } from '~/types'
import { splitTextIntoChunks } from './audio-utils'

const CLOSERS = `["'”’)\\]]*`
const SENTENCE_END = new RegExp(`[.!?…]${CLOSERS}$`, 'u')
const CLAUSE_END = new RegExp(`[,;:—–]${CLOSERS}$`, 'u')
const BOUNDARY_RANK: Record<Exclude<TtsChunkBoundary, 'end'>, number> = { paragraph: 0, sentence: 1, clause: 2, word: 3, hard: 4 }
const MIN_WINDOW_RATIO = 0.6
const MAX_INLINE_TAG_LENGTH = 120

export const resolveTtsChunkMaxChars = (limit: number, chunking?: TtsChunkingOptions | undefined): number =>
  chunking?.maxChars !== undefined ? Math.max(1, Math.min(limit, chunking.maxChars)) : limit

const classifySeam = (chunkText: string, separator: string, hardCut: boolean): TtsChunkBoundary => {
  if (hardCut) return 'hard'
  if (separator.includes('\n')) return 'paragraph'
  if (SENTENCE_END.test(chunkText)) return 'sentence'
  if (CLAUSE_END.test(chunkText)) return 'clause'
  return 'word'
}

const insideInlineTag = (text: string, index: number): boolean => {
  const open = text.lastIndexOf('[', index - 1)
  if (open < 0 || text.lastIndexOf(']', index - 1) > open) return false
  const close = text.indexOf(']', index)
  return close >= 0 && close - open <= MAX_INLINE_TAG_LENGTH
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

const planSmartChunks = (text: string, maxChars: number): PlannedTtsChunk[] => {
  const chunks: PlannedTtsChunk[] = []
  let remaining = text.trim()
  while (remaining.length > maxChars) {
    const cut = selectSmartCut(remaining, maxChars)
    const chunkText = remaining.slice(0, cut.index).trim()
    const rest = remaining.slice(cut.index)
    const separator = /^\s+/u.exec(rest)?.[0] ?? ''
    if (chunkText) chunks.push({ text: chunkText, boundaryAfter: classifySeam(chunkText, separator, cut.hardCut) })
    remaining = rest.trimStart()
  }
  if (remaining) chunks.push({ text: remaining, boundaryAfter: 'end' })
  return chunks
}

const planLegacyChunks = (text: string, maxChars: number): PlannedTtsChunk[] => {
  const texts = splitTextIntoChunks(text, maxChars)
  let cursor = 0
  return texts.map((chunkText, index) => {
    const start = text.indexOf(chunkText, cursor)
    const end = start < 0 ? cursor : start + chunkText.length
    cursor = end
    if (index === texts.length - 1) return { text: chunkText, boundaryAfter: 'end' as const }
    const separator = /^\s+/u.exec(text.slice(end))?.[0] ?? ''
    return { text: chunkText, boundaryAfter: classifySeam(chunkText, separator, separator.length === 0) }
  })
}

export const planTtsChunks = (text: string, limit: number, chunking?: TtsChunkingOptions | undefined): PlannedTtsChunk[] => {
  const maxChars = resolveTtsChunkMaxChars(limit, chunking)
  return chunking?.boundary === 'smart' ? planSmartChunks(text, maxChars) : planLegacyChunks(text, maxChars)
}

export const splitTtsText = (text: string, limit: number, chunking?: TtsChunkingOptions | undefined): string[] =>
  planTtsChunks(text, limit, chunking).map((chunk) => chunk.text)
