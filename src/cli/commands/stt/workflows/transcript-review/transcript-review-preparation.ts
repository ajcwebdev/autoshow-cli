import { lstat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { UsageError, ValidationError } from '~/utils/error-handler'
import { getOutputRootAbsolute } from '../../../command-shared/output-root'
import { resolveRunDirectory } from '../../../command-shared/run-dir'
import { parseStoredTranscriptionResult } from '../../stt-utils/stt-result-artifacts'
import { resolveCaptionWordCoverage } from '../captions/caption-word-coverage'

export const prepareTranscriptReview = async (input: string | undefined) => {
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
  return { source, result, coverage, words, sourceSha256, output, review }
}

export type PreparedTranscriptReview = Awaited<ReturnType<typeof prepareTranscriptReview>>
