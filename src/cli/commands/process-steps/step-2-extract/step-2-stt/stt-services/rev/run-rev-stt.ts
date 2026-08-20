import { basename } from 'node:path'
import type { AsyncSttLifecycleHooks, AsyncSttLifecycleMetrics, DiarizationOptions, RevJob, RevTranscriptResponse, Step2Metadata, SttRequestMetrics, TranscriptionResult, TranscriptionSegment } from '~/types'
import {
  RevJobSchema,
  RevTranscriptResponseSchema
} from '~/types'
import {
  buildTranscriptionOutputBase,
  countTokens,
  formatSpeakerLabel,
  formatTranscriptText,
  resolveTranscriptionOutput,
  toTimestamp
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import { buildTranscriptionWordEvidence } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-evidence'
import { buildAsyncSttPollingDeadlineError, buildAsyncSttResumeProbeError, deleteSttRemoteResource, runAsyncSttJobLifecycle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/async-lifecycle'
import { lifecycleMetricsToCallbacks, sttStageRequest, sttStageRequestWithRetryAfter } from '../stt-stage-request'
import { getRevBaseUrl } from './rev'
import { requireApiKey } from '~/utils/validate/env-utils'

const INITIAL_POLL_INTERVAL_MS = 2000
const MAX_POLL_INTERVAL_MS = 10000
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000
const POLL_REQUEST_TIMEOUT_MS = 60 * 1000

const buildRevUrl = (baseURL: string, path: string): string =>
  new URL(path.replace(/^\/+/, ''), baseURL.endsWith('/') ? baseURL : `${baseURL}/`).toString()

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

const getTranscript = async (
  baseURL: string,
  accessToken: string,
  jobId: string,
  metrics?: SttRequestMetrics | undefined
): Promise<RevTranscriptResponse> => await sttStageRequest({
  operationName: 'rev-get-transcript',
  stage: 'transcript',
  retryClass: 'runtime_http_read',
  timeoutMs: POLL_REQUEST_TIMEOUT_MS,
  errorPrefix: 'Rev',
  schema: RevTranscriptResponseSchema,
  schemaLabel: 'Rev transcript response',
  metrics,
  doFetch: (signal) => fetch(buildRevUrl(baseURL, `/jobs/${jobId}/transcript`), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.rev.transcript.v1.0+json'
    },
    signal: signal ?? null
  })
})

const deleteJob = async (
  baseURL: string,
  accessToken: string,
  jobId: string
): Promise<boolean> => await deleteSttRemoteResource({
  url: buildRevUrl(baseURL, `/jobs/${jobId}`),
  apiKey: accessToken,
  provider: 'rev',
  artifact: 'job',
  id: jobId
})

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

const createRevJob = async (
  baseURL: string,
  accessToken: string,
  audioPath: string,
  modelName: string,
  metrics: AsyncSttLifecycleMetrics
): Promise<{ jobId: string, status: RevJob }> => {
  const createResponse = await sttStageRequest({
    operationName: 'rev-create-job',
    stage: 'create',
    retryClass: 'runtime_http_create_retriable',
    timeoutMs: REQUEST_TIMEOUT_MS,
    errorPrefix: 'Rev',
    schema: RevJobSchema,
    schemaLabel: 'Rev create job response',
    metrics: lifecycleMetricsToCallbacks(metrics),
    doFetch: (signal) => fetch(buildRevUrl(baseURL, '/jobs'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: buildCreateForm(audioPath, modelName),
      signal: signal ?? null
    })
  })

  return { jobId: createResponse.id, status: createResponse }
}

const pollRevJob = async (
  baseURL: string,
  accessToken: string,
  jobId: string,
  metrics: AsyncSttLifecycleMetrics
): Promise<{ status: RevJob, retryAfterMs: number | null }> => {
  const { value, retryAfterMs } = await sttStageRequestWithRetryAfter({
    operationName: 'rev-poll-job',
    stage: 'poll',
    retryClass: 'runtime_http_read',
    timeoutMs: POLL_REQUEST_TIMEOUT_MS,
    errorPrefix: 'Rev',
    schema: RevJobSchema,
    schemaLabel: 'Rev job status response',
    metrics: lifecycleMetricsToCallbacks(metrics),
    doFetch: (signal) => fetch(buildRevUrl(baseURL, `/jobs/${jobId}`), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      signal: signal ?? null
    })
  })

  return { status: value, retryAfterMs }
}

export const runRevStt = async (
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
  const accessToken = requireApiKey('REVAI_ACCESS_TOKEN', 'stt:rev', 'Rev transcription')

  const {
    model: modelName,
    segmentOffsetMinutes = 0,
    segmentNumber,
    totalSegments,
    audioDurationSeconds,
    runMode,
    lifecycle
  } = options
  const baseURL = getRevBaseUrl()
  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)

  return await runAsyncSttJobLifecycle<RevJob, RevTranscriptResponse>({
    outputDir,
    providerService: 'rev',
    providerLogLabel: 'rev',
    providerDisplayName: 'Rev',
    modelName,
    startTime,
    runMode,
    lifecycle,
    audioDurationSeconds,
    initialPollIntervalMs: INITIAL_POLL_INTERVAL_MS,
    maxPollIntervalMs: MAX_POLL_INTERVAL_MS,
    segment: { segmentNumber, totalSegments },
    createJob: async (metrics) => await createRevJob(baseURL, accessToken, audioPath, modelName, metrics),
    pollJob: async (jobId, metrics) => await pollRevJob(baseURL, accessToken, jobId, metrics),
    getTranscript: async (jobId, metrics) => await getTranscript(baseURL, accessToken, jobId, lifecycleMetricsToCallbacks(metrics)),
    isComplete: (status) => status.status === 'transcribed',
    isFailed: (status) => status.status === 'failed' ? buildFailedJobMessage(status) : undefined,
    buildDeadlineError: (jobId, pollDeadlineMs, cause) => buildAsyncSttPollingDeadlineError('Rev', jobId, pollDeadlineMs, cause),
    buildResumeProbeError: (jobId, probeCount, totalWaitMs, cause) => buildAsyncSttResumeProbeError('Rev', 'job', jobId, probeCount, totalWaitMs, cause),
    cleanup: {
      deleteJob: async (jobId) => await deleteJob(baseURL, accessToken, jobId),
      shouldDelete: ({ metadata, lastKnownStatus }) =>
        metadata !== undefined || lastKnownStatus?.status === 'transcribed' || lastKnownStatus?.status === 'failed'
    },
    buildResult: async ({ transcript, runtime, processingTime, timings }) => {
      const transcriptOutput = normalizeTranscriptOutput(transcript, offsetSeconds)
      const evidenceWords = evidenceWordsFromTranscript(transcript, offsetSeconds)
      const { finalSegments, finalText } = resolveTranscriptionOutput(
        transcriptOutput.segments,
        transcriptOutput.text,
        offsetSeconds
      )

      await Bun.write(`${outputBase}.txt`, formatTranscriptText(finalSegments))

      const metadata: Step2Metadata = {
        transcriptionService: 'rev',
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
