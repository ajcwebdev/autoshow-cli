import { basename } from 'node:path'
import type { RevJob, RevTranscriptResponse, Step2Metadata, TranscriptionResult, TranscriptionSegment } from '~/types'
import {
  RevJobSchema,
  RevTranscriptResponseSchema
} from '~/types'
import { formatSpeakerLabel, toTimestamp } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import type { HttpAsyncSttRunOptions } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/http-async-stt-provider'
import { runHttpAsyncSttProvider } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/http-async-stt-provider'
import { getRevBaseUrl } from './rev'
import { resolveRestPath } from '~/utils/rest-client'

const INITIAL_POLL_INTERVAL_MS = 2000
const MAX_POLL_INTERVAL_MS = 10000

const buildCreateForm = (
  audioPath: string,
  modelName: string
): FormData => {
  const form = new FormData()
  form.append('media', Bun.file(audioPath), basename(audioPath))
  form.append('options', JSON.stringify({
    transcriber: modelName,
    remove_disfluencies: true
  }))
  return form
}

const buildFailedJobMessage = (job: RevJob): string => {
  if (typeof job.failure_detail === 'string' && job.failure_detail.length > 0) {
    return `Rev transcription failed: ${job.failure_detail}`
  }

  if (typeof job.failure === 'string' && job.failure.length > 0) {
    return `Rev transcription failed: ${job.failure}`
  }

  return 'Rev transcription failed: job entered failed state'
}

const normalizeTranscriptOutput = (
  transcript: RevTranscriptResponse,
  offsetSeconds: number
): { text: string, segments: TranscriptionSegment[] } => {
  const segments: TranscriptionSegment[] = []
  const texts: string[] = []

  for (const monologue of transcript.monologues) {
    let currentText = ''
    let segmentStart: number | null = null
    let segmentEnd: number | null = null

    for (const element of monologue.elements) {
      if (element.type !== 'text' && element.type !== 'punct') {
        continue
      }

      currentText += element.value

      if (segmentStart === null && typeof element.ts === 'number') {
        segmentStart = element.ts
      }
      if (typeof element.end_ts === 'number') {
        segmentEnd = element.end_ts
      }
    }

    const text = currentText.replace(/\s+/g, ' ').trim()
    if (text.length === 0) {
      continue
    }

    texts.push(text)

    const start = segmentStart ?? segmentEnd ?? 0
    const end = segmentEnd ?? segmentStart ?? start
    const speaker = formatSpeakerLabel(monologue.speaker)
    segments.push({
      start: toTimestamp(start + offsetSeconds),
      end: toTimestamp(end + offsetSeconds),
      text,
      ...(speaker ? { speaker } : {})
    })
  }

  return {
    text: texts.join(' ').trim(),
    segments
  }
}

const evidenceWordsFromTranscript = (
  transcript: RevTranscriptResponse,
  offsetSeconds: number
) => transcript.monologues
  .flatMap((monologue) => monologue.elements.map((element) => {
    if ((element.type !== 'text' && element.type !== 'punct') || typeof element.ts !== 'number' || typeof element.end_ts !== 'number') {
      return null
    }

    const text = element.value.trim()
    if (text.length === 0) {
      return null
    }

    return {
      startSeconds: element.ts + offsetSeconds,
      endSeconds: element.end_ts + offsetSeconds,
      text,
      normalized: text.toLowerCase(),
      ...(formatSpeakerLabel(monologue.speaker) ? { speaker: formatSpeakerLabel(monologue.speaker) } : {}),
      ...(typeof element.confidence === 'number' ? { confidence: element.confidence } : {}),
      timingSource: 'native' as const
    }
  }))
  .filter((word): word is NonNullable<typeof word> => word !== null)

export const runRevStt = async (
  audioPath: string,
  outputDir: string,
  options: HttpAsyncSttRunOptions
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => await runHttpAsyncSttProvider({
  service: 'rev',
  displayName: 'Rev',
  credential: { envVar: 'REVAI_ACCESS_TOKEN', stage: 'stt:rev', purpose: 'Rev transcription' },
  baseUrl: getRevBaseUrl,
  resolveUrl: resolveRestPath,
  endpoints: {
    createJob: '/jobs',
    job: (jobId) => `/jobs/${jobId}`,
    transcript: (jobId) => `/jobs/${jobId}/transcript`
  },
  buildCreateForm,
  transcriptHeaders: { Accept: 'application/vnd.rev.transcript.v1.0+json' },
  pollIntervals: { initialMs: INITIAL_POLL_INTERVAL_MS, maxMs: MAX_POLL_INTERVAL_MS },
  schemas: { create: RevJobSchema, poll: RevJobSchema, transcript: RevTranscriptResponseSchema },
  readCreateResponse: (response) => ({ jobId: response.id, status: response }),
  readPollResponse: (response) => response,
  isComplete: (status) => status.status === 'transcribed',
  failureMessage: (status) => status.status === 'failed' ? buildFailedJobMessage(status) : undefined,
  isTerminal: (status) => status.status === 'transcribed' || status.status === 'failed',
  normalizeTranscript: normalizeTranscriptOutput,
  evidenceWords: evidenceWordsFromTranscript
}, audioPath, outputDir, options)
