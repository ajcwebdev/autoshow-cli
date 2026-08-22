import * as l from '~/utils/app-logger/app-logger'
import type { AsyncSttLifecycleHooks, Step2Metadata, SupadataJobStatus, SupadataTranscriptPayload, TranscriptionResult } from '~/types'
import { logSttTranscriptOutput } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import {
  buildTranscriptionOutputBase,
  countTokens,
  formatTranscriptText
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import {
  buildAsyncSttPollingDeadlineError,
  buildAsyncSttResumeProbeError,
  readPersistedAsyncSttProgressMetadata,
  runAsyncSttJobLifecycle
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/async-lifecycle'
import { lifecycleMetricsToCallbacks } from '../stt-stage-request'
import { getSupadataBaseUrl, isSupadataSupportedSourceUrl } from './supadata'
import { requireApiKey } from '~/utils/validate/env-utils'
import { InfraError, ProviderError } from '~/utils/error-handler'
import { getSupadataCreditRateCents } from '~/cli/commands/pricing-orchestration/supadata-pricing'
import {
  fetchSupadataTranscript,
  pollSupadataTranscriptJob
} from './supadata-api'
import {
  extractSupadataErrorMessage,
  parseSupadataJobPayload,
  parseSupadataTranscriptPayload
} from './supadata-response-parsers'
import {
  attachSupadataErrorContext,
  buildSupadataUnsupportedSourceError,
  parsePersistedSupadataBilling,
  parseSupadataBillableRequests
} from './supadata-utils'
import { normalizeSupadataTranscript } from './parse-supadata-transcript'

const INITIAL_POLL_INTERVAL_MS = 1_000
const MAX_POLL_INTERVAL_MS = 10_000

export const runSupadataStt = async (
  _audioPath: string,
  outputDir: string,
  options: {
    model: string
    sourceUrl?: string | undefined
    language?: string | undefined
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
    audioDurationSeconds?: number | undefined
    runMode?: 'initial' | 'backfill' | undefined
    lifecycle?: AsyncSttLifecycleHooks | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const {
    model: modelName,
    sourceUrl,
    language,
    segmentOffsetMinutes = 0,
    segmentNumber,
    totalSegments,
    audioDurationSeconds,
    runMode,
    lifecycle
  } = options

  if (typeof sourceUrl !== 'string' || sourceUrl.length === 0 || sourceUrl.startsWith('file:')) {
    throw buildSupadataUnsupportedSourceError(sourceUrl)
  }
  if (!isSupadataSupportedSourceUrl(sourceUrl)) {
    throw buildSupadataUnsupportedSourceError(sourceUrl)
  }

  const apiKey = requireApiKey('SUPADATA_API_KEY', 'stt:supadata', 'Supadata transcription')
  const baseURL = getSupadataBaseUrl()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)

  const persistedProgressMetadata = await readPersistedAsyncSttProgressMetadata(lifecycle, {
    transcriptionService: 'supadata',
    transcriptionModel: modelName
  }, segmentNumber)
  const persistedBilling = persistedProgressMetadata
    ? parsePersistedSupadataBilling(persistedProgressMetadata)
    : undefined
  let billedCredits = persistedBilling?.creditsUsed
  let creditRateCents = persistedBilling?.creditRateCents ?? getSupadataCreditRateCents()
  let billingSource = persistedBilling?.source

  const captureCreateBilling = (headers: Headers): void => {
    const credits = parseSupadataBillableRequests(headers)
    if (credits === undefined) return
    billedCredits = credits
    creditRateCents = getSupadataCreditRateCents()
    billingSource = 'response_header'
  }

  const buildBillingMetadata = (): Step2Metadata['billing'] | undefined => {
    if (typeof billedCredits !== 'number' && !billingSource) return undefined
    const billing: NonNullable<Step2Metadata['billing']> = {
      ...(typeof creditRateCents === 'number' ? { creditRateCents } : {}),
      ...(typeof billedCredits === 'number' ? { creditsUsed: billedCredits } : {}),
      ...(billingSource ? { source: billingSource } : {})
    }
    return Object.keys(billing).length > 0 ? billing : undefined
  }

  const providerPayloadError = (
    message: string,
    stage: 'create' | 'poll',
    retryClass: 'runtime_http_create_retriable' | 'runtime_http_read',
    rawResponse: unknown,
    retryable?: false | undefined
  ): Error => Object.assign(
    ProviderError(message, { stage, retryClass, ...(retryable === false ? { retryable } : {}) }),
    { stage, retryClass, ...(retryable === false ? { retryable } : {}), rawResponse }
  )

  return await runAsyncSttJobLifecycle<SupadataJobStatus, SupadataTranscriptPayload>({
    outputDir,
    providerService: 'supadata',
    providerLogLabel: 'supadata',
    providerDisplayName: 'Supadata',
    jobNoun: 'transcript job',
    guardStage: 'stt:supadata',
    modelName,
    startTime: Date.now(),
    runMode,
    lifecycle,
    audioDurationSeconds,
    initialPollIntervalMs: INITIAL_POLL_INTERVAL_MS,
    maxPollIntervalMs: MAX_POLL_INTERVAL_MS,
    segment: { segmentNumber, totalSegments },
    persistCompletedProgress: true,
    extendProgressMetadata: () => {
      const billing = buildBillingMetadata()
      return billing ? { billing } : {}
    },
    createJob: async (metrics) => {
      let createResult: Awaited<ReturnType<typeof fetchSupadataTranscript>> | undefined
      try {
        createResult = await fetchSupadataTranscript({
          baseURL,
          apiKey,
          sourceUrl,
          modelName,
          language,
          metrics: lifecycleMetricsToCallbacks(metrics)
        })
      } catch (error) {
        attachSupadataErrorContext(error, 'create', 'runtime_http_create_retriable')
      }
      if (!createResult) {
        throw InfraError('Supadata transcript request did not return a response', { stage: 'stt:supadata' })
      }
      captureCreateBilling(createResult.headers)

      if (createResult.status === 202) {
        const jobPayload = parseSupadataJobPayload(createResult.payload)
        if (!jobPayload) {
          throw providerPayloadError('Supadata returned 202 without a jobId', 'create', 'runtime_http_create_retriable', createResult.payload)
        }
        return { jobId: jobPayload.jobId }
      }

      const transcriptPayload = parseSupadataTranscriptPayload(createResult.payload)
      if (!transcriptPayload) {
        throw providerPayloadError('Supadata returned an invalid transcript payload', 'create', 'runtime_http_create_retriable', createResult.payload, false)
      }
      return { kind: 'completed', transcript: transcriptPayload }
    },
    pollJob: async (jobId, metrics) => {
      let polled: Awaited<ReturnType<typeof pollSupadataTranscriptJob>> | undefined
      try {
        polled = await pollSupadataTranscriptJob({
          baseURL,
          apiKey,
          jobId,
          metrics: lifecycleMetricsToCallbacks(metrics)
        })
      } catch (error) {
        attachSupadataErrorContext(error, 'poll', 'runtime_http_read')
      }
      if (!polled) {
        throw InfraError('Supadata polling did not return a job status', { stage: 'stt:supadata' })
      }
      return polled
    },
    isComplete: (status) => status.status === 'completed',
    isFailed: (status) => {
      if (status.status !== 'failed') return undefined
      return extractSupadataErrorMessage(status.error) ?? extractSupadataErrorMessage(status.message) ?? 'Supadata transcription failed'
    },
    buildDeadlineError: (jobId, pollDeadlineMs, cause) => buildAsyncSttPollingDeadlineError('Supadata', jobId, pollDeadlineMs, cause),
    buildResumeProbeError: (jobId, probeCount, totalWaitMs, cause) => buildAsyncSttResumeProbeError('Supadata', 'transcript job', jobId, probeCount, totalWaitMs, cause),
    getTranscript: async (_jobId, _metrics, finalStatus) => {
      const transcriptPayload = parseSupadataTranscriptPayload({
        content: finalStatus.content ?? '',
        ...(finalStatus.lang ? { lang: finalStatus.lang } : {}),
        ...(finalStatus.availableLangs ? { availableLangs: finalStatus.availableLangs } : {})
      })
      if (!transcriptPayload) {
        throw providerPayloadError('Supadata completed job without transcript content', 'poll', 'runtime_http_read', finalStatus)
      }
      return transcriptPayload
    },
    buildResult: async ({ transcript, runtime, processingTime, timings }) => {
      const result = normalizeSupadataTranscript(transcript, offsetSeconds)
      await Bun.write(`${outputBase}.txt`, formatTranscriptText(result.segments))
      logSttTranscriptOutput(l, {
        provider: 'supadata',
        path: `${outputBase}.txt`,
        characters: result.text.length
      })

      const billing = buildBillingMetadata()
      return {
        result,
        metadata: {
          transcriptionService: 'supadata',
          transcriptionModel: modelName,
          processingTime,
          tokenCount: countTokens(result.text),
          ...(timings ? { timings } : {}),
          ...(runtime ? { runtime } : {}),
          ...(billing ? { billing } : {})
        }
      }
    }
  })
}
