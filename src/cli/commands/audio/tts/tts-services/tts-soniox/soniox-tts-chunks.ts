import type { TtsChunkingOptions } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { splitTtsText } from '../../tts-utils/tts-chunk-planner'

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

// The REST duration cap is fixed. This ceiling is a heuristic with headroom, not a duration guarantee.
export const splitSonioxTtsText = (text: string, chunking?: TtsChunkingOptions): string[] =>
  splitTtsText(text, 500, { ...chunking, boundary: 'smart' }, preserveSonioxBoundary)
