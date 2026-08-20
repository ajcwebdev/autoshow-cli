import { basename } from 'node:path'
import type { AsyncSttLifecycleHooks, AsyncSttLifecycleMetrics, DiarizationOptions, SpeechmaticsJob, SpeechmaticsTranscriptResponse, Step2Metadata, SttRequestMetrics, TranscriptionResult, TranscriptionSegment } from '~/types'
import {
  SpeechmaticsCreateJobResponseSchema,
  SpeechmaticsJobResponseSchema,
  SpeechmaticsTranscriptResponseSchema
} from '~/types'
import {
  appendToken,
  buildTranscriptionOutputBase,
  countTokens,
  formatTranscriptText,
  resolveTranscriptionOutput,
  toTimestamp
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import { buildTranscriptionWordEvidence } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-evidence'
import { buildAsyncSttPollingDeadlineError, buildAsyncSttResumeProbeError, deleteSttRemoteResource, runAsyncSttJobLifecycle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/async-lifecycle'
import { lifecycleMetricsToCallbacks, sttStageRequest, sttStageRequestWithRetryAfter } from '../stt-stage-request'
import { getSpeechmaticsBaseUrl } from './speechmatics'
import { requireApiKey } from '~/utils/validate/env-utils'

const INITIAL_POLL_INTERVAL_MS = 1000
const MAX_POLL_INTERVAL_MS = 10000
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000
const POLL_REQUEST_TIMEOUT_MS = 60 * 1000

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

const getTranscript = async (
  baseURL: string,
  apiKey: string,
  jobId: string,
  metrics?: SttRequestMetrics | undefined
): Promise<SpeechmaticsTranscriptResponse> => await sttStageRequest({
  operationName: 'speechmatics-get-transcript',
  stage: 'transcript',
  retryClass: 'runtime_http_read',
  timeoutMs: POLL_REQUEST_TIMEOUT_MS,
  errorPrefix: 'Speechmatics',
  schema: SpeechmaticsTranscriptResponseSchema,
  schemaLabel: 'Speechmatics transcript response',
  metrics,
  doFetch: (signal) => fetch(buildSpeechmaticsUrl(baseURL, `/v2/jobs/${jobId}/transcript?format=json-v2`), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    signal: signal ?? null
  })
})

const deleteJob = async (
  baseURL: string,
  apiKey: string,
  jobId: string
): Promise<boolean> => await deleteSttRemoteResource({
  url: buildSpeechmaticsUrl(baseURL, `/v2/jobs/${jobId}`),
  apiKey,
  provider: 'speechmatics',
  artifact: 'job',
  id: jobId
})

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

const createSpeechmaticsJob = async (
  baseURL: string,
  apiKey: string,
  audioPath: string,
  modelName: string,
  metrics: AsyncSttLifecycleMetrics
): Promise<{ jobId: string, status?: SpeechmaticsJob | undefined }> => {
  const createResponse = await sttStageRequest({
    operationName: 'speechmatics-create-job',
    stage: 'create',
    retryClass: 'runtime_http_create_retriable',
    timeoutMs: REQUEST_TIMEOUT_MS,
    errorPrefix: 'Speechmatics',
    schema: SpeechmaticsCreateJobResponseSchema,
    schemaLabel: 'Speechmatics create job response',
    metrics: lifecycleMetricsToCallbacks(metrics),
    doFetch: (signal) => fetch(buildSpeechmaticsUrl(baseURL, '/v2/jobs'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: buildCreateForm(audioPath, modelName),
      signal: signal ?? null
    })
  })

  return {
    jobId: 'job' in createResponse ? createResponse.job.id : createResponse.id,
    ...('job' in createResponse ? { status: createResponse.job } : {})
  }
}

const pollSpeechmaticsJob = async (
  baseURL: string,
  apiKey: string,
  jobId: string,
  metrics: AsyncSttLifecycleMetrics
): Promise<{ status: SpeechmaticsJob, retryAfterMs: number | null }> => {
  const { value, retryAfterMs } = await sttStageRequestWithRetryAfter({
    operationName: 'speechmatics-poll-job',
    stage: 'poll',
    retryClass: 'runtime_http_read',
    timeoutMs: POLL_REQUEST_TIMEOUT_MS,
    errorPrefix: 'Speechmatics',
    schema: SpeechmaticsJobResponseSchema,
    schemaLabel: 'Speechmatics job status response',
    metrics: lifecycleMetricsToCallbacks(metrics),
    doFetch: (signal) => fetch(buildSpeechmaticsUrl(baseURL, `/v2/jobs/${jobId}`), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      signal: signal ?? null
    })
  })

  return { status: value.job, retryAfterMs }
}

export const runSpeechmaticsStt = async (
  audioPath: string,
  outputDir: string,
  options: {
    model: string
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
    diarizationOptions?: DiarizationOptions | undefined
    audioDurationSeconds?: number | undefined
    runMode?: 'initial' | 'backfill' | undefined
    lifecycle?: AsyncSttLifecycleHooks | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const apiKey = requireApiKey('SPEECHMATICS_API_KEY', 'stt:speechmatics', 'Speechmatics transcription')

  const {
    model: modelName,
    segmentOffsetMinutes = 0,
    segmentNumber,
    totalSegments,
    audioDurationSeconds,
    runMode,
    lifecycle
  } = options
  const baseURL = getSpeechmaticsBaseUrl()
  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)

  return await runAsyncSttJobLifecycle<SpeechmaticsJob, SpeechmaticsTranscriptResponse>({
    outputDir,
    providerService: 'speechmatics',
    providerLogLabel: 'speechmatics',
    providerDisplayName: 'Speechmatics',
    modelName,
    startTime,
    runMode,
    lifecycle,
    audioDurationSeconds,
    initialPollIntervalMs: INITIAL_POLL_INTERVAL_MS,
    maxPollIntervalMs: MAX_POLL_INTERVAL_MS,
    segment: { segmentNumber, totalSegments },
    createJob: async (metrics) => await createSpeechmaticsJob(baseURL, apiKey, audioPath, modelName, metrics),
    pollJob: async (jobId, metrics) => await pollSpeechmaticsJob(baseURL, apiKey, jobId, metrics),
    getTranscript: async (jobId, metrics) => await getTranscript(baseURL, apiKey, jobId, lifecycleMetricsToCallbacks(metrics)),
    isComplete: (status) => status.status === 'done',
    isFailed: (status) => status.status === 'rejected' ? buildRejectedJobMessage(status) : undefined,
    buildDeadlineError: (jobId, pollDeadlineMs, cause) => buildAsyncSttPollingDeadlineError('Speechmatics', jobId, pollDeadlineMs, cause),
    buildResumeProbeError: (jobId, probeCount, totalWaitMs, cause) => buildAsyncSttResumeProbeError('Speechmatics', 'job', jobId, probeCount, totalWaitMs, cause),
    cleanup: {
      deleteJob: async (jobId) => await deleteJob(baseURL, apiKey, jobId),
      shouldDelete: ({ metadata, lastKnownStatus }) =>
        metadata !== undefined || lastKnownStatus?.status === 'done' || lastKnownStatus?.status === 'rejected'
    },
    buildResult: async ({ transcript, runtime, processingTime, timings }) => {
      const transcriptOutput = toTranscriptOutput(transcript, offsetSeconds)
      const evidenceWords = evidenceWordsFromTranscript(transcript, offsetSeconds)
      const { finalSegments, finalText } = resolveTranscriptionOutput(
        transcriptOutput.segments,
        transcriptOutput.text,
        offsetSeconds
      )

      await Bun.write(`${outputBase}.txt`, formatTranscriptText(finalSegments))

      const metadata: Step2Metadata = {
        transcriptionService: 'speechmatics',
        transcriptionModel: modelName,
        processingTime,
        tokenCount: countTokens(finalText),
        runtime,
        ...(timings ? { timings } : {})
      }

      return {
        result: {
          text: finalText,
          segments: finalSegments,
          evidence: buildTranscriptionWordEvidence({ words: evidenceWords, segments: finalSegments, rawResponse: transcript })
        },
        metadata
      }
    }
  })
}
