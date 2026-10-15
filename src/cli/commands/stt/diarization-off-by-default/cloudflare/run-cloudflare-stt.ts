import type { CloudflareWhisperResponse, Step2Metadata, SttSegmentRunOptions, TranscriptionEvidenceWord, TranscriptionResult, TranscriptionSegment } from '~/types'
import { CloudflareWhisperResponseSchema } from '~/types'
import { parseCaptionCues } from '~/cli/commands/audio/music/lyrics-video/captions'
import { logSttSegmentLifecycle } from '~/cli/commands/stt/stt-logging'
import { buildSegmentsFromWords, toTimestamp } from '~/cli/commands/stt/stt-utils/stt-utils'
import { CLOUDFLARE_API_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { getErrorStatus, ProviderError } from '~/utils/error-handler'
import { isRecord, parseJsonOrText, readRestDiagnosticText, trimTrailingSlashes } from '~/utils/rest-client'
import { resolveCredential } from '~/utils/validate/env-utils'
import { finalizeHostedSttResult } from '../../stt-shared/finalize-hosted-stt'
import { sttStageRequest } from '../../stt-shared/stt-stage-request'
import { attachSttStageErrorContext } from '../../stt-error-context'
import { createSttRetryMetrics, sttRetryMetricsToCallbacks } from '../../stt-retry-metrics'
import { repairZeroDurationMonotonicSegments } from '../../workflows/timing/stt-timing-quality'

const REQUEST_TIMEOUT_MS = 20 * 60 * 1000

// Workers AI answers some requests with 408 and code 3046 ("AiError: Request timeout"). In the 2026-10-13
// benchmark, account analytics showed those requests billed no Neurons, so the request is sent again instead of
// failing the whole transcript.
const MAX_REQUEST_TIMEOUT_ATTEMPTS = 3

export const isWorkersAiRequestTimeout = (error: unknown): boolean =>
  getErrorStatus(error) === 408 && error instanceof Error && error.message.includes('3046')

// @cf/openai/whisper-large-v3-turbo takes a JSON body carrying base64 audio. @cf/openai/whisper and
// @cf/openai/whisper-tiny-en take the audio bytes themselves as the request body.
const BASE64_JSON_BODY_MODELS = new Set<string>(['@cf/openai/whisper-large-v3-turbo'])

type CloudflareWhisperResult = NonNullable<CloudflareWhisperResponse['result']>
type CloudflareWhisperWord = NonNullable<CloudflareWhisperResult['words']>[number]

export const buildCloudflareRunUrl = (baseURL: string, accountId: string, model: string): string =>
  `${trimTrailingSlashes(baseURL)}/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`

export const buildCloudflareWhisperRequest = async (
  audioPath: string,
  model: string
): Promise<{ contentType: string, body: string | Blob }> => {
  const file = Bun.file(audioPath)
  if (BASE64_JSON_BODY_MODELS.has(model)) {
    return {
      contentType: 'application/json',
      body: JSON.stringify({ audio: Buffer.from(await file.arrayBuffer()).toString('base64') })
    }
  }
  return { contentType: 'application/octet-stream', body: file }
}

const readCloudflareFailure = async (response: Response): Promise<{ message: string, rawResponse: unknown }> => {
  const rawText = await readRestDiagnosticText(response)
  const payload = parseJsonOrText(rawText)
  const errors = isRecord(payload) && Array.isArray(payload['errors']) ? payload['errors'].filter(isRecord) : []
  const message = errors
    .map(error => [error['code'], error['message']].filter(part => typeof part === 'number' || typeof part === 'string').join(': '))
    .filter(Boolean)
    .join('; ')
  return { message: message || rawText.trim() || `HTTP ${response.status}`, rawResponse: payload }
}

const isTimedWord = (word: CloudflareWhisperWord): word is CloudflareWhisperWord & { word: string, start: number, end: number } =>
  typeof word.word === 'string' && word.word.trim().length > 0
  && typeof word.start === 'number' && typeof word.end === 'number'
  && Number.isFinite(word.start) && Number.isFinite(word.end) && word.start >= 0 && word.end >= word.start

export const parseCloudflareWhisperWords = (result: CloudflareWhisperResult, offsetSeconds: number): TranscriptionEvidenceWord[] => {
  const words = result.words && result.words.length > 0
    ? result.words
    : (result.segments ?? []).flatMap(segment => segment.words ?? [])
  return words.filter(isTimedWord).map(word => ({
    startSeconds: word.start + offsetSeconds,
    endSeconds: word.end + offsetSeconds,
    text: word.word.trim(),
    normalized: word.word.trim().toLowerCase(),
    timingSource: 'native' as const
  }))
}

const parseVttSegments = (vtt: string | null | undefined, offsetSeconds: number): TranscriptionSegment[] => {
  if (!vtt?.trim()) return []
  try {
    return parseCaptionCues(vtt, 'vtt').map(cue => ({
      start: toTimestamp(cue.start + offsetSeconds),
      end: toTimestamp(cue.end + offsetSeconds),
      text: cue.text
    }))
  } catch {
    return []
  }
}

export const parseCloudflareWhisperSegments = (
  result: CloudflareWhisperResult,
  evidenceWords: readonly TranscriptionEvidenceWord[],
  offsetSeconds: number,
  knownEndSeconds?: number | undefined
): TranscriptionSegment[] => {
  const native = (result.segments ?? []).flatMap((segment): TranscriptionSegment[] => {
    const text = segment.text?.trim()
    if (!text || typeof segment.start !== 'number' || typeof segment.end !== 'number' || !Number.isFinite(segment.start) || !Number.isFinite(segment.end) || segment.start < 0 || segment.end < segment.start) return []
    return [{ start: toTimestamp(segment.start + offsetSeconds), end: toTimestamp(segment.end + offsetSeconds), text }]
  })
  if (native.length > 0) return repairZeroDurationMonotonicSegments(native, { knownEndSeconds }).segments
  if (evidenceWords.length > 0) return buildSegmentsFromWords(evidenceWords.map(word => ({ start: word.startSeconds, end: word.endSeconds, text: word.text })), 0)
  return parseVttSegments(result.vtt, offsetSeconds)
}

export const runCloudflareStt = async (
  audioPath: string,
  outputDir: string,
  options: SttSegmentRunOptions
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const { model, segmentOffsetMinutes = 0, segmentNumber, totalSegments, audioDurationSeconds } = options
  const apiToken = resolveCredential('cloudflare', 'require', { stage: 'stt:cloudflare', description: 'Cloudflare Workers AI transcription' })
  const accountId = resolveCredential('cloudflare-account', 'require', { stage: 'stt:cloudflare', description: 'Cloudflare Workers AI transcription' })

  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle( { provider: 'Cloudflare', action: 'started', segmentNumber, totalSegments, model })
  }

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const url = buildCloudflareRunUrl(CLOUDFLARE_API_DEFAULT_BASE_URL, accountId, model)
  const request = await buildCloudflareWhisperRequest(audioPath, model)
  let requestCount = 0
  const retryMetrics = createSttRetryMetrics()

  const transcribeStartedAt = Date.now()
  const requestTranscription = async () => await sttStageRequest({
    operationName: 'cloudflare-stt',
    stage: 'transcribe',
    retryClass: 'runtime_http_create_conservative',
    timeoutMs: REQUEST_TIMEOUT_MS,
    errorPrefix: 'Cloudflare',
    failureLabel: 'transcription',
    schema: CloudflareWhisperResponseSchema,
    schemaLabel: 'Cloudflare Workers AI STT response',
    metrics: sttRetryMetricsToCallbacks(retryMetrics, () => {
      requestCount += 1
    }),
    readFailure: readCloudflareFailure,
    attachError: attachSttStageErrorContext,
    doFetch: async (signal) => await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': request.contentType
      },
      body: request.body,
      signal: signal ?? null
    })
  })
  let payload!: CloudflareWhisperResponse
  for (let attempt = 1; ; attempt += 1) {
    try {
      payload = await requestTranscription()
      break
    } catch (error) {
      if (attempt >= MAX_REQUEST_TIMEOUT_ATTEMPTS || !isWorkersAiRequestTimeout(error)) throw error
      retryMetrics.retryCount += 1
    }
  }
  const transcribeMs = Date.now() - transcribeStartedAt

  const result = payload.result
  if (payload.success === false || !result) {
    const reason = (payload.errors ?? []).map(error => [error.code, error.message].filter(part => part !== undefined).join(': ')).filter(Boolean).join('; ')
    throw ProviderError(`Cloudflare transcription failed: ${reason || 'the response carried no result'}`, { stage: 'stt:cloudflare', retryable: false })
  }

  const knownEndSeconds = typeof audioDurationSeconds === 'number' && Number.isFinite(audioDurationSeconds)
    ? offsetSeconds + audioDurationSeconds
    : undefined
  const evidenceWords = parseCloudflareWhisperWords(result, offsetSeconds)
  const segments = parseCloudflareWhisperSegments(result, evidenceWords, offsetSeconds, knownEndSeconds)
  const text = result.text?.trim() || segments.map(segment => segment.text).join(' ').trim()
  return await finalizeHostedSttResult({
    provider: 'cloudflare',
    lifecycleProvider: 'Cloudflare',
    model,
    outputDir,
    segmentNumber,
    totalSegments,
    offsetSeconds,
    startTime,
    transcribeMs,
    requestCount,
    retryCount: retryMetrics.retryCount,
    rateLimitCount: retryMetrics.rateLimitCount,
    text,
    segments,
    evidenceWords,
    rawResponse: payload
  })
}
