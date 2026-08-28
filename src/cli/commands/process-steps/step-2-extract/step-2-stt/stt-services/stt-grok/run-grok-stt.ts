import * as l from '~/utils/app-logger/app-logger'
import * as v from 'valibot'
import type { GrokWord, Step2Metadata, TranscriptionEvidenceWord, TranscriptionResult, TranscriptionSegment } from '~/types'
import { logSttSegmentLifecycle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import { appendToken, buildSegmentsFromWords, formatSpeakerLabel } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import { XAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { resolveCredential } from '~/utils/validate/env-utils'
import { validateDataSafe } from '~/utils/validate/validation'
import { finalizeHostedSttResult } from '../finalize-hosted-stt'
import { createSttRetryMetrics, sttRetryMetricsToCallbacks } from '../../stt-retry-metrics'
import { sttStageRequest } from '../stt-stage-request'
import { attachSttStageErrorContext } from '../../stt-error-context'
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000

const GrokSttWordSchema = v.object({
  text: v.string(),
  start: v.number(),
  end: v.number(),
  confidence: v.optional(v.number(), undefined),
  speaker: v.optional(v.union([v.string(), v.number()]), undefined)
})

export const GrokSttResponseSchema = v.object({
  text: v.string(),
  language: v.optional(v.string(), undefined),
  duration: v.optional(v.number(), undefined),
  words: v.optional(v.array(GrokSttWordSchema), undefined)
})

const GrokErrorSchema = v.object({
  error: v.optional(v.object({
    message: v.optional(v.string(), undefined)
  }), undefined),
  message: v.optional(v.string(), undefined)
})

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const readGrokError = async (response: Response): Promise<{ message: string, rawResponse: unknown }> => {
  const rawText = await response.text()
  if (!rawText.trim()) {
    return { message: `HTTP ${response.status}`, rawResponse: rawText }
  }

  try {
    const parsed: unknown = JSON.parse(rawText)
    const validated = validateDataSafe(GrokErrorSchema, parsed)
    if (validated?.error?.message && validated.error.message.trim().length > 0) {
      return { message: validated.error.message, rawResponse: parsed }
    }
    if (validated?.message && validated.message.trim().length > 0) {
      return { message: validated.message, rawResponse: parsed }
    }
    return { message: rawText, rawResponse: parsed }
  } catch {
    return { message: rawText, rawResponse: rawText }
  }
}

const textFromWords = (words: GrokWord[] | undefined): string => {
  if (!words) {
    return ''
  }

  let text = ''
  for (const word of words) {
    const token = word.text.trim()
    if (token.length === 0) {
      continue
    }
    text = appendToken(text, token)
  }

  return text.trim()
}

const normalizeWord = (word: GrokWord): { start: number, end: number, text: string, speaker?: string | undefined } | undefined => {
  const text = word.text.trim()
  if (text.length === 0 || !Number.isFinite(word.start) || !Number.isFinite(word.end)) {
    return undefined
  }

  const speaker = formatSpeakerLabel(word.speaker)
  return {
    start: word.start,
    end: word.end,
    text,
    ...(speaker ? { speaker } : {})
  }
}

const segmentsFromWords = (
  words: GrokWord[] | undefined,
  offsetSeconds: number
): TranscriptionSegment[] => {
  if (!words) {
    return []
  }

  const normalized = words
    .map(normalizeWord)
    .filter((word): word is NonNullable<typeof word> => word !== undefined)

  if (normalized.length === 0) {
    return []
  }

  const segments: TranscriptionSegment[] = []
  let currentSpeaker = normalized[0]?.speaker
  let group: typeof normalized = []

  const flush = (): void => {
    if (group.length === 0) {
      return
    }
    segments.push(...buildSegmentsFromWords(group, offsetSeconds))
    group = []
  }

  for (const word of normalized) {
    if (group.length > 0 && word.speaker !== currentSpeaker) {
      flush()
      currentSpeaker = word.speaker
    }
    group.push(word)
  }

  flush()
  return segments
}

const evidenceWordsFromApi = (
  words: GrokWord[] | undefined,
  offsetSeconds: number
): TranscriptionEvidenceWord[] => {
  if (!words) {
    return []
  }

  const parsed: TranscriptionEvidenceWord[] = []
  for (const word of words) {
    const text = word.text.trim()
    if (text.length === 0 || !Number.isFinite(word.start) || !Number.isFinite(word.end)) {
      continue
    }

    const speaker = formatSpeakerLabel(word.speaker)
    const confidence = typeof word.confidence === 'number' && Number.isFinite(word.confidence)
      ? word.confidence
      : undefined
    parsed.push({
      startSeconds: word.start + offsetSeconds,
      endSeconds: word.end + offsetSeconds,
      text,
      normalized: text.toLowerCase(),
      ...(speaker ? { speaker } : {}),
      ...(confidence !== undefined ? { confidence } : {}),
      timingSource: 'native'
    })
  }

  return parsed
}

export const runGrokStt = async (
  audioPath: string,
  outputDir: string,
  options: {
    model: string
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const { model, segmentOffsetMinutes = 0, segmentNumber, totalSegments } = options
  const apiKey = resolveCredential('grok', 'require', { stage: 'stt:grok', description: 'Grok transcription' })

  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: 'grok', action: 'started', segmentNumber, totalSegments, model })
  }

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const baseURL = trimTrailingSlash(XAI_DEFAULT_BASE_URL)
  let transcribeMs = 0
  let requestCount = 0
  const retryMetrics = createSttRetryMetrics()

  const transcribeStartedAt = Date.now()
  const payload = await sttStageRequest({
    operationName: 'grok-stt',
    stage: 'transcribe',
    retryClass: 'runtime_http_create_retriable',
    timeoutMs: REQUEST_TIMEOUT_MS,
    errorPrefix: 'Grok',
    failureLabel: 'transcription',
    schema: GrokSttResponseSchema,
    schemaLabel: 'Grok STT response',
    metrics: sttRetryMetricsToCallbacks(retryMetrics, () => {
      requestCount += 1
    }),
    readFailure: readGrokError,
    attachError: attachSttStageErrorContext,
    doFetch: async (signal) => {
      const form = new FormData()
      form.append('format', 'true')
      form.append('language', 'en')
      form.append('diarize', 'true')
      form.append('file', Bun.file(audioPath))

      return await fetch(`${baseURL}/stt`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        body: form,
        ...(signal ? { signal } : {})
      })
    }
  })
  transcribeMs += Date.now() - transcribeStartedAt

  const text = payload.text.trim() || textFromWords(payload.words)
  const segments = segmentsFromWords(payload.words, offsetSeconds)
  const evidenceWords = evidenceWordsFromApi(payload.words, offsetSeconds)
  return await finalizeHostedSttResult({
    provider: 'grok',
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
