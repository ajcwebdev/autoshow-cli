import type { TranscriptionEvidenceWord, TranscriptionResult } from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { formatTranscriptText } from '../../stt-utils/stt-utils'
import type { TranscriptEdit } from './transcript-edit-validation'
import { parseTranscriptEdits } from './transcript-edit-validation'
import type { PreparedTranscriptReview } from './transcript-review-preparation'

const seconds = (stamp: string): number => stamp.split(':').reduce((total, part) => total * 60 + Number(part), 0)

const assignTranscriptWordsToSegments = (words: TranscriptionEvidenceWord[], result: TranscriptionResult): number[] => {
  const segmentIndices = words.map(word => {
    const candidates = result.segments.map((segment, index) => ({ index, overlap: (!word.speaker || !segment.speaker || word.speaker === segment.speaker) ? (word.startSeconds === word.endSeconds && word.startSeconds >= seconds(segment.start) && word.startSeconds <= seconds(segment.end) ? Number.EPSILON : Math.min(word.endSeconds, seconds(segment.end)) - Math.max(word.startSeconds, seconds(segment.start))) : -1 }))
    return candidates.filter(candidate => candidate.overlap > 0).sort((a, b) => b.overlap - a.overlap)[0]?.index ?? -1
  })
  if (segmentIndices.some(index => index < 0)) throw ValidationError('Every reviewed word must belong to a timed source segment.')
  return segmentIndices
}

const applyTranscriptEdits = (edits: TranscriptEdit[], words: TranscriptionEvidenceWord[], result: TranscriptionResult) => {
  const segmentIndices = assignTranscriptWordsToSegments(words, result)
  const cleaned: { word: TranscriptionEvidenceWord; segment: number }[] = []
  const changes = []
  let cursor = 0
  for (const edit of edits) {
    for (; cursor < edit.startWord; cursor++) cleaned.push({ word: words[cursor]!, segment: segmentIndices[cursor]! })
    const selected = words.slice(edit.startWord, edit.startWord + edit.deleteCount)
    const segment = segmentIndices[edit.startWord]!
    const tokens = edit.replacement.trim() ? edit.replacement.trim().split(/\s+/) : []
    if (tokens.length && (segmentIndices.slice(edit.startWord, edit.startWord + edit.deleteCount).some(index => index !== segment) || selected.some(word => word.speaker !== selected[0]!.speaker))) throw ValidationError('A replacement cannot cross source segments or speaker turns; use separate edits. Explicit deletions may cross turns.')
    const interpolate = tokens.length !== selected.length
    const start = selected[0]!.startSeconds, end = selected.at(-1)!.endSeconds
    if (tokens.length && end <= start) throw ValidationError('Cannot assign replacement words to a zero-duration span.')
    const replacements = tokens.map((text, index): TranscriptionEvidenceWord => ({
      ...(interpolate ? selected[0]! : selected[index]!), text, normalized: text.toLowerCase(),
      startSeconds: interpolate ? start + (end - start) * index / tokens.length : selected[index]!.startSeconds,
      endSeconds: interpolate ? start + (end - start) * (index + 1) / tokens.length : selected[index]!.endSeconds,
      confidence: undefined, timingSource: interpolate ? 'interpolated' : 'repaired'
    }))
    cleaned.push(...replacements.map(word => ({ word, segment })))
    changes.push({ ...edit, originalWords: selected, replacementWords: replacements, timingMethod: !tokens.length ? 'deleted' : interpolate ? 'interpolated-within-selected-span' : 'original-boundaries' })
    cursor += edit.deleteCount
  }
  for (; cursor < words.length; cursor++) cleaned.push({ word: words[cursor]!, segment: segmentIndices[cursor]! })
  if (cleaned.some(({ word }) => !Number.isFinite(word.startSeconds) || !Number.isFinite(word.endSeconds) || word.startSeconds < 0 || word.endSeconds <= word.startSeconds)) throw ValidationError('Reviewed result still contains invalid word timing; explicitly remove or replace those words before export.')
  const segments = result.segments.map((segment, index) => ({ ...segment, text: cleaned.filter(entry => entry.segment === index).map(entry => entry.word.text).join(' ') })).filter(segment => segment.text.trim())
  if (!segments.length) throw ValidationError('Edits cannot remove the entire transcript.')
  const removedSegments = result.segments.filter((_segment, index) => !cleaned.some(entry => entry.segment === index))
  const edited = { ...result, text: segments.map(segment => segment.text).join(' '), segments, evidence: { words: cleaned.map(entry => entry.word), timingQuality: 'mixed', capabilities: { hasNativeWordTiming: cleaned.some(entry => entry.word.timingSource === 'native'), hasSpeakerLabels: cleaned.some(entry => entry.word.speaker !== undefined) } } }
  return { edited, segments, changes, removedSegments }
}

export const prepareTranscriptEditArtifacts = async (prepared: PreparedTranscriptReview, editsPath: string): Promise<Record<string, string>> => {
  const { source, sourceSha256, words, result, coverage } = prepared
  const artifacts: Record<string, string> = {}
  const packet: unknown = await Bun.file(editsPath).json()
  const edits = parseTranscriptEdits(packet, sourceSha256, words)
  const { edited, segments, changes, removedSegments } = applyTranscriptEdits(edits, words, result)
  artifacts['result.json'] = JSON.stringify(edited, null, 2) + '\n'
  artifacts['transcription.txt'] = formatTranscriptText(segments)
  artifacts['transcript-edits.json'] = JSON.stringify({ schemaVersion: 1, source, sourceSha256, sourceResultUnmodified: true, retainedSegmentTimestampsAndSpeakerLabelsPreserved: true, removedSegments, invalidSourceWords: coverage.invalidWords, inferredSourceWords: coverage.inferredWords, changes }, null, 2) + '\n'
  return artifacts
}
