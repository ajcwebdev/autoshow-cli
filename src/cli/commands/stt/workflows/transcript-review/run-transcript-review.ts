import { formatTranscriptText } from '../../stt-utils/stt-utils'
import { prepareTranscriptEditArtifacts } from './transcript-edit-application'
import { prepareTranscriptReview } from './transcript-review-preparation'
import { publishTranscriptReview } from './transcript-review-publication'

export const runTranscriptReview = async (input: string | undefined, editsPath?: string): Promise<void> => {
  const prepared = await prepareTranscriptReview(input)
  const { result, words, sourceSha256, output, review } = prepared
  const artifacts: Record<string, string> = {}
  if (!editsPath) {
    artifacts['transcript-review.json'] = JSON.stringify(review, null, 2) + '\n'
    artifacts['edits.json'] = JSON.stringify({ schemaVersion: 1, sourceSha256, edits: [] }, null, 2) + '\n'
    artifacts['transcription.txt'] = formatTranscriptText(result.segments)
  } else {
    Object.assign(artifacts, await prepareTranscriptEditArtifacts(prepared, editsPath))
  }
  await publishTranscriptReview(output, artifacts, words.length)
}
