import { basename } from 'node:path'
import type { SpeechmaticsJob, SpeechmaticsTranscriptResponse, Step2Metadata, TranscriptionResult, TranscriptionSegment } from '~/types'
import {
  SpeechmaticsCreateJobResponseSchema,
  SpeechmaticsJobResponseSchema,
  SpeechmaticsTranscriptResponseSchema
} from '~/types'
import { appendToken, toTimestamp } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import type { HttpAsyncSttRunOptions } from '~/types'
import { runHttpAsyncSttProvider } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/http-async-stt-provider'
import { getSpeechmaticsBaseUrl } from './speechmatics'

const INITIAL_POLL_INTERVAL_MS = 1000
const MAX_POLL_INTERVAL_MS = 10000

const buildSpeechmaticsUrl = (baseURL: string, path: string): string =>
  new URL(path, baseURL).toString()

export const buildSpeechmaticsTranscriptionConfig = (
  modelName: string
): Record<string, unknown> => ({
  type: 'transcription',
  transcription_config: {
    model: modelName,
    language: modelName === 'melia-1' ? 'multi' : 'auto',
    diarization: 'speaker'
  }
})

const buildCreateForm = (
  audioPath: string,
  modelName: string
): FormData => {
  const form = new FormData()
  form.append('data_file', Bun.file(audioPath), basename(audioPath))
  form.append('config', JSON.stringify(buildSpeechmaticsTranscriptionConfig(modelName)))
  return form
}

const buildRejectedJobMessage = (job: SpeechmaticsJob): string => {
  if (typeof job.error === 'string' && job.error.length > 0) {
    return `Speechmatics transcription failed: ${job.error}`
  }

  const message = job.errors
    ?.map((entry) => entry.message)
    .find((value): value is string => typeof value === 'string' && value.length > 0)
  if (message) {
    return `Speechmatics transcription failed: ${message}`
  }

  return 'Speechmatics transcription failed: job was rejected'
}

const toTranscriptOutput = (
  transcript: SpeechmaticsTranscriptResponse,
  offsetSeconds: number
): { text: string, segments: TranscriptionSegment[] } => {
  const tokens = transcript.results.flatMap((result) => {
    if (result.type !== 'word' && result.type !== 'punctuation') {
      return []
    }

    const alternative = result.alternatives[0]
    if (!alternative || alternative.content.length === 0) {
      return []
    }

    return [{
      start: result.start_time,
      end: result.end_time,
      text: alternative.content,
      speaker: typeof alternative.speaker === 'string' && alternative.speaker.length > 0
        ? alternative.speaker
        : undefined,
      isEos: result.is_eos === true
    }]
  })

  const segments: TranscriptionSegment[] = []
  let text = ''
  let currentText = ''
  let currentSpeaker: string | undefined
  let segmentStart: number | null = null
  let segmentEnd: number | null = null

  const flush = (): void => {
    const trimmed = currentText.trim()
    if (trimmed.length === 0) {
      currentText = ''
      currentSpeaker = undefined
      segmentStart = null
      segmentEnd = null
      return
    }

    const start = segmentStart ?? 0
    const end = segmentEnd ?? start
    segments.push({
      start: toTimestamp(start + offsetSeconds),
      end: toTimestamp(end + offsetSeconds),
      text: trimmed,
      ...(currentSpeaker ? { speaker: currentSpeaker } : {})
    })

    currentText = ''
    currentSpeaker = undefined
    segmentStart = null
    segmentEnd = null
  }

  for (const token of tokens) {
    text = appendToken(text, token.text)

    if (currentText.trim().length > 0 && token.speaker && currentSpeaker && token.speaker !== currentSpeaker) {
      flush()
    }

    if (segmentStart === null) {
      segmentStart = token.start
    }
    segmentEnd = token.end

    if (currentSpeaker === undefined && token.speaker !== undefined) {
      currentSpeaker = token.speaker
    }

    currentText = appendToken(currentText, token.text)

    if (token.isEos) {
      flush()
    }
  }

  flush()

  return {
    text: text.trim(),
    segments
  }
}

const evidenceWordsFromTranscript = (
  transcript: SpeechmaticsTranscriptResponse,
  offsetSeconds: number
) => transcript.results
  .map((result) => {
    if (result.type !== 'word' && result.type !== 'punctuation') {
      return null
    }

    const alternative = result.alternatives[0]
    if (!alternative || alternative.content.trim().length === 0) {
      return null
    }

    return {
      startSeconds: result.start_time + offsetSeconds,
      endSeconds: result.end_time + offsetSeconds,
      text: alternative.content,
      normalized: alternative.content.toLowerCase(),
      ...(typeof alternative.speaker === 'string' && alternative.speaker.length > 0 ? { speaker: alternative.speaker } : {}),
      ...(typeof alternative.confidence === 'number' ? { confidence: alternative.confidence } : {}),
      timingSource: 'native' as const
    }
  })
  .filter((word): word is NonNullable<typeof word> => word !== null)

export const runSpeechmaticsStt = async (
  audioPath: string,
  outputDir: string,
  options: HttpAsyncSttRunOptions
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => await runHttpAsyncSttProvider({
  service: 'speechmatics',
  displayName: 'Speechmatics',
  credential: { envVar: 'SPEECHMATICS_API_KEY', stage: 'stt:speechmatics', purpose: 'Speechmatics transcription' },
  baseUrl: getSpeechmaticsBaseUrl,
  resolveUrl: buildSpeechmaticsUrl,
  endpoints: {
    createJob: '/v2/jobs',
    job: (jobId) => `/v2/jobs/${jobId}`,
    transcript: (jobId) => `/v2/jobs/${jobId}/transcript?format=json-v2`
  },
  buildCreateForm,
  pollIntervals: { initialMs: INITIAL_POLL_INTERVAL_MS, maxMs: MAX_POLL_INTERVAL_MS },
  schemas: {
    create: SpeechmaticsCreateJobResponseSchema,
    poll: SpeechmaticsJobResponseSchema,
    transcript: SpeechmaticsTranscriptResponseSchema
  },
  readCreateResponse: (response) => ({
    jobId: 'job' in response ? response.job.id : response.id,
    ...('job' in response ? { status: response.job } : {})
  }),
  readPollResponse: (response) => response.job,
  isComplete: (status) => status.status === 'done',
  failureMessage: (status) => status.status === 'rejected' ? buildRejectedJobMessage(status) : undefined,
  isTerminal: (status) => status.status === 'done' || status.status === 'rejected',
  normalizeTranscript: toTranscriptOutput,
  evidenceWords: evidenceWordsFromTranscript
}, audioPath, outputDir, options)
