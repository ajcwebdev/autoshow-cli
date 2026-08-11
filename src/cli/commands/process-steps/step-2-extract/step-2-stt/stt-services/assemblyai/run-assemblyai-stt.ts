import { buildAsyncSttPollingDeadlineError, buildAsyncSttResumeProbeError, runAsyncSttJobLifecycle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/async-lifecycle'
import { logSttDiarizationConfig } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import { buildTranscriptionWordEvidence } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-evidence'
import { buildSegmentsFromWords, buildTranscriptionOutputBase, countTokens, formatTranscriptText, resolveTranscriptionOutput, toTimestamp } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import type { AsyncSttLifecycleMetrics, HostedAsyncSttRunOptions, RetryClass, Step2Metadata, SttStageHttpError, TranscriptionResult, TranscriptionSegment } from '~/types'
import { AssemblyAiTranscriptResponseSchema } from '~/types'
import { ASSEMBLYAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import * as l from '~/utils/app-logger/app-logger'
import { InternalError, ValidationError } from '~/utils/error-handler'
import { requireApiKey } from '~/utils/validate/env-utils'
import * as v from 'valibot'
import { lifecycleMetricsToCallbacks, sttStageRequest, sttStageRequestWithRetryAfter } from '../stt-stage-request'

const INITIAL_POLL_INTERVAL_MS = 1000
const MAX_POLL_INTERVAL_MS = 10000
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000
const POLL_REQUEST_TIMEOUT_MS = 60 * 1000

export const buildAssemblyAiTranscriptRequest = (
  audioUrl: string,
  model: string,
  speakerCount?: number | undefined
): Record<string, unknown> => ({
  audio_url: audioUrl,
  speech_models: [model],
  speaker_labels: true,
  ...(speakerCount === undefined ? {} : { speakers_expected: speakerCount })
})

const formatSpeaker = (speaker: string | undefined): string | undefined => {
  if (speaker === undefined || speaker.length === 0) return undefined
  return `speaker-${speaker}`
}

const attachAssemblyAiErrorContext = (
  error: unknown,
  stage: string,
  retryClass: RetryClass
): never => {
  const source = error instanceof Error ? error : new Error(String(error))
  ;(source as SttStageHttpError).stage = stage
  ;(source as SttStageHttpError).retryClass = retryClass
  throw source
}

const uploadAssemblyAiAudio = async (
  apiKey: string,
  audioPath: string,
  metrics: AsyncSttLifecycleMetrics
): Promise<string> => {
  const uploadResult = await sttStageRequest({
    operationName: 'assemblyai-upload',
    stage: 'upload',
    retryClass: 'runtime_http_create_retriable',
    maxAttempts: 4,
    timeoutMs: REQUEST_TIMEOUT_MS,
    errorPrefix: 'AssemblyAI',
    schema: v.unknown(),
    schemaLabel: 'AssemblyAI upload response',
    metrics: lifecycleMetricsToCallbacks(metrics),
    attachError: attachAssemblyAiErrorContext,
    doFetch: (signal) => fetch(`${ASSEMBLYAI_DEFAULT_BASE_URL}/v2/upload`, {
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'content-type': 'application/octet-stream'
      },
      body: Bun.file(audioPath),
      signal: signal ?? null
    })
  })

  const uploadRecord = uploadResult as Record<string, unknown> | null
  if (typeof uploadRecord !== 'object' || uploadRecord === null || typeof uploadRecord['upload_url'] !== 'string') {
    throw ValidationError('AssemblyAI upload response missing upload_url', { stage: 'stt:assemblyai' })
  }

  return uploadRecord['upload_url']
}

const createAssemblyAiTranscript = async (
  apiKey: string,
  audioUrl: string,
  modelName: string,
  speakerCount: number | undefined,
  metrics: AsyncSttLifecycleMetrics
): Promise<string> => {
  const createResult = await sttStageRequest({
    operationName: 'assemblyai-create-transcript',
    stage: 'create',
    retryClass: 'runtime_http_create_retriable',
    maxAttempts: 4,
    timeoutMs: REQUEST_TIMEOUT_MS,
    errorPrefix: 'AssemblyAI',
    failureLabel: 'transcript creation',
    schema: v.unknown(),
    schemaLabel: 'AssemblyAI transcript creation response',
    metrics: lifecycleMetricsToCallbacks(metrics),
    attachError: attachAssemblyAiErrorContext,
    doFetch: (signal) => fetch(`${ASSEMBLYAI_DEFAULT_BASE_URL}/v2/transcript`, {
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(buildAssemblyAiTranscriptRequest(audioUrl, modelName, speakerCount)),
      signal: signal ?? null
    })
  })

  const createRecord = createResult as Record<string, unknown> | null
  if (typeof createRecord !== 'object' || createRecord === null || typeof createRecord['id'] !== 'string') {
    throw ValidationError('AssemblyAI transcript creation response missing id', { stage: 'stt:assemblyai' })
  }

  return createRecord['id']
}

const pollAssemblyAiTranscript = async (
  apiKey: string,
  transcriptId: string,
  metrics: AsyncSttLifecycleMetrics
): Promise<{ status: v.InferOutput<typeof AssemblyAiTranscriptResponseSchema>, retryAfterMs: number | null }> => {
  const { value, retryAfterMs } = await sttStageRequestWithRetryAfter({
    operationName: 'assemblyai-poll-transcript',
    stage: 'poll',
    retryClass: 'runtime_http_read',
    maxAttempts: 6,
    timeoutMs: POLL_REQUEST_TIMEOUT_MS,
    errorPrefix: 'AssemblyAI',
    failureLabel: 'polling',
    schema: AssemblyAiTranscriptResponseSchema,
    schemaLabel: 'AssemblyAI transcript response',
    metrics: lifecycleMetricsToCallbacks(metrics),
    attachError: attachAssemblyAiErrorContext,
    doFetch: (signal) => fetch(`${ASSEMBLYAI_DEFAULT_BASE_URL}/v2/transcript/${transcriptId}`, {
      method: 'GET',
      headers: { 'authorization': apiKey },
      signal: signal ?? null
    })
  })

  return { status: value, retryAfterMs }
}

export const runAssemblyAiTranscribe = async (
  audioPath: string,
  outputDir: string,
  options: HostedAsyncSttRunOptions
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
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
  const apiKey = requireApiKey('ASSEMBLYAI_API_KEY', 'stt:assemblyai', 'AssemblyAI transcription')

  if (diarizationOptions?.speakerCount !== undefined) {
    logSttDiarizationConfig(l, {
      provider: 'assemblyai',
      model: modelName,
      enabled: true,
      speakerCount: diarizationOptions.speakerCount
    })
  }

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)

  return await runAsyncSttJobLifecycle<v.InferOutput<typeof AssemblyAiTranscriptResponseSchema>, v.InferOutput<typeof AssemblyAiTranscriptResponseSchema>, string>({
    outputDir,
    providerService: 'assemblyai',
    providerLogLabel: 'assemblyai',
    providerDisplayName: 'AssemblyAI',
    modelName,
    startTime,
    runMode,
    lifecycle,
    audioDurationSeconds,
    initialPollIntervalMs: INITIAL_POLL_INTERVAL_MS,
    maxPollIntervalMs: MAX_POLL_INTERVAL_MS,
    segment: { segmentNumber, totalSegments },
    jobNoun: 'transcript',
    guardStage: 'stt:assemblyai',
    uploadAsset: async (metrics) => {
      const uploadUrl = await uploadAssemblyAiAudio(apiKey, audioPath, metrics)
      return { value: uploadUrl, remoteAssetUrl: uploadUrl }
    },
    createJob: async (metrics, upload) => {
      if (!upload) {
        throw InternalError('AssemblyAI upload did not produce an upload URL', { stage: 'stt:assemblyai' })
      }
      return {
        jobId: await createAssemblyAiTranscript(
          apiKey,
          upload.value,
          modelName,
          diarizationOptions?.speakerCount,
          metrics
        )
      }
    },
    pollJob: async (jobId, metrics) => await pollAssemblyAiTranscript(apiKey, jobId, metrics),
    getTranscript: async (_jobId, _metrics, finalStatus) => finalStatus,
    isComplete: (status) => status.status === 'completed',
    isFailed: (status) => status.status === 'error'
      ? `AssemblyAI transcription failed: ${status.error ?? 'unknown error'}`
      : undefined,
    buildDeadlineError: (jobId, pollDeadlineMs) => buildAsyncSttPollingDeadlineError('AssemblyAI', jobId, pollDeadlineMs),
    buildResumeProbeError: (jobId, probeCount, totalWaitMs) => buildAsyncSttResumeProbeError('AssemblyAI', 'transcript', jobId, probeCount, totalWaitMs),
    buildResult: async ({ transcript, runtime, processingTime, timings }) => {
      const segments: TranscriptionSegment[] = []

      if (transcript.utterances && transcript.utterances.length > 0) {
        for (const utterance of transcript.utterances) {
          segments.push({
            start: toTimestamp(utterance.start / 1000 + offsetSeconds),
            end: toTimestamp(utterance.end / 1000 + offsetSeconds),
            text: utterance.text,
            ...(formatSpeaker(utterance.speaker) ? { speaker: formatSpeaker(utterance.speaker) } : {})
          })
        }
      } else if (transcript.words && transcript.words.length > 0) {
        segments.push(...buildSegmentsFromWords(transcript.words.map((word) => ({
          start: word.start / 1000,
          end: word.end / 1000,
          text: word.text,
          speaker: formatSpeaker(word.speaker)
        })), offsetSeconds))
      }

      const evidenceWords = transcript.words?.map((word) => ({
        startSeconds: (word.start / 1000) + offsetSeconds,
        endSeconds: (word.end / 1000) + offsetSeconds,
        text: word.text,
        normalized: word.text.toLowerCase(),
        ...(formatSpeaker(word.speaker) ? { speaker: formatSpeaker(word.speaker) } : {}),
        confidence: word.confidence,
        timingSource: 'native' as const
      })) ?? []
      const { finalSegments, finalText } = resolveTranscriptionOutput(
        segments,
        (transcript.text ?? '').trim(),
        offsetSeconds
      )

      await Bun.write(`${outputBase}.txt`, formatTranscriptText(finalSegments))

      return {
        result: {
          text: finalText,
          segments: finalSegments,
          evidence: buildTranscriptionWordEvidence({ words: evidenceWords, segments: finalSegments, rawResponse: transcript })
        },
        metadata: {
          transcriptionService: 'assemblyai',
          transcriptionModel: modelName,
          processingTime,
          tokenCount: countTokens(finalText),
          runtime,
          ...(timings ? { timings } : {})
        }
      }
    }
  })
}
