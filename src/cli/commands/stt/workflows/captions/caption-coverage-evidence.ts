import type { TranscriptionEvidenceWord, TranscriptionResult } from '~/types'

export const captionTextKey = (text: string): string => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

export const captionTimestampSeconds = (stamp: string): number => {
  const parts = stamp.replace(',', '.').split(':').map(Number)
  if (parts.length !== 3 || parts.some(part => !Number.isFinite(part) || part < 0) || parts[1]! >= 60 || parts[2]! >= 60) return Number.NaN
  return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!
}

export const filterNativeCaptionWords = (result: TranscriptionResult) => {
  let invalidWords = 0
  const seen = new Set<string>()
  const native = (result.evidence?.words ?? []).filter(word => {
    if (!word.text.trim() || !Number.isFinite(word.startSeconds) || !Number.isFinite(word.endSeconds) || word.startSeconds < 0 || word.endSeconds <= word.startSeconds) {
      invalidWords++
      return false
    }
    const key = JSON.stringify([word.startSeconds, word.endSeconds, word.text, word.speaker])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a, b) => a.startSeconds - b.startSeconds || a.endSeconds - b.endSeconds)

  return { native, invalidWords }
}

export const selectCaptionTimedSegments = (result: TranscriptionResult) => {
  const segments = (result.evidence?.segments?.length ? result.evidence.segments.map(segment => ({
    start: segment.startSeconds, end: segment.endSeconds, text: segment.text, speaker: segment.speaker
  })) : result.segments.map(segment => ({
    start: captionTimestampSeconds(segment.start), end: captionTimestampSeconds(segment.end), text: segment.text, speaker: segment.speaker
  })))
  return segments
}

export type CaptionTimedSegment = ReturnType<typeof selectCaptionTimedSegments>[number]

const captionNativeWordLowerBound = (native: TranscriptionEvidenceWord[], time: number): number => {
    let low = 0, high = native.length
    while (low < high) {
      const mid = (low + high) >>> 1
      if (native[mid]!.startSeconds < time) low = mid + 1
      else high = mid
    }
    return low
  }

export const selectCaptionSegmentWords = (native: TranscriptionEvidenceWord[], segment: CaptionTimedSegment, used: ReadonlySet<TranscriptionEvidenceWord>): TranscriptionEvidenceWord[] => {
    const candidates = native.slice(captionNativeWordLowerBound(native, segment.start - 0.002), captionNativeWordLowerBound(native, segment.end)).filter(word => !used.has(word) && (!segment.speaker || !word.speaker || word.speaker === segment.speaker))
  return candidates
}

export const hasUncoveredCaptionText = (result: TranscriptionResult, words: TranscriptionEvidenceWord[]): boolean => {
  // Compare as a multiset so overlapping speakers don't fail due to ordering.
  const remaining = new Map<string, number>()
  for (const token of result.text.match(/\S+/gu) ?? []) {
    const key = captionTextKey(token)
    if (key) remaining.set(key, (remaining.get(key) ?? 0) + 1)
  }
  for (const word of words) for (const token of word.text.match(/\S+/gu) ?? []) {
    const key = captionTextKey(token)
    remaining.set(key, Math.max(0, (remaining.get(key) ?? 0) - 1))
  }
  return [...remaining.values()].some(count => count > 0)
}
