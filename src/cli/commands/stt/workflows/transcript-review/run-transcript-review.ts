import { mkdir, lstat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseStoredTranscriptionResult } from '../../stt-utils/stt-result-artifacts'
import { formatTranscriptText } from '../../stt-utils/stt-utils'
import { resolveCaptionWordCoverage } from '../captions/caption-word-coverage'
import { UsageError, ValidationError } from '~/utils/error-handler'
import { resolveRunDirectory } from '../../../command-shared/run-dir'
import { getOutputRootAbsolute } from '../../../command-shared/output-root'
import * as l from '~/utils/app-logger/app-logger'
import type { TranscriptionEvidenceWord } from '~/types'

type TranscriptEdit = { startWord: number; deleteCount: number; expectedText: string; replacement: string; reason: string }
const seconds = (stamp: string): number => stamp.split(':').reduce((total, part) => total * 60 + Number(part), 0)

export const runTranscriptReview = async (input: string | undefined, editsPath?: string): Promise<void> => {
  if (!input) throw UsageError('Transcript review requires a saved result.json file or a directory containing it.')
  let source = resolve(input)
  if ((await lstat(source)).isDirectory()) source = join(source, 'result.json')
  const raw = await Bun.file(source).text()
  const result = parseStoredTranscriptionResult(JSON.parse(raw))
  if (!result) throw ValidationError('Invalid saved transcript result.')
  const coverage = resolveCaptionWordCoverage(result)
  if (coverage.uncoveredText) throw ValidationError('Repair incomplete timed word coverage before transcript review.')
  const words = coverage.words
  const sourceSha256 = new Bun.CryptoHasher('sha256').update(raw).digest('hex')
  const output = resolve(resolveRunDirectory(getOutputRootAbsolute(), 'transcript-review', 'transcript-review'))
  const review = {
    schemaVersion: 1, source, sourceSha256,
    note: 'Edit only the edits array in edits.json. Indices address this saved word sequence. Preserve intentional speech; record uncertainty in each reason. No provider calls are made by review or apply.',
    inferredSourceWords: coverage.inferredWords,
    invalidSourceWords: coverage.invalidWords,
    invalidReviewWordIndices: words.flatMap((word, index) => word.endSeconds <= word.startSeconds ? [index] : []),
    words: words.map((word, index) => ({ index, ...word })), segments: result.segments
  }
  const files: Record<string, string> = {}
  const artifacts: Record<string, string> = {}
  if (!editsPath) {
    artifacts['transcript-review.json'] = JSON.stringify(review, null, 2) + '\n'
    artifacts['edits.json'] = JSON.stringify({ schemaVersion: 1, sourceSha256, edits: [] }, null, 2) + '\n'
    artifacts['transcription.txt'] = formatTranscriptText(result.segments)
  } else {
    const packet: unknown = await Bun.file(editsPath).json()
    if (!packet || typeof packet !== 'object' || !('sourceSha256' in packet) || packet.sourceSha256 !== sourceSha256 || !('schemaVersion' in packet) || packet.schemaVersion !== 1 || !('edits' in packet) || !Array.isArray(packet.edits)) throw ValidationError('Transcript edit file must have schemaVersion 1, matching sourceSha256, and an edits array.')
    const edits: TranscriptEdit[] = []
    for (const entry of packet.edits as unknown[]) {
      if (!entry || typeof entry !== 'object') throw ValidationError('Invalid transcript edit.')
      const edit = entry as TranscriptEdit
      if (!Number.isInteger(edit.startWord) || edit.startWord < 0 || !Number.isInteger(edit.deleteCount) || edit.deleteCount < 1 || edit.startWord + edit.deleteCount > words.length || typeof edit.expectedText !== 'string' || typeof edit.replacement !== 'string' || typeof edit.reason !== 'string' || !edit.reason.trim()) throw ValidationError('Each edit requires an in-range startWord/deleteCount, expectedText, replacement, and nonempty reason.')
      if (words.slice(edit.startWord, edit.startWord + edit.deleteCount).map(word => word.text).join(' ') !== edit.expectedText) throw ValidationError(`Transcript edit at word ${edit.startWord} does not match expectedText.`)
      edits.push(edit)
    }
    edits.sort((a, b) => a.startWord - b.startWord)
    if (edits.some((edit, index) => index > 0 && edit.startWord < edits[index - 1]!.startWord + edits[index - 1]!.deleteCount)) throw ValidationError('Transcript edits must not overlap.')
    const segmentIndices = words.map(word => {
      const candidates = result.segments.map((segment, index) => ({ index, overlap: (!word.speaker || !segment.speaker || word.speaker === segment.speaker) ? (word.startSeconds === word.endSeconds && word.startSeconds >= seconds(segment.start) && word.startSeconds <= seconds(segment.end) ? Number.EPSILON : Math.min(word.endSeconds, seconds(segment.end)) - Math.max(word.startSeconds, seconds(segment.start))) : -1 }))
      return candidates.filter(candidate => candidate.overlap > 0).sort((a, b) => b.overlap - a.overlap)[0]?.index ?? -1
    })
    if (segmentIndices.some(index => index < 0)) throw ValidationError('Every reviewed word must belong to a timed source segment.')
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
    artifacts['result.json'] = JSON.stringify(edited, null, 2) + '\n'
    artifacts['transcription.txt'] = formatTranscriptText(segments)
    artifacts['transcript-edits.json'] = JSON.stringify({ schemaVersion: 1, source, sourceSha256, sourceResultUnmodified: true, retainedSegmentTimestampsAndSpeakerLabelsPreserved: true, removedSegments, invalidSourceWords: coverage.invalidWords, inferredSourceWords: coverage.inferredWords, changes }, null, 2) + '\n'
  }
  await mkdir(output, { recursive: true })
  for (const name of Object.keys(artifacts)) if (await lstat(join(output, name)).catch(() => undefined)) throw ValidationError(`Refusing to overwrite ${join(output, name)}; choose a new --output-dir.`)
  for (const [name, text] of Object.entries(artifacts)) { await writeFile(join(output, name), text, { flag: 'wx' }); files[name] = name }
  l.report.complete(output, files, { metrics: { sourceWordCount: words.length, providerCalls: 0 } })
}
