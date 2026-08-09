import { logSttSegmentLifecycle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import { toTimestamp } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import type { OpenAICompatibleTranscriptionSegment, RawTranscriptionPayload, Step2Metadata, TranscriptionResult, TranscriptionSegment } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { createOpenAITranscription } from '~/utils/openai/openai-client'
import { withRetry } from '~/utils/retries'
import { classifySttFetchRetryWithMetrics, createSttRetryMetrics } from '../stt-retry-metrics'
import { finalizeHostedSttResult } from './finalize-hosted-stt'
import { repairZeroDurationMonotonicSegments } from '../stt-utils/stt-timing-quality'


const REQUEST_TIMEOUT_MS = 20 * 60 * 1000

const parseSegments = (
  raw: unknown,
  offsetSeconds: number,
  knownEndSeconds?: number | undefined
): TranscriptionSegment[] => {
  if (!Array.isArray(raw)) {
    return []
  }

  const segments: TranscriptionSegment[] = []
  for (const segment of raw) {
    const entry = segment as OpenAICompatibleTranscriptionSegment
    if (typeof entry.start !== 'number' || typeof entry.end !== 'number' || typeof entry.text !== 'string') {
      continue
    }

    const text = entry.text.trim()
    if (text.length === 0) {
      continue
    }

    segments.push({
      start: toTimestamp(entry.start + offsetSeconds),
      end: toTimestamp(entry.end + offsetSeconds),
      text
    })
  }

  return repairZeroDurationMonotonicSegments(segments, { knownEndSeconds }).segments
}

const normalizeBaseURL = (baseURL: string): string =>
  baseURL.replace(/\/+$/, '')

const createCompatibleTranscription = async <T = Record<string, unknown>>({
  apiKey,
  baseURL,
  provider,
  form,
  errorMessagePrefix,
  signal,
}: {
  apiKey: string
  baseURL: string
  provider: string
  form: FormData
  errorMessagePrefix: string
  signal?: AbortSignal | undefined
}): Promise<T> =>
  await createOpenAITranscription<T>(
    {
      apiKey,
      baseURL: normalizeBaseURL(baseURL),
      provider
    },
    form,
    {
      errorMessagePrefix,
      signal
    }
  )

const withCompatibleTranscriptionRetry = async <T>(
  operationName: string,
  retryMetrics: ReturnType<typeof createSttRetryMetrics>,
  operation: (signal?: AbortSignal) => Promise<T>
): Promise<T> =>
  await withRetry(
    {
      retryClass: 'runtime_http_create_conservative',
      operationName,
      timeoutMs: REQUEST_TIMEOUT_MS
    },
    operation,
    classifySttFetchRetryWithMetrics(retryMetrics, 'runtime_http_create_conservative', { retryAbortOnConservative: true })
  )

export const runOpenAICompatibleSingleSpeakerStt = async (
  audioPath: string,
  outputDir: string,
  options: {
    service: Step2Metadata['transcriptionService']
    providerLabel: string
    apiKey: string
    baseURL: string
    model: string
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
    audioDurationSeconds?: number | undefined
    formFields?: Record<string, string> | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const {
    service,
    providerLabel,
    apiKey,
    baseURL,
    model,
    segmentOffsetMinutes = 0,
    segmentNumber,
    totalSegments,
    audioDurationSeconds,
    formFields = {
      response_format: 'verbose_json',
      'timestamp_granularities[]': 'segment'
    }
  } = options

  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: providerLabel, action: 'started', segmentNumber, totalSegments, model })
  }

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  let requestCount = 0
  const retryMetrics = createSttRetryMetrics()

  const buildForm = (): FormData => {
    const form = new FormData()
    form.append('model', model)
    for (const [key, value] of Object.entries(formFields)) {
      form.append(key, value)
    }
    form.append('file', Bun.file(audioPath))
    return form
  }

  const transcribeStartedAt = Date.now()
  const payload = await withCompatibleTranscriptionRetry(
    `${service}-stt-create`,
    retryMetrics,
    async (signal) => {
      requestCount += 1
      return await createCompatibleTranscription<RawTranscriptionPayload>({
        apiKey,
        baseURL,
        provider: service,
        form: buildForm(),
        errorMessagePrefix: `${providerLabel} transcription failed`,
        signal
      })
    }
  )
  const transcribeMs = Date.now() - transcribeStartedAt
  const knownEndSeconds = typeof audioDurationSeconds === 'number' && Number.isFinite(audioDurationSeconds)
    ? offsetSeconds + audioDurationSeconds
    : undefined
  const segments = parseSegments(payload.segments, offsetSeconds, knownEndSeconds)
  const text = typeof payload.text === 'string'
    ? payload.text.trim()
    : segments.map((segment) => segment.text).join(' ').trim()
  return await finalizeHostedSttResult({
    provider: service,
    lifecycleProvider: providerLabel,
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
    evidenceWords: [],
    rawResponse: payload
  })
}
