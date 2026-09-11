import type { TranscriptionEvidenceWord, TranscriptionResult } from '~/types'
import { captionTextKey, filterNativeCaptionWords, hasUncoveredCaptionText, selectCaptionSegmentWords, selectCaptionTimedSegments } from './caption-coverage-evidence'
import { alignCaptionSegmentWords, interpolateCaptionSegmentWords } from './caption-evidence-alignment'

// Inferred export timing never mutates native provider measurements.
export const resolveCaptionWordCoverage = (result: TranscriptionResult): {
  words: TranscriptionEvidenceWord[]
  inferredWords: number
  invalidWords: number
  uncoveredText: boolean
} => {
  const { native, invalidWords } = filterNativeCaptionWords(result)
  if (native.length > 0 && captionTextKey(native.map(word => word.text).join(' ')) === captionTextKey(result.text)) {
    return { words: native, inferredWords: 0, invalidWords, uncoveredText: false }
  }
  const words: TranscriptionEvidenceWord[] = []
  const used = new Set<TranscriptionEvidenceWord>()
  let inferredWords = 0
  for (const segment of selectCaptionTimedSegments(result)) {
    const tokens = segment.text.match(/\S+/gu) ?? []
    if (tokens.length === 0) continue
    // Placeholder segments cannot supply timing for missing native words.
    if (!Number.isFinite(segment.start) || !Number.isFinite(segment.end) || segment.start < 0 || segment.end <= segment.start) continue
    const candidates = selectCaptionSegmentWords(native, segment, used)
    const aligned = alignCaptionSegmentWords(tokens, candidates, segment, used)
    const interpolated = interpolateCaptionSegmentWords(tokens, aligned, segment, result.evidence)
    for (const word of interpolated.words) words.push(word)
    inferredWords += interpolated.inferredWords
    // Segment text owns this span, including substitutions and punctuation.
    for (const word of candidates) used.add(word)
  }
  words.push(...native.filter(word => !used.has(word)))
  words.sort((a, b) => a.startSeconds - b.startSeconds || a.endSeconds - b.endSeconds)
  return { words, inferredWords, invalidWords, uncoveredText: hasUncoveredCaptionText(result, words) }
}

export { captionTextKey, captionTimestampSeconds } from './caption-coverage-evidence'
