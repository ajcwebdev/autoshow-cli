import type { TranscriptionEvidenceWord } from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { captionTextKey } from './caption-word-coverage'

// Ordered lexical matching keeps repeated words distinct. The identical-text fast
// path is linear; divergent long transcripts must be evaluated in bounded spans.
export const matchTimedWords = (reference: TranscriptionEvidenceWord[], candidate: TranscriptionEvidenceWord[]): Array<[number, number]> => {
  const left = reference.map(word => captionTextKey(word.text)), right = candidate.map(word => captionTextKey(word.text))
  if (left.length === right.length && left.every((word, index) => word === right[index])) return left.map((_, index) => [index, index])
  const width = right.length + 1
  if ((left.length + 1) * width > 20_000_000) throw ValidationError('Timing comparison exceeds 20 million alignment cells. Evaluate divergent transcripts in shorter matching excerpts.')
  const directions = new Uint8Array((left.length + 1) * width)
  let previous = new Uint32Array(width)
  for (let i = 1; i <= left.length; i++) {
    const current = new Uint32Array(width)
    for (let j = 1; j <= right.length; j++) {
      if (left[i - 1] && left[i - 1] === right[j - 1]) { current[j] = previous[j - 1]! + 1; directions[i * width + j] = 1 }
      else if (previous[j]! >= current[j - 1]!) { current[j] = previous[j]!; directions[i * width + j] = 2 }
      else { current[j] = current[j - 1]!; directions[i * width + j] = 3 }
    }
    previous = current
  }
  const pairs: Array<[number, number]> = []
  let i = left.length, j = right.length
  while (i > 0 && j > 0) {
    const direction = directions[i * width + j]
    if (direction === 1) { pairs.push([--i, --j]) }
    else if (direction === 2) i--
    else j--
  }
  return pairs.reverse()
}

export const validateMeasuredWords = (words: TranscriptionEvidenceWord[], label: string): void => {
  if (!words.length) throw ValidationError(`${label} requires saved word evidence; segment interpolation is not an acoustic measurement.`)
  if (words.some(word => !captionTextKey(word.text) || !Number.isFinite(word.startSeconds) || !Number.isFinite(word.endSeconds) || word.startSeconds < 0 || word.endSeconds <= word.startSeconds)) throw ValidationError(`${label} contains empty words or invalid word boundaries.`)
}

const distribution = (values: number[]) => {
  const ordered = values.toSorted((a, b) => a - b)
  const quantile = (p: number): number | null => {
    if (!ordered.length) return null
    const index = (ordered.length - 1) * p, low = Math.floor(index), high = Math.ceil(index)
    return ordered[low]! + (ordered[high]! - ordered[low]!) * (index - low)
  }
  return { medianMs: quantile(.5), p95Ms: quantile(.95), maximumMs: ordered.at(-1) ?? null }
}

export const evaluateWordTiming = (reference: TranscriptionEvidenceWord[], candidate: TranscriptionEvidenceWord[]) => {
  validateMeasuredWords(reference, 'Reference')
  validateMeasuredWords(candidate, 'Candidate')
  const pairs = matchTimedWords(reference, candidate)
  const matched = pairs.map(([referenceIndex, candidateIndex]) => {
    const expected = reference[referenceIndex]!, actual = candidate[candidateIndex]!
    return { referenceIndex, candidateIndex, text: expected.text,
      startErrorMs: (actual.startSeconds - expected.startSeconds) * 1000,
      endErrorMs: (actual.endSeconds - expected.endSeconds) * 1000,
      referenceStartSeconds: expected.startSeconds,
      referenceConfidence: expected.confidence ?? null,
      speakerMatches: expected.speaker === undefined ? null : expected.speaker === actual.speaker,
      timingSource: actual.timingSource }
  })
  const speakerWords = matched.filter(word => word.speakerMatches !== null)
  const bands = [50, 100, 250].map(toleranceMs => ({ toleranceMs, fraction: matched.length ? matched.filter(word => Math.abs(word.startErrorMs) <= toleranceMs + 1e-6 && Math.abs(word.endErrorMs) <= toleranceMs + 1e-6).length / matched.length : null }))
  const windows = new Map<number, typeof matched>()
  const referenceIndices = new Set(pairs.map(pair => pair[0])), candidateIndices = new Set(pairs.map(pair => pair[1]))
  for (const word of matched) { const minute = Math.floor(word.referenceStartSeconds / 60); const window = windows.get(minute) ?? []; window.push(word); windows.set(minute, window) }
  return {
    schemaVersion: 1, referenceWords: reference.length, candidateWords: candidate.length, matchedWords: matched.length,
    referenceCoverage: matched.length / reference.length, candidateCoverage: matched.length / candidate.length,
    unmatchedReferenceIndices: reference.flatMap((_, index) => referenceIndices.has(index) ? [] : [index]),
    unmatchedCandidateIndices: candidate.flatMap((_, index) => candidateIndices.has(index) ? [] : [index]),
    lowConfidenceReferenceWords: reference.filter(word => word.confidence !== undefined && word.confidence < .1).length,
    startAbsoluteError: distribution(matched.map(word => Math.abs(word.startErrorMs))),
    endAbsoluteError: distribution(matched.map(word => Math.abs(word.endErrorMs))), withinTolerance: bands,
    speakerAttribution: { comparedWords: speakerWords.length, accuracy: speakerWords.length ? speakerWords.filter(word => word.speakerMatches).length / speakerWords.length : null, policy: 'Exact canonical speaker labels; apply a reviewed speaker map before comparison.' },
    driftByMinute: [...windows].map(([minute, words]) => ({ minute, matchedWords: words.length, meanStartErrorMs: words.reduce((sum, word) => sum + word.startErrorMs, 0) / words.length, meanEndErrorMs: words.reduce((sum, word) => sum + word.endErrorMs, 0) / words.length })),
    candidateTimingSources: Object.fromEntries([...new Set(candidate.map(word => word.timingSource))].map(source => [source, candidate.filter(word => word.timingSource === source).length])), matched
  }
}
