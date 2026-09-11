import type { TranscriptionEvidenceWord, TranscriptionResult } from '~/types'
import type { CaptionTimedSegment } from './caption-coverage-evidence'
import { captionTextKey } from './caption-coverage-evidence'

export const alignCaptionSegmentWords = (tokens: string[], candidates: TranscriptionEvidenceWord[], segment: CaptionTimedSegment, used: Set<TranscriptionEvidenceWord>) => {
  const aligned: Array<TranscriptionEvidenceWord | undefined> = tokens.map(() => undefined)
  const tokenPositions = new Map<string, number[]>()
  tokens.forEach((token, index) => {
    const key = captionTextKey(token)
    const positions = tokenPositions.get(key) ?? []
    positions.push(index)
    tokenPositions.set(key, positions)
  })
  let cursor = 0
  for (const word of candidates) {
    const key = captionTextKey(word.text)
    if (!key) continue
    const positions = tokenPositions.get(key) ?? []
    let low = 0, high = positions.length
    while (low < high) {
      const mid = (low + high) >>> 1
      if (positions[mid]! < cursor) low = mid + 1
      else high = mid
    }
    const index = positions[low]
    if (index === undefined) continue
    aligned[index] = { ...word, text: tokens[index]!, ...(word.speaker ?? segment.speaker ? { speaker: word.speaker ?? segment.speaker } : {}) }
    cursor = index + 1
    used.add(word)
  }
  return aligned
}

export const interpolateCaptionSegmentWords = (tokens: string[], aligned: Array<TranscriptionEvidenceWord | undefined>, segment: CaptionTimedSegment, timingQuality: TranscriptionResult['evidence']) => {
  const words: TranscriptionEvidenceWord[] = []
  let inferredWords = 0
  for (let i = 0; i < tokens.length;) {
    const known = aligned[i]
    if (known) {
      words.push(known)
      i++
      continue
    }
    const startIndex = i
    while (i < tokens.length && !aligned[i]) i++
    const before = aligned[startIndex - 1]
    const after = aligned[i]
    const start = Math.max(segment.start, before?.endSeconds ?? segment.start)
    const end = Math.max(start, Math.min(segment.end, after?.startSeconds ?? segment.end))
    const count = i - startIndex
    for (let j = startIndex; j < i; j++) {
      const text = tokens[j]!
      words.push({
        startSeconds: start + (end - start) * (j - startIndex) / count,
        endSeconds: start + (end - start) * (j - startIndex + 1) / count,
        text, normalized: text.toLowerCase(), ...(segment.speaker ? { speaker: segment.speaker } : {}),
        timingSource: timingQuality?.timingQuality === 'generated' ? 'generated' : 'interpolated'
      })
      inferredWords++
    }
  }
  return { words, inferredWords }
}
