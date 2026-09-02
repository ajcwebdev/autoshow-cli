import type { BuildPromptOptions, TranscriptionResult, VideoMetadata } from '~/types'
import { formatTranscriptText } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import * as l from '~/utils/app-logger/app-logger'

const TRANSCRIPT_PREAMBLE = `This is a transcript with timestamps. Do not include advertisements in the summaries or descriptions. Do not actually write the transcript.`

export const buildPrompt = (
  metadata: VideoMetadata,
  transcription: TranscriptionResult,
  instruction: string,
  slug?: string,
  options?: BuildPromptOptions
): string => {
  const taskInstruction = instruction

  const frontmatterFields = [
    `title: "${metadata.title}"`,
    slug ? `slug: "${slug}"` : '',
    `duration: "${metadata.duration}"`,
    metadata.channel ? `channel: "${metadata.channel}"` : '',
    `url: "${metadata.url}"`,
    metadata.publishDate ? `publishDate: "${metadata.publishDate}"` : '',
    metadata.thumbnail ? `thumbnail: "${metadata.thumbnail}"` : '',
    metadata.channelURL ? `channelURL: "${metadata.channelURL}"` : '',
    metadata.description ? `description: "${metadata.description}"` : '',
  ].filter(Boolean).join('\n')

  const frontmatter = `---\n${frontmatterFields}\n---`

  const hasSpeakers = transcription.segments.some(seg => seg.speaker)
  if (hasSpeakers) {
    const uniqueSpeakers = new Set(transcription.segments.map(seg => seg.speaker).filter(s => s))
    const details = [
      `${uniqueSpeakers.size} detected speaker${uniqueSpeakers.size === 1 ? '' : 's'}`,
      typeof options?.requestedSpeakerCount === 'number'
        ? `requested hint: ${options.requestedSpeakerCount}`
        : undefined,
      options?.promptSourceProvider ? `source: ${options.promptSourceProvider}` : undefined
    ].filter((entry): entry is string => typeof entry === 'string')
    if (options?.suppressDiarizationLog !== true) {
      l.write('info', `Prompt diarization detected ${uniqueSpeakers.size} speakers`, {
        category: 'pipeline',
        metadata: {
          detectedSpeakers: uniqueSpeakers.size,
          requestedSpeakerCount: options?.requestedSpeakerCount,
          sourceProvider: options?.promptSourceProvider,
          details
        }
      })
    }
  }

  const transcriptWithTimestamps = formatTranscriptText(transcription.segments, { precision: 'seconds' })

  return `${frontmatter}

${TRANSCRIPT_PREAMBLE}

${taskInstruction}

Transcript:
${transcriptWithTimestamps}`
}
