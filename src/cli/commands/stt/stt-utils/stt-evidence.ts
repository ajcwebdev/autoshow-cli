import { resolveCaptionWordCoverage } from '../workflows/captions/caption-word-coverage'
import type { TranscriptionEvidence, TranscriptionEvidenceCapabilities, TranscriptionEvidenceSegment, TranscriptionEvidenceTimingQuality, TranscriptionEvidenceWord, TranscriptionSegment } from '~/types'
export const buildTranscriptionWordEvidence = (options: {
  words: TranscriptionEvidenceWord[]
  segments?: TranscriptionSegment[] | undefined
  evidenceSegments?: TranscriptionEvidenceSegment[] | undefined
  rawResponse?: unknown
}): TranscriptionEvidence => {
  const segments = options.segments ?? []
  const evidenceSegments = options.evidenceSegments ?? []
  const seen = new Set<string>()
  const words = options.words.filter(word => {
    const key = JSON.stringify([word.startSeconds, word.endSeconds, word.text, word.speaker])
    if (!word.text.trim() || !Number.isFinite(word.startSeconds) || !Number.isFinite(word.endSeconds) || word.startSeconds < 0 || word.endSeconds < word.startSeconds || seen.has(key)) return false
    seen.add(key)
    return true
  }).map(word => {
    const { confidence, ...rest } = word
    return { ...rest, ...(typeof confidence === 'number' && Number.isFinite(confidence) && confidence >= 0 && confidence <= 1 ? { confidence } : {}) }
  })
  const coverage = resolveCaptionWordCoverage({ text: segments.map(segment => segment.text).join(' '), segments, evidence: { words, ...(evidenceSegments.length ? { segments: evidenceSegments } : {}) } })
  const complete = coverage.inferredWords === 0 && !coverage.uncoveredText && coverage.invalidWords === 0

  return {
    ...(evidenceSegments.length > 0 ? { segments: evidenceSegments } : {}),
    ...(words.length > 0 ? { words } : {}),
    capabilities: {
      hasNativeWordTiming: words.some(word => word.timingSource === 'native' || word.timingSource === 'token_derived'),
      hasConfidence: words.some((word) => typeof word.confidence === 'number')
        || evidenceSegments.some((segment) => typeof segment.confidence === 'number'),
      hasSpeakerLabels: words.some((word) => word.speaker !== undefined)
        || evidenceSegments.some((segment) => segment.speaker !== undefined)
        || segments.some((segment) => segment.speaker !== undefined)
    },
    timingQuality: complete && words.length > 0 && words.every(word => word.timingSource === 'aligned') ? 'aligned' : complete && words.length > 0 && words.every(word => word.timingSource === 'native' || word.timingSource === 'token_derived') ? 'native_word' : words.length > 0 ? 'mixed' : 'segment_interpolated',
    ...(options.rawResponse !== undefined ? { rawResponse: options.rawResponse } : {})
  }
}

export const mergeTranscriptionEvidence = (
  evidences: Array<TranscriptionEvidence | undefined>
): TranscriptionEvidence | undefined => {
  const defined = evidences.filter((value): value is TranscriptionEvidence => value !== undefined)
  if (defined.length === 0) {
    return undefined
  }

  const segments = defined.flatMap((evidence) => evidence.segments ?? [])
  const words = defined.flatMap((evidence) => evidence.words ?? [])
  const mergedCapabilities: Partial<TranscriptionEvidenceCapabilities> = {
    hasNativeWordTiming: defined.some((evidence) => evidence.capabilities?.hasNativeWordTiming === true || evidence.words?.some((word) => word.timingSource === 'native')),
    hasConfidence: defined.some((evidence) => evidence.capabilities?.hasConfidence === true || evidence.words?.some((word) => typeof word.confidence === 'number') || evidence.segments?.some((segment) => typeof segment.confidence === 'number')),
    hasSpeakerLabels: defined.some((evidence) => evidence.capabilities?.hasSpeakerLabels === true || evidence.words?.some((word) => typeof word.speaker === 'string') || evidence.segments?.some((segment) => typeof segment.speaker === 'string'))
  }

  const timingQuality: TranscriptionEvidenceTimingQuality = defined.length === evidences.length && defined.every(evidence => evidence.timingQuality === 'native_word' && (evidence.words?.length ?? 0) > 0)
    ? 'native_word'
    : defined.length === evidences.length && defined.every(evidence => evidence.timingQuality === 'aligned' && (evidence.words?.length ?? 0) > 0) ? 'aligned'
    : words.length > 0 ? 'mixed'
    : defined.every(evidence => evidence.timingQuality === 'generated') ? 'generated'
    : defined.some(evidence => evidence.timingQuality === 'segment_interpolated') ? 'segment_interpolated' : 'coarse'

  return {
    ...(segments.length > 0 ? { segments } : {}),
    ...(words.length > 0 ? { words } : {}),
    chunkEvidence: defined,
    capabilities: mergedCapabilities,
    timingQuality
  }
}
