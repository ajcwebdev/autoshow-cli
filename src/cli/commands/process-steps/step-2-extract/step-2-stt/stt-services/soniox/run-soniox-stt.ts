import type { AsyncSttLifecycleHooks, DiarizationOptions, SonioxTranscriptResponse, SonioxTranscriptionStatus, Step2Metadata, TranscriptionResult } from '~/types'
import {
  buildTranscriptionOutputBase,
  countTokens,
  formatTranscriptText
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import {
  buildAsyncSttPollingDeadlineError,
  buildAsyncSttResumeProbeError,
  runAsyncSttJobLifecycle
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/async-lifecycle'
import { SONIOX_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { requireApiKey } from '~/utils/validate/env-utils'
import { InternalError } from '~/utils/error-handler'
import { lifecycleMetricsToCallbacks } from '../stt-stage-request'
import {
  createTranscription,
  deleteFile,
  deleteTranscription,
  getTranscriptionTranscript,
  pollTranscription,
  uploadAudio
} from './soniox-api'
import { normalizeSonioxTranscript } from './parse-soniox-transcript'

const INITIAL_POLL_INTERVAL_MS = 1000
const MAX_POLL_INTERVAL_MS = 10000

export const runSonioxStt = async (
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
  const apiKey = requireApiKey('SONIOX_API_KEY', 'stt:soniox', 'Soniox transcription')

  const {
    model: modelName,
    segmentOffsetMinutes = 0,
    segmentNumber,
    totalSegments,
    diarizationOptions,
    audioDurationSeconds,
    runMode,
    lifecycle
  } = options

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)
  const baseURL = SONIOX_DEFAULT_BASE_URL

  return await runAsyncSttJobLifecycle<SonioxTranscriptionStatus, SonioxTranscriptResponse, string>({
    outputDir,
    providerService: 'soniox',
    providerLogLabel: 'soniox',
    providerDisplayName: 'Soniox',
    modelName,
    startTime,
    runMode,
    lifecycle,
    audioDurationSeconds,
    initialPollIntervalMs: INITIAL_POLL_INTERVAL_MS,
    maxPollIntervalMs: MAX_POLL_INTERVAL_MS,
    segment: { segmentNumber, totalSegments },
    jobNoun: 'transcription',
    guardStage: 'stt:soniox',
    uploadAsset: async (metrics) => {
      const fileId = await uploadAudio(baseURL, apiKey, audioPath, lifecycleMetricsToCallbacks(metrics))
      return { value: fileId, remoteAssetId: fileId }
    },
    createJob: async (metrics, upload) => {
      if (!upload) {
        throw InternalError('Soniox upload did not produce a file id', { stage: 'stt:soniox' })
      }
      const jobId = await createTranscription(
        baseURL,
        apiKey,
        modelName,
        upload.value,
        diarizationOptions,
        lifecycleMetricsToCallbacks(metrics)
      )
      return { jobId }
    },
    pollJob: async (jobId, metrics) =>
      await pollTranscription(baseURL, apiKey, jobId, lifecycleMetricsToCallbacks(metrics)),
    getTranscript: async (jobId, metrics) =>
      await getTranscriptionTranscript(baseURL, apiKey, jobId, lifecycleMetricsToCallbacks(metrics)),
    isComplete: (status) => status.status === 'completed',
    isFailed: (status) => status.status === 'error'
      ? `Soniox transcription failed: ${status.error_message ?? status.error_type ?? 'unknown error'}`
      : undefined,
    buildDeadlineError: (jobId, pollDeadlineMs, cause) => buildAsyncSttPollingDeadlineError('Soniox', jobId, pollDeadlineMs, cause),
    buildResumeProbeError: (jobId, probeCount, totalWaitMs, cause) => buildAsyncSttResumeProbeError('Soniox', 'transcription', jobId, probeCount, totalWaitMs, cause),
    cleanup: {
      shouldDelete: ({ metadata, lastKnownStatus }) =>
        metadata !== undefined || lastKnownStatus?.status === 'completed' || lastKnownStatus?.status === 'error',
      deleteJob: async (jobId) => await deleteTranscription(baseURL, apiKey, jobId),
      deleteAsset: async (fileId) => await deleteFile(baseURL, apiKey, fileId)
    },
    buildResult: async ({ transcript, runtime, processingTime, timings }) => {
      const result = normalizeSonioxTranscript(transcript, offsetSeconds)
      await Bun.write(`${outputBase}.txt`, formatTranscriptText(result.segments))

      return {
        result,
        metadata: {
          transcriptionService: 'soniox',
          transcriptionModel: modelName,
          processingTime,
          tokenCount: countTokens(result.text),
          runtime,
          ...(timings ? { timings } : {})
        }
      }
    }
  })
}
