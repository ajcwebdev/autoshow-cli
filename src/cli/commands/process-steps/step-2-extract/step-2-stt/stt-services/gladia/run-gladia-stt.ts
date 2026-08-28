import { basename } from 'node:path'
import { buildAsyncSttPollingDeadlineError, buildAsyncSttResumeProbeError, runAsyncSttJobLifecycle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/async-lifecycle'
import { logSttDiarizationConfig } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import { buildTranscriptionWordEvidence } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-evidence'
import { buildSegmentsFromWords, buildTranscriptionOutputBase, countTokens, formatSpeakerLabel, formatTranscriptText, resolveTranscriptionOutput, toTimestamp } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import type { AsyncSttLifecycleMetrics, GladiaNormalizedWord, GladiaStatusResponse, GladiaUtterance, HostedAsyncSttRunOptions, Step2Metadata, TranscriptionResult, TranscriptionSegment } from '~/types'
import { GladiaCreateResponseSchema, GladiaStatusResponseSchema, GladiaUploadResponseSchema } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { InternalError } from '~/utils/error-handler'
import { resolveCredential } from '~/utils/validate/env-utils'
import { lifecycleMetricsToCallbacks, sttStageRequest, sttStageRequestWithRetryAfter } from '../stt-stage-request'
import { getGladiaBaseUrl } from './gladia'
import { attachSttStageErrorContext } from '../../stt-error-context'
import { resolveRestPath } from '~/utils/rest-client'

const INITIAL_POLL_INTERVAL_MS = 1000
const MAX_POLL_INTERVAL_MS = 10000
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000
const POLL_REQUEST_TIMEOUT_MS = 60 * 1000

export const buildGladiaCreateRequest = (
  audioUrl: string,
  model: string,
  diarizationOptions?: { enabled?: boolean | undefined, speakerCount?: number | undefined }
): Record<string, unknown> => ({
  audio_url: audioUrl,
  model,
  diarization: diarizationOptions?.enabled ?? true,
  ...(diarizationOptions?.speakerCount !== undefined
    ? {
        diarization_config: {
          number_of_speakers: diarizationOptions.speakerCount
        }
      }
    : {})
})

const flattenGladiaWords = (
  utterances: ReadonlyArray<GladiaUtterance>,
  offsetSeconds: number
): Array<{
  startSeconds: number
  endSeconds: number
  text: string
  normalized: string
  speaker?: string | undefined
  confidence?: number | undefined
  timingSource: 'native'
}> => utterances.flatMap((utterance) => {
  const speaker = formatSpeakerLabel(utterance.speaker)
  return (utterance.words ?? []).map((word) => ({
    startSeconds: word.start + offsetSeconds,
    endSeconds: word.end + offsetSeconds,
    text: word.word,
    normalized: word.word.toLowerCase(),
    ...(speaker ? { speaker } : {}),
    ...(typeof word.confidence === 'number' ? { confidence: word.confidence } : {}),
    timingSource: 'native' as const
  }))
})

const buildSegmentsFromUtterances = (
  utterances: ReadonlyArray<GladiaUtterance>,
  offsetSeconds: number
): TranscriptionSegment[] => utterances.map((utterance) => ({
  start: toTimestamp(utterance.start + offsetSeconds),
  end: toTimestamp(utterance.end + offsetSeconds),
  text: utterance.text,
  ...(formatSpeakerLabel(utterance.speaker) ? { speaker: formatSpeakerLabel(utterance.speaker) } : {})
}))

const extractUtterances = (status: GladiaStatusResponse) =>
  status.result?.transcription?.utterances
  ?? status.result?.diarization?.results
  ?? []

const buildNormalizedWords = (
  utterances: ReturnType<typeof extractUtterances>
): GladiaNormalizedWord[] => utterances.flatMap((utterance) => {
  const speaker = formatSpeakerLabel(utterance.speaker)
  return (utterance.words ?? []).map((word) => ({
    start: word.start,
    end: word.end,
    text: word.word,
    ...(speaker ? { speaker } : {}),
    ...(typeof word.confidence === 'number' ? { confidence: word.confidence } : {})
  }))
})

const uploadGladiaAudio = async (
  baseURL: string,
  apiKey: string,
  audioPath: string,
  metrics: AsyncSttLifecycleMetrics
) => await sttStageRequest({
  operationName: 'gladia-upload',
  stage: 'upload',
  retryClass: 'runtime_http_create_retriable',
  timeoutMs: REQUEST_TIMEOUT_MS,
  errorPrefix: 'Gladia',
  schema: GladiaUploadResponseSchema,
  schemaLabel: 'Gladia upload response',
  metrics: lifecycleMetricsToCallbacks(metrics),
  attachError: attachSttStageErrorContext,
  doFetch: (signal) => {
    const form = new FormData()
    form.append('audio', Bun.file(audioPath), basename(audioPath))

    return fetch(resolveRestPath(baseURL, '/v2/upload'), {
      method: 'POST',
      headers: { 'x-gladia-key': apiKey },
      body: form,
      signal: signal ?? null
    })
  }
})

const createGladiaTranscription = async (
  baseURL: string,
  apiKey: string,
  audioUrl: string,
  modelName: string,
  diarizationOptions: HostedAsyncSttRunOptions['diarizationOptions'],
  metrics: AsyncSttLifecycleMetrics
): Promise<string> => {
  const createRecord = await sttStageRequest({
    operationName: 'gladia-create-transcription',
    stage: 'create',
    retryClass: 'runtime_http_create_retriable',
    timeoutMs: REQUEST_TIMEOUT_MS,
    errorPrefix: 'Gladia',
    failureLabel: 'transcription creation',
    schema: GladiaCreateResponseSchema,
    schemaLabel: 'Gladia create response',
    metrics: lifecycleMetricsToCallbacks(metrics),
    attachError: attachSttStageErrorContext,
    doFetch: (signal) => fetch(resolveRestPath(baseURL, '/v2/pre-recorded'), {
      method: 'POST',
      headers: {
        'x-gladia-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(buildGladiaCreateRequest(audioUrl, modelName, diarizationOptions)),
      signal: signal ?? null
    })
  })

  return createRecord.id
}

const pollGladiaTranscription = async (
  baseURL: string,
  apiKey: string,
  transcriptionId: string,
  metrics: AsyncSttLifecycleMetrics
): Promise<{ status: GladiaStatusResponse, retryAfterMs: number | null }> => {
  const { value, retryAfterMs } = await sttStageRequestWithRetryAfter({
    operationName: 'gladia-poll-transcription',
    stage: 'poll',
    retryClass: 'runtime_http_read',
    timeoutMs: POLL_REQUEST_TIMEOUT_MS,
    errorPrefix: 'Gladia',
    failureLabel: 'polling',
    schema: GladiaStatusResponseSchema,
    schemaLabel: 'Gladia transcription status response',
    metrics: lifecycleMetricsToCallbacks(metrics),
    attachError: attachSttStageErrorContext,
    doFetch: (signal) => fetch(resolveRestPath(baseURL, `/v2/pre-recorded/${transcriptionId}`), {
      method: 'GET',
      headers: { 'x-gladia-key': apiKey },
      signal: signal ?? null
    })
  })

  return { status: value, retryAfterMs }
}

export const runGladiaStt = async (
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
  const apiKey = resolveCredential('gladia', 'require', { stage: 'stt:gladia', description: 'Gladia transcription' })

  if (diarizationOptions?.speakerCount !== undefined) {
    logSttDiarizationConfig(l, {
      provider: 'gladia',
      model: modelName,
      enabled: true,
      speakerCount: diarizationOptions.speakerCount
    })
  }

  const baseURL = getGladiaBaseUrl()
  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)

  return await runAsyncSttJobLifecycle<GladiaStatusResponse, GladiaStatusResponse, string>({
    outputDir,
    providerService: 'gladia',
    providerLogLabel: 'gladia',
    providerDisplayName: 'Gladia',
    modelName,
    startTime,
    runMode,
    lifecycle,
    audioDurationSeconds,
    initialPollIntervalMs: INITIAL_POLL_INTERVAL_MS,
    maxPollIntervalMs: MAX_POLL_INTERVAL_MS,
    segment: { segmentNumber, totalSegments },
    jobNoun: 'transcription',
    guardStage: 'stt:gladia',
    uploadAsset: async (metrics) => {
      const upload = await uploadGladiaAudio(baseURL, apiKey, audioPath, metrics)
      return {
        value: upload.audio_url,
        remoteAssetId: upload.audio_metadata.id,
        remoteAssetUrl: upload.audio_url
      }
    },
    createJob: async (metrics, upload) => {
      if (!upload) {
        throw InternalError('Gladia upload did not produce an audio URL', { stage: 'stt:gladia' })
      }
      return {
        jobId: await createGladiaTranscription(
          baseURL,
          apiKey,
          upload.value,
          modelName,
          diarizationOptions,
          metrics
        )
      }
    },
    pollJob: async (jobId, metrics) => await pollGladiaTranscription(baseURL, apiKey, jobId, metrics),
    getTranscript: async (_jobId, _metrics, finalStatus) => finalStatus,
    isComplete: (status) => status.status === 'done',
    isFailed: (status) => status.status === 'error'
      ? `Gladia transcription failed: ${status.message ?? (typeof status.error_code === 'number' ? `error code ${status.error_code}` : 'unknown error')}`
      : undefined,
    buildDeadlineError: (jobId, pollDeadlineMs, cause) => buildAsyncSttPollingDeadlineError('Gladia', jobId, pollDeadlineMs, cause),
    buildResumeProbeError: (jobId, probeCount, totalWaitMs, cause) => buildAsyncSttResumeProbeError('Gladia', 'transcription', jobId, probeCount, totalWaitMs, cause),
    buildResult: async ({ transcript, runtime, processingTime, timings }) => {
      const utterances = extractUtterances(transcript)
      const normalizedWords = buildNormalizedWords(utterances)
      const evidenceWords = flattenGladiaWords(utterances, offsetSeconds)
      const segments = utterances.length > 0
        ? buildSegmentsFromUtterances(utterances, offsetSeconds)
        : normalizedWords.length > 0
          ? buildSegmentsFromWords(normalizedWords, offsetSeconds)
          : []
      const { finalSegments, finalText } = resolveTranscriptionOutput(
        segments,
        (transcript.result?.transcription?.full_transcript ?? '').trim(),
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
          transcriptionService: 'gladia',
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
