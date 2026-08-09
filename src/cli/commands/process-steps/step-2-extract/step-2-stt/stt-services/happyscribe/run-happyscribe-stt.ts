import type { AsyncSttLifecycleHooks, AsyncSttLifecycleMetrics, HappyScribeExport, HappyScribeOrder, HappyScribeTranscription, RetryClass, Step2Metadata, TranscriptionResult } from '~/types'
import {
  buildAsyncSttPollingDeadlineError,
  buildAsyncSttResumeProbeError,
  pollAsyncSttJobUntilComplete,
  runAsyncSttJobLifecycle
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/async-lifecycle'
import {
  buildTranscriptionOutputBase,
  countTokens,
  formatTranscriptText
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import {
  buildHappyScribeOrganizationResolutionError,
  getHappyScribeBaseUrl,
  resolveHappyScribeOrganizationSelection
} from './happyscribe'
import { createHappyScribeApiClient } from './happyscribe-api'
import { buildHappyScribeRegistryEstimate } from './happyscribe-pricing'
import {
  buildHappyScribeOrderFailureMessage,
  resolveHappyScribeOrderTranscriptionId
} from './happyscribe-response-parsers'
import {
  attachHappyScribeErrorContext,
  getHappyScribeErrorStatus
} from './happyscribe-utils'
import { parseHappyScribeTranscriptPayload } from './parse-happyscribe-transcript'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { requireApiKey } from '~/utils/validate/env-utils'

const INITIAL_POLL_INTERVAL_MS = 1_000
const MAX_POLL_INTERVAL_MS = 10_000

const buildExportDeadlineError = (
  exportId: string,
  pollDeadlineMs: number
): never => {
  const error = Object.assign(
    new Error(`Happy Scribe timed out waiting for export completion for ${exportId} (deadline exceeded after ${pollDeadlineMs}ms)`),
    {
      stage: 'result',
      retryClass: 'runtime_http_read' as RetryClass,
      retryable: true
    }
  )
  throw error
}

const buildBillingMetadata = (
  modelName: string,
  audioDurationSeconds: number | undefined,
  order: HappyScribeOrder,
  transcription: HappyScribeTranscription
): Step2Metadata['billing'] | undefined => {
  const totalCost = order.details?.currency === 'usd'
    ? order.details.totalCents ?? transcription.costInCents
    : undefined
  const creditsUsed = order.details?.currency === 'usd'
    ? order.details.totalCredits
    : undefined

  if (typeof totalCost === 'number' && Number.isFinite(totalCost) && totalCost >= 0) {
    const billing: NonNullable<Step2Metadata['billing']> = {
      totalCost,
      source: 'provider_quote',
      mode: 'order'
    }
    if (typeof creditsUsed === 'number' && Number.isFinite(creditsUsed) && creditsUsed >= 0) {
      billing.creditsUsed = creditsUsed
      if (creditsUsed > 0) {
        billing.creditRateCents = totalCost / creditsUsed
      }
    }
    return billing
  }

  if (typeof audioDurationSeconds === 'number' && Number.isFinite(audioDurationSeconds) && audioDurationSeconds >= 0) {
    return {
      totalCost: buildHappyScribeRegistryEstimate(modelName, audioDurationSeconds),
      source: 'registry_fallback',
      mode: 'duration'
    }
  }

  return undefined
}

export const runHappyScribeStt = async (
  audioPath: string,
  outputDir: string,
  options: {
    model: string
    happyscribeOrganizationId?: string | undefined
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
    happyscribeOrganizationId,
    segmentOffsetMinutes = 0,
    segmentNumber,
    totalSegments,
    audioDurationSeconds,
    runMode,
    lifecycle
  } = options
  const apiKey = requireApiKey('HAPPYSCRIBE_API_KEY', 'stt:happyscribe', 'Happy Scribe transcription')
  const baseURL = getHappyScribeBaseUrl()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)
  const startTime = Date.now()
  let billing: Step2Metadata['billing'] | undefined
  let lifecycleMetrics: AsyncSttLifecycleMetrics | undefined

  const apiClient = createHappyScribeApiClient({
    apiKey,
    baseURL,
    onRequest: () => {
      if (lifecycleMetrics) lifecycleMetrics.requestCount += 1
    },
    onRetry: (error) => {
      if (!lifecycleMetrics) return
      lifecycleMetrics.retryCount += 1
      if (getHappyScribeErrorStatus(error) === 429) {
        lifecycleMetrics.rateLimitCount += 1
      }
    }
  })

  const organizationSelection = await resolveHappyScribeOrganizationSelection({
    preferredOrganizationId: happyscribeOrganizationId
  })
  if (!organizationSelection.selected) {
    throw buildHappyScribeOrganizationResolutionError(organizationSelection)
  }
  const selectedOrganization = organizationSelection.selected
  if (selectedOrganization.currency && selectedOrganization.currency !== 'usd') {
    throw InfraError([
      `Happy Scribe organization ${selectedOrganization.id}${selectedOrganization.name ? ` (${selectedOrganization.name})` : ''} reports currency ${selectedOrganization.currency}, but v1 execution supports exact-cost capture only for usd organizations.`,
      `Organizations: ${organizationSelection.organizations.length > 0 ? organizationSelection.organizations.map((organization) => `${organization.id}${organization.name ? ` "${organization.name}"` : ''}${organization.currency ? ` currency=${organization.currency}` : ''}`).join(', ') : 'none'}.`,
      'Pass --stt-happyscribe-organization-id <id> or save defaults.extract.stt.happyscribeOrganizationId with bun autoshow config.'
    ].join(' '), { stage: 'stt:happyscribe' })
  }

  return await runAsyncSttJobLifecycle<HappyScribeOrder, TranscriptionResult, string>({
    outputDir,
    providerService: 'happyscribe',
    providerLogLabel: 'happyscribe',
    providerDisplayName: 'Happy Scribe',
    modelName,
    startTime,
    runMode,
    lifecycle,
    audioDurationSeconds,
    initialPollIntervalMs: INITIAL_POLL_INTERVAL_MS,
    maxPollIntervalMs: MAX_POLL_INTERVAL_MS,
    segment: { segmentNumber, totalSegments },
    jobNoun: 'order',
    guardStage: 'stt:happyscribe',
    persistCompletedProgress: true,
    extendProgressMetadata: () => billing ? { billing } : {},
    uploadAsset: async (metrics) => {
      lifecycleMetrics = metrics
      let uploadUrl: string | undefined
      try {
        uploadUrl = await apiClient.getSignedUploadUrl(audioPath)
        await apiClient.uploadMedia(uploadUrl, audioPath)
      } catch (error) {
        attachHappyScribeErrorContext(error, 'upload', 'runtime_http_create_retriable')
      }
      if (!uploadUrl) {
        throw ValidationError('Happy Scribe signed upload response missing signedUrl', { stage: 'stt:happyscribe' })
      }
      return { value: uploadUrl, remoteAssetUrl: uploadUrl }
    },
    createJob: async (metrics, upload) => {
      lifecycleMetrics = metrics
      if (!upload) {
        throw ValidationError('Happy Scribe signed upload response missing signedUrl', { stage: 'stt:happyscribe' })
      }

      let createdOrder: HappyScribeOrder | undefined
      try {
        createdOrder = await apiClient.createOrder({
          audioPath,
          uploadUrl: upload.value,
          organizationId: selectedOrganization.id
        })
      } catch (error) {
        attachHappyScribeErrorContext(error, 'create', 'runtime_http_create_retriable')
      }
      if (!createdOrder) {
        throw ValidationError('Happy Scribe order creation did not return an order id', { stage: 'stt:happyscribe' })
      }
      return { jobId: createdOrder.id, status: createdOrder }
    },
    pollJob: async (jobId, metrics) => {
      lifecycleMetrics = metrics
      return await apiClient.pollOrder(jobId)
    },
    getTranscript: async (_jobId, metrics, completedOrder) => {
      lifecycleMetrics = metrics
      const transcriptionId = resolveHappyScribeOrderTranscriptionId(completedOrder)
      if (!transcriptionId) {
        throw ValidationError('Happy Scribe order completed without a transcription identifier', { stage: 'stt:happyscribe' })
      }

      let transcription: HappyScribeTranscription | undefined
      try {
        transcription = await apiClient.getTranscription(transcriptionId)
      } catch (error) {
        return attachHappyScribeErrorContext(error, 'result', 'runtime_http_read')
      }
      if (!transcription) {
        throw InfraError('Happy Scribe transcription lookup did not return transcription metadata', { stage: 'stt:happyscribe' })
      }

      billing = buildBillingMetadata(modelName, audioDurationSeconds, completedOrder, transcription)

      if (transcription.downloadUrl) {
        try {
          const structuredPayload = await apiClient.fetchDownloadPayload(transcription.downloadUrl)
          return parseHappyScribeTranscriptPayload(structuredPayload, { offsetSeconds })
        } catch {
          // Fall through to the export workflow when the direct artifact is absent or transiently unavailable.
        }
      }

      let exportRecord: HappyScribeExport | undefined
      try {
        exportRecord = await apiClient.createExport(transcription.id ?? transcriptionId)
        metrics.createCount += 1
        const activeExportId = exportRecord.id
        const exportPollResult = await pollAsyncSttJobUntilComplete({
          jobId: activeExportId,
          initialPollIntervalMs: INITIAL_POLL_INTERVAL_MS,
          maxPollIntervalMs: MAX_POLL_INTERVAL_MS,
          audioDurationSeconds,
          buildDeadlineError: (jobId, pollDeadlineMs) => buildExportDeadlineError(jobId, pollDeadlineMs),
          poll: async () => await apiClient.pollExport(activeExportId),
          isComplete: (exportStatus) => exportStatus.state === 'ready',
          isFailed: (exportStatus) =>
            exportStatus.state === 'failed' || exportStatus.state === 'expired'
              ? `Happy Scribe export ${exportStatus.id} failed in state "${exportStatus.state}"`
              : undefined,
          withPollSlot: lifecycle?.withPollSlot
        })

        metrics.pollSleepMs += exportPollResult.pollSleepMs
        metrics.pollCount += exportPollResult.pollCount
        exportRecord = exportPollResult.status
        if (!exportRecord.downloadLink) {
          throw ValidationError('Happy Scribe export completed without download_link', { stage: 'stt:happyscribe' })
        }

        const structuredPayload = await apiClient.fetchDownloadPayload(exportRecord.downloadLink)
        return parseHappyScribeTranscriptPayload(structuredPayload, { offsetSeconds })
      } catch (error) {
        return attachHappyScribeErrorContext(error, 'result', 'runtime_http_read')
      }
    },
    isComplete: (order) => order.state === 'fulfilled',
    isFailed: (order) => order.state === 'failed' || order.state === 'locked'
      ? buildHappyScribeOrderFailureMessage(order)
      : undefined,
    buildDeadlineError: (jobId, pollDeadlineMs) => buildAsyncSttPollingDeadlineError('Happy Scribe', jobId, pollDeadlineMs),
    buildResumeProbeError: (jobId, probeCount, totalWaitMs) => buildAsyncSttResumeProbeError('Happy Scribe', 'order', jobId, probeCount, totalWaitMs),
    buildResult: async ({ transcript: result, runtime, processingTime, timings }) => {
      await Bun.write(`${outputBase}.txt`, formatTranscriptText(result.segments))

      return {
        result,
        metadata: {
          transcriptionService: 'happyscribe',
          transcriptionModel: modelName,
          processingTime,
          tokenCount: countTokens(result.text),
          runtime,
          ...(billing ? { billing } : {}),
          ...(timings ? { timings } : {})
        }
      }
    }
  })
}
