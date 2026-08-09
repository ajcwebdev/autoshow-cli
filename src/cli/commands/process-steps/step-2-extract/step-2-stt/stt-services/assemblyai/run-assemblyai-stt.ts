import { buildAsyncSttPollingDeadlineError, buildAsyncSttResumeProbeError, createAsyncSttJobReadyNotifier, createAsyncSttProgressMetadataPersister, pollAsyncSttJobUntilComplete, readPersistedAsyncSttRuntime } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/async-lifecycle'
import { logSttAsyncJobLifecycle, logSttDiarizationConfig, logSttSegmentLifecycle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import { buildStep2TimingMetadata } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-timing-metadata'
import { buildTranscriptionWordEvidence } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-evidence'
import { buildSegmentsFromWords, buildTranscriptionOutputBase, countTokens, formatTranscriptText, resolveTranscriptionOutput, toTimestamp } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import type { HostedAsyncSttRunOptions, RetryClass, Step2Metadata, Step2RuntimeMetadata, SttStageHttpError, TranscriptionResult, TranscriptionSegment } from '~/types'
import { AssemblyAiTranscriptResponseSchema } from '~/types'
import { ASSEMBLYAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import * as l from '~/utils/app-logger/app-logger'
import * as v from 'valibot'
import { requireApiKey } from '~/utils/validate/env-utils'
import { InternalError, ValidationError } from '~/utils/error-handler'
import { createSttRetryMetrics, sttRetryMetricsToCallbacks } from '../../stt-retry-metrics'
import { sttStageRequest, sttStageRequestWithRetryAfter } from '../stt-stage-request'

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

  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: 'assemblyai', action: 'started', segmentNumber, totalSegments, model: modelName })
  }
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
  let uploadMs = 0
  let createMs = 0
  let pollMs = 0
  let pollSleepMs = 0
  let createCount = 0
  let pollCount = 0
  let requestCount = 0
  const retryMetrics = createSttRetryMetrics()
  const requestMetrics = sttRetryMetricsToCallbacks(retryMetrics, () => { requestCount += 1 })
  const backfillCount = runMode === 'backfill' ? 1 : 0

  const baseURL = ASSEMBLYAI_DEFAULT_BASE_URL
  const headers = {
    'authorization': apiKey,
    'content-type': 'application/json'
  }

  const audioFile = Bun.file(audioPath)
  let runtime = await readPersistedAsyncSttRuntime(outputDir, {
    transcriptionService: 'assemblyai',
    transcriptionModel: modelName
  })
  let uploadUrl = runtime?.remoteAssetUrl
  let transcriptId = runtime?.remoteJobId
  let resumedExistingTranscript = false

  const buildTimingMetadata = (remoteProcessingMs = 0): Step2Metadata['timings'] =>
    buildStep2TimingMetadata({
      uploadMs,
      createMs,
      createCount,
      pollMs,
      pollSleepMs,
      pollCount,
      remoteProcessingMs,
      requestCount,
      retryCount: retryMetrics.retryCount,
      rateLimitCount: retryMetrics.rateLimitCount,
      backfillCount
    })

  const buildProgressMetadata = (nextRuntime: Step2RuntimeMetadata): Step2Metadata => ({
    transcriptionService: 'assemblyai',
    transcriptionModel: modelName,
    processingTime: Date.now() - startTime,
    tokenCount: 0,
    timings: buildTimingMetadata() ?? {},
    runtime: nextRuntime
  })

  const persistProgressMetadata = createAsyncSttProgressMetadataPersister(
    outputDir,
    buildProgressMetadata,
    (nextRuntime) => { runtime = nextRuntime }
  )
  const notifyJobReady = createAsyncSttJobReadyNotifier(lifecycle?.onJobReady)

  if (runtime && (runtime.stage === 'created' || runtime.stage === 'polling')) {
    resumedExistingTranscript = true
    runtime = {
      ...runtime,
      mode: 'resumed',
      stage: 'polling'
    }
    transcriptId = runtime.remoteJobId
    uploadUrl = runtime.remoteAssetUrl
    await persistProgressMetadata(runtime)
    await notifyJobReady(runtime)
  } else {
    const uploadStartedAt = Date.now()
    const uploadResult = await sttStageRequest({
      operationName: 'assemblyai-upload',
      stage: 'upload',
      retryClass: 'runtime_http_create_conservative',
      maxAttempts: 4,
      timeoutMs: REQUEST_TIMEOUT_MS,
      errorPrefix: 'AssemblyAI',
      schema: v.unknown(),
      schemaLabel: 'AssemblyAI upload response',
      metrics: requestMetrics,
      attachError: attachAssemblyAiErrorContext,
      doFetch: (signal) => fetch(`${baseURL}/v2/upload`, {
        method: 'POST',
        headers: {
          'authorization': apiKey,
          'content-type': 'application/octet-stream'
        },
        body: audioFile,
        signal: signal ?? null
      })
    })
    uploadMs += Date.now() - uploadStartedAt

    const uploadRecord = uploadResult as Record<string, unknown> | null
    if (typeof uploadRecord !== 'object' || uploadRecord === null || typeof uploadRecord['upload_url'] !== 'string') {
      throw ValidationError('AssemblyAI upload response missing upload_url', { stage: 'stt:assemblyai' })
    }
    uploadUrl = uploadRecord['upload_url']

    const transcriptBody = buildAssemblyAiTranscriptRequest(
      uploadUrl,
      modelName,
      diarizationOptions?.speakerCount
    )

    const createStartedAt = Date.now()
    const createResult = await sttStageRequest({
      operationName: 'assemblyai-create-transcript',
      stage: 'create',
      retryClass: 'runtime_http_create_conservative',
      maxAttempts: 4,
      timeoutMs: REQUEST_TIMEOUT_MS,
      errorPrefix: 'AssemblyAI',
      failureLabel: 'transcript creation',
      schema: v.unknown(),
      schemaLabel: 'AssemblyAI transcript creation response',
      metrics: requestMetrics,
      attachError: attachAssemblyAiErrorContext,
      doFetch: (signal) => fetch(`${baseURL}/v2/transcript`, {
        method: 'POST',
        headers,
        body: JSON.stringify(transcriptBody),
        signal: signal ?? null
      })
    })
    createMs += Date.now() - createStartedAt
    createCount += 1

    const createRecord = createResult as Record<string, unknown> | null
    if (typeof createRecord !== 'object' || createRecord === null || typeof createRecord['id'] !== 'string') {
      throw ValidationError('AssemblyAI transcript creation response missing id', { stage: 'stt:assemblyai' })
    }
    transcriptId = createRecord['id']

    const createdRuntime: Step2RuntimeMetadata = {
      mode: 'fresh',
      stage: 'polling',
      remoteJobId: transcriptId,
      remoteAssetUrl: uploadUrl,
      createCompletedAt: new Date().toISOString()
    }
    await persistProgressMetadata(createdRuntime)
    await notifyJobReady(createdRuntime)
  }

  if (!transcriptId) {
    throw InternalError('AssemblyAI transcript creation did not produce a transcript id', { stage: 'stt:assemblyai' })
  }
  const activeTranscriptId = transcriptId
  logSttAsyncJobLifecycle(l, {
    provider: `assemblyai/${modelName}`,
    action: resumedExistingTranscript ? 'resumed' : 'created',
    remoteId: activeTranscriptId,
    state: 'polling'
  })

  const pollResult = await pollAsyncSttJobUntilComplete({
    jobId: activeTranscriptId,
    initialPollIntervalMs: INITIAL_POLL_INTERVAL_MS,
    maxPollIntervalMs: MAX_POLL_INTERVAL_MS,
    audioDurationSeconds,
    pollMode: resumedExistingTranscript ? 'resume-probe' : 'fresh',
    buildDeadlineError: (jobId, pollDeadlineMs) => buildAsyncSttPollingDeadlineError('AssemblyAI', jobId, pollDeadlineMs),
    buildResumeProbeError: (jobId, probeCount, totalWaitMs) => buildAsyncSttResumeProbeError('AssemblyAI', 'transcript', jobId, probeCount, totalWaitMs),
    poll: async () => {
      const pollStartedAt = Date.now()
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
        metrics: requestMetrics,
        attachError: attachAssemblyAiErrorContext,
        doFetch: (signal) => fetch(`${baseURL}/v2/transcript/${activeTranscriptId}`, {
          method: 'GET',
          headers: { 'authorization': apiKey },
          signal: signal ?? null
        })
      })
      pollMs += Date.now() - pollStartedAt

      return { status: value, retryAfterMs }
    },
    isComplete: (status) => status.status === 'completed',
    isFailed: (status) =>
      status.status === 'error'
        ? `AssemblyAI transcription failed: ${status.error ?? 'unknown error'}`
        : undefined,
    onProgress: async () => {
        await persistProgressMetadata({
          ...(runtime ?? {
            mode: 'fresh',
            stage: 'polling',
            remoteJobId: activeTranscriptId
          }),
          mode: (runtime?.mode ?? 'fresh'),
          stage: 'polling',
          remoteJobId: activeTranscriptId,
          ...(uploadUrl ? { remoteAssetUrl: uploadUrl } : {}),
          ...(runtime?.createCompletedAt ? { createCompletedAt: runtime.createCompletedAt } : {}),
          lastPollAt: new Date().toISOString()
        })
    },
    withPollSlot: lifecycle?.withPollSlot
  })

  pollSleepMs += pollResult.pollSleepMs
  pollCount += pollResult.pollCount

  const transcript = pollResult.status
  const completedRuntime: Step2RuntimeMetadata = {
    ...(runtime ?? {
      mode: 'fresh',
      stage: 'completed',
      remoteJobId: activeTranscriptId
    }),
    mode: runtime?.mode ?? 'fresh',
    stage: 'completed',
    remoteJobId: activeTranscriptId,
    ...(uploadUrl ? { remoteAssetUrl: uploadUrl } : {}),
    ...(runtime?.createCompletedAt ? { createCompletedAt: runtime.createCompletedAt } : {}),
    ...(runtime?.lastPollAt ? { lastPollAt: runtime.lastPollAt } : {}),
    completedAt: new Date().toISOString()
  }

  const segments: TranscriptionSegment[] = []

  if (transcript.utterances && transcript.utterances.length > 0) {
    for (const utterance of transcript.utterances) {
      const startSec = utterance.start / 1000 + offsetSeconds
      const endSec = utterance.end / 1000 + offsetSeconds
      segments.push({
        start: toTimestamp(startSec),
        end: toTimestamp(endSec),
        text: utterance.text,
        ...(formatSpeaker(utterance.speaker) ? { speaker: formatSpeaker(utterance.speaker) } : {})
      })
    }
  } else if (transcript.words && transcript.words.length > 0) {
    const normalized = transcript.words.map(w => ({
      start: w.start / 1000,
      end: w.end / 1000,
      text: w.text,
      speaker: formatSpeaker(w.speaker)
    }))
    segments.push(...buildSegmentsFromWords(normalized, offsetSeconds))
  }

  const text = (transcript.text ?? '').trim()
  const evidenceWords = transcript.words?.map((word) => ({
    startSeconds: (word.start / 1000) + offsetSeconds,
    endSeconds: (word.end / 1000) + offsetSeconds,
    text: word.text,
    normalized: word.text.toLowerCase(),
    ...(formatSpeaker(word.speaker) ? { speaker: formatSpeaker(word.speaker) } : {}),
    confidence: word.confidence,
    timingSource: 'native' as const
  })) ?? []

  const { finalSegments, finalText } = resolveTranscriptionOutput(segments, text, offsetSeconds)

  const formattedTranscriptPath = `${outputBase}.txt`
  await Bun.write(formattedTranscriptPath, formatTranscriptText(finalSegments))

  const processingTime = Date.now() - startTime
  const remoteProcessingMs = Math.max(0, processingTime - uploadMs - createMs - pollMs)
  const timings = buildTimingMetadata(remoteProcessingMs)
  const metadata: Step2Metadata = {
    transcriptionService: 'assemblyai',
    transcriptionModel: modelName,
    processingTime,
    tokenCount: countTokens(finalText),
    runtime: completedRuntime,
    ...(timings ? { timings } : {})
  }

  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: 'assemblyai', action: 'completed', segmentNumber, totalSegments, model: modelName, processingTimeMs: processingTime })
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
