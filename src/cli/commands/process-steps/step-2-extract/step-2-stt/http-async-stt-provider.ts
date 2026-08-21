import type { InferOutput } from 'valibot'
import type {
  AsyncSttLifecycleMetrics,
  HttpAsyncSttDescriptor,
  HttpAsyncSttRunOptions,
  Step2Metadata,
  SttRequestMetrics,
  SttStageSchema,
  TranscriptionResult
} from '~/types'
import {
  buildTranscriptionOutputBase,
  countTokens,
  formatTranscriptText,
  resolveTranscriptionOutput
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import { buildTranscriptionWordEvidence } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-evidence'
import {
  buildAsyncSttPollingDeadlineError,
  buildAsyncSttResumeProbeError,
  deleteSttRemoteResource,
  runAsyncSttJobLifecycle
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/async-lifecycle'
import { lifecycleMetricsToCallbacks, sttStageRequest, sttStageRequestWithRetryAfter } from './stt-services/stt-stage-request'
import { requireApiKey } from '~/utils/validate/env-utils'

const REQUEST_TIMEOUT_MS = 20 * 60 * 1000
const POLL_REQUEST_TIMEOUT_MS = 60 * 1000

export const runHttpAsyncSttProvider = async <
  TCreateSchema extends SttStageSchema,
  TPollSchema extends SttStageSchema,
  TTranscriptSchema extends SttStageSchema,
  TStatus
>(
  descriptor: HttpAsyncSttDescriptor<TCreateSchema, TPollSchema, TTranscriptSchema, TStatus>,
  audioPath: string,
  outputDir: string,
  options: HttpAsyncSttRunOptions
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const apiKey = requireApiKey(
    descriptor.credential.envVar,
    descriptor.credential.stage,
    descriptor.credential.purpose
  )

  const {
    model: modelName,
    segmentOffsetMinutes = 0,
    segmentNumber,
    totalSegments,
    audioDurationSeconds,
    runMode,
    lifecycle
  } = options
  const baseURL = descriptor.baseUrl()
  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)
  const url = (path: string): string => descriptor.resolveUrl(baseURL, path)
  const authHeaders = { Authorization: `Bearer ${apiKey}` }

  const getTranscript = async (
    jobId: string,
    metrics?: SttRequestMetrics | undefined
  ): Promise<InferOutput<TTranscriptSchema>> => await sttStageRequest({
    operationName: `${descriptor.service}-get-transcript`,
    stage: 'transcript',
    retryClass: 'runtime_http_read',
    timeoutMs: POLL_REQUEST_TIMEOUT_MS,
    errorPrefix: descriptor.displayName,
    schema: descriptor.schemas.transcript,
    schemaLabel: `${descriptor.displayName} transcript response`,
    metrics,
    doFetch: (signal) => fetch(url(descriptor.endpoints.transcript(jobId)), {
      method: 'GET',
      headers: { ...authHeaders, ...(descriptor.transcriptHeaders ?? {}) },
      signal: signal ?? null
    })
  })

  return await runAsyncSttJobLifecycle<TStatus, InferOutput<TTranscriptSchema>>({
    outputDir,
    providerService: descriptor.service,
    providerLogLabel: descriptor.service,
    providerDisplayName: descriptor.displayName,
    modelName,
    startTime,
    runMode,
    lifecycle,
    audioDurationSeconds,
    initialPollIntervalMs: descriptor.pollIntervals.initialMs,
    maxPollIntervalMs: descriptor.pollIntervals.maxMs,
    segment: { segmentNumber, totalSegments },
    createJob: async (metrics: AsyncSttLifecycleMetrics) => {
      const createResponse = await sttStageRequest({
        operationName: `${descriptor.service}-create-job`,
        stage: 'create',
        retryClass: 'runtime_http_create_retriable',
        timeoutMs: REQUEST_TIMEOUT_MS,
        errorPrefix: descriptor.displayName,
        schema: descriptor.schemas.create,
        schemaLabel: `${descriptor.displayName} create job response`,
        metrics: lifecycleMetricsToCallbacks(metrics),
        doFetch: (signal) => fetch(url(descriptor.endpoints.createJob), {
          method: 'POST',
          headers: authHeaders,
          body: descriptor.buildCreateForm(audioPath, modelName),
          signal: signal ?? null
        })
      })

      return descriptor.readCreateResponse(createResponse)
    },
    pollJob: async (jobId: string, metrics: AsyncSttLifecycleMetrics) => {
      const { value, retryAfterMs } = await sttStageRequestWithRetryAfter({
        operationName: `${descriptor.service}-poll-job`,
        stage: 'poll',
        retryClass: 'runtime_http_read',
        timeoutMs: POLL_REQUEST_TIMEOUT_MS,
        errorPrefix: descriptor.displayName,
        schema: descriptor.schemas.poll,
        schemaLabel: `${descriptor.displayName} job status response`,
        metrics: lifecycleMetricsToCallbacks(metrics),
        doFetch: (signal) => fetch(url(descriptor.endpoints.job(jobId)), {
          method: 'GET',
          headers: authHeaders,
          signal: signal ?? null
        })
      })

      return { status: descriptor.readPollResponse(value), retryAfterMs }
    },
    getTranscript: async (jobId, metrics) => await getTranscript(jobId, lifecycleMetricsToCallbacks(metrics)),
    isComplete: descriptor.isComplete,
    isFailed: descriptor.failureMessage,
    buildDeadlineError: (jobId, pollDeadlineMs, cause) =>
      buildAsyncSttPollingDeadlineError(descriptor.displayName, jobId, pollDeadlineMs, cause),
    buildResumeProbeError: (jobId, probeCount, totalWaitMs, cause) =>
      buildAsyncSttResumeProbeError(descriptor.displayName, 'job', jobId, probeCount, totalWaitMs, cause),
    cleanup: {
      deleteJob: async (jobId) => await deleteSttRemoteResource({
        url: url(descriptor.endpoints.job(jobId)),
        apiKey,
        provider: descriptor.service,
        artifact: 'job',
        id: jobId
      }),
      shouldDelete: ({ metadata, lastKnownStatus }) =>
        metadata !== undefined || (lastKnownStatus !== undefined && descriptor.isTerminal(lastKnownStatus))
    },
    buildResult: async ({ transcript, runtime, processingTime, timings }) => {
      const transcriptOutput = descriptor.normalizeTranscript(transcript, offsetSeconds)
      const evidenceWords = descriptor.evidenceWords(transcript, offsetSeconds)
      const { finalSegments, finalText } = resolveTranscriptionOutput(
        transcriptOutput.segments,
        transcriptOutput.text,
        offsetSeconds
      )

      await Bun.write(`${outputBase}.txt`, formatTranscriptText(finalSegments))

      const metadata: Step2Metadata = {
        transcriptionService: descriptor.service,
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
