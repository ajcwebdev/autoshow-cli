import { isRecord } from '~/utils/rest-client'
import { logSttSegmentLifecycle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import { buildSegmentsFromWords, formatSpeakerLabel, toTimestamp } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import type { OpenAICompatibleTranscriptionSegment, TranscriptionEvidenceWord, RawTranscriptionPayload, Step2Metadata, TranscriptionResult, TranscriptionSegment } from '~/types'
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
    if (!isRecord(segment)) continue
    const entry = segment as OpenAICompatibleTranscriptionSegment
    if (typeof entry.start !== 'number' || typeof entry.end !== 'number' || !Number.isFinite(entry.start) || !Number.isFinite(entry.end) || entry.start < 0 || entry.end < entry.start || typeof entry.text !== 'string') {
      continue
    }

    const text = entry.text.trim()
    if (text.length === 0) {
      continue
    }

    segments.push({
      start: toTimestamp(entry.start + offsetSeconds),
      end: toTimestamp(entry.end + offsetSeconds),
      text,
      ...(typeof entry.speaker_id === 'string' || typeof entry.speaker_id === 'number' ? { speaker: formatSpeakerLabel(entry.speaker_id) } : {})
    })
  }

  return repairZeroDurationMonotonicSegments(segments, { knownEndSeconds }).segments
}

export const parseCompatibleSttWords = (payload: RawTranscriptionPayload, offsetSeconds: number): TranscriptionEvidenceWord[] => {
  const nested = Array.isArray(payload.speaker_segments) ? payload.speaker_segments.flatMap(segment =>
    isRecord(segment) && Array.isArray(segment['words']) ? segment['words'].map(word =>
      isRecord(word) ? { ...word, speaker_id: word['speaker_id'] ?? segment['speaker_id'] } : word
    ) : []
  ) : []
  const top = Array.isArray(payload.words) ? payload.words : []
  const identity = (entry: unknown): string => {
    if (!isRecord(entry)) return ''
    const text = entry['word'] ?? entry['text']
    return JSON.stringify([entry['start'], entry['end'], typeof text === 'string' ? text.trim() : text])
  }
  const topByIdentity = new Map(top.filter(isRecord).map(entry => [identity(entry), entry]))
  const nestedIdentities = new Set(nested.map(identity))
  const entries = [
    ...nested.map(entry => isRecord(entry) ? { ...topByIdentity.get(identity(entry)), ...entry } : entry),
    ...top.filter(entry => !nestedIdentities.has(identity(entry)))
  ]
  const seen = new Set<string>()
  return entries.flatMap(entry => {
    if (!isRecord(entry)) return []
    const text = entry['word'] ?? entry['text']
    const start = entry['start'], end = entry['end']
    if (typeof text !== 'string' || !text.trim() || typeof start !== 'number' || typeof end !== 'number' || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) return []
    const speakerId = entry['speaker_id'] ?? entry['speaker']
    const speaker = typeof speakerId === 'string' || typeof speakerId === 'number' ? formatSpeakerLabel(speakerId) : undefined
    const key = JSON.stringify([start, end, text, speaker])
    if (seen.has(key)) return []
    seen.add(key)
    return [{ startSeconds: start + offsetSeconds, endSeconds: end + offsetSeconds, text: text.trim(), normalized: text.trim().toLowerCase(), ...(speaker ? { speaker } : {}), ...(typeof entry['confidence'] === 'number' ? { confidence: entry['confidence'] } : {}), timingSource: 'native' as const }]
  }).sort((a, b) => a.startSeconds - b.startSeconds || a.endSeconds - b.endSeconds)
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
    classifySttFetchRetryWithMetrics(retryMetrics, 'runtime_http_create_conservative')
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
    formFields?: Record<string, string | string[]> | undefined
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
      'timestamp_granularities[]': ['word', 'segment']
    }
  } = options

  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle( { provider: providerLabel, action: 'started', segmentNumber, totalSegments, model })
  }

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  let requestCount = 0
  const retryMetrics = createSttRetryMetrics()

  const buildForm = (): FormData => {
    const form = new FormData()
    form.append('model', model)
    for (const [key, value] of Object.entries(formFields)) {
      for (const item of Array.isArray(value) ? value : [value]) form.append(key, item)
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
  const evidenceWords = parseCompatibleSttWords(payload, offsetSeconds)
  const parsedSegments = parseSegments(payload.speaker_segments ?? payload.segments, offsetSeconds, knownEndSeconds)
  const segments = parsedSegments.length > 0 ? parsedSegments : buildSegmentsFromWords(evidenceWords.map(word => ({ start: word.startSeconds, end: word.endSeconds, text: word.text, speaker: word.speaker })), 0)
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
    evidenceWords,
    rawResponse: payload
  })
}
