import * as l from '~/utils/app-logger/app-logger'
import type { DeepgramAlternative, DeepgramResponse, DeepgramWords, RetryClass, Step2Metadata, SttSegmentRunOptions, SttStageHttpError, TranscriptionResult, TranscriptionSegment } from '~/types'
import { DeepgramResponseSchema } from '~/types'
import { logSttSegmentLifecycle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import {
  appendToken,
  buildSegmentsFromWords,
  formatSpeakerLabel,
  toTimestamp
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import { DEEPGRAM_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { requireApiKey } from '~/utils/validate/env-utils'
import { finalizeHostedSttResult } from '../finalize-hosted-stt'
import { createSttRetryMetrics, sttRetryMetricsToCallbacks } from '../../stt-retry-metrics'
import { sttStageRequest } from '../stt-stage-request'
import { ProviderError } from '~/utils/error-handler'

const REQUEST_TIMEOUT_MS = 20 * 60 * 1000

const attachDeepgramErrorContext = (
  error: unknown,
  stage: string,
  retryClass: RetryClass
): never => {
  const source = error instanceof Error ? error : ProviderError(String(error))
  ;(source as SttStageHttpError).stage = stage
  ;(source as SttStageHttpError).retryClass = retryClass
  throw source
}

const inferDeepgramMimeType = (audioPath: string, fallback?: string | undefined): string => {
  const lower = audioPath.toLowerCase()
  if (lower.endsWith('.mp3') || lower.endsWith('.mpga')) return 'audio/mpeg'
  if (lower.endsWith('.wav')) return 'audio/wav'
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4'
  if (lower.endsWith('.aac')) return 'audio/aac'
  if (lower.endsWith('.flac')) return 'audio/flac'
  if (lower.endsWith('.ogg') || lower.endsWith('.opus')) return 'audio/ogg'
  if (lower.endsWith('.webm')) return 'audio/webm'
  if (lower.endsWith('.mpeg')) return 'audio/mpeg'
  return fallback ?? 'application/octet-stream'
}

const buildDeepgramUrl = (baseURL: string, modelName: string): string => {
  const url = new URL('/v1/listen', baseURL)
  url.searchParams.set('model', modelName)
  url.searchParams.set('diarize', 'true')
  url.searchParams.set('utterances', 'true')
  url.searchParams.set('punctuate', 'true')
  url.searchParams.set('smart_format', 'true')
  return url.toString()
}

const selectPrimaryAlternative = (
  payload: DeepgramResponse
): DeepgramAlternative | undefined => {
  const firstChannel = payload.results.channels[0]
  return firstChannel?.alternatives?.[0]
}

const toTextFromWords = (
  words: DeepgramWords | undefined
): string => {
  if (!words) {
    return ''
  }

  let text = ''
  for (const word of words) {
    const token = (word.punctuated_word ?? word.word ?? '').trim()
    if (token.length === 0) {
      continue
    }
    text = appendToken(text, token)
  }

  return text.trim()
}

const segmentsFromUtterances = (
  utterances: DeepgramResponse['results']['utterances'] | undefined,
  offsetSeconds: number
): TranscriptionSegment[] => {
  if (!utterances) {
    return []
  }

  const segments: TranscriptionSegment[] = []
  for (const utterance of utterances) {
    const text = utterance.transcript.trim()
    if (text.length === 0) {
      continue
    }

    const speaker = formatSpeakerLabel(utterance.speaker)
    segments.push({
      start: toTimestamp(utterance.start + offsetSeconds),
      end: toTimestamp(utterance.end + offsetSeconds),
      text,
      ...(speaker ? { speaker } : {})
    })
  }

  return segments
}

const segmentsFromWords = (
  words: DeepgramWords | undefined,
  offsetSeconds: number
): TranscriptionSegment[] => {
  if (!words) {
    return []
  }

  return buildSegmentsFromWords(
    words
      .map((word) => ({
        start: word.start ?? 0,
        end: word.end ?? word.start ?? 0,
        text: (word.punctuated_word ?? word.word ?? '').trim(),
        speaker: formatSpeakerLabel(word.speaker)
      }))
      .filter((word) => word.text.length > 0),
    offsetSeconds
  )
}

const evidenceWordsFromDeepgram = (
  words: DeepgramWords | undefined,
  offsetSeconds: number
) => {
  if (!words) {
    return []
  }

  return words
    .map((word) => {
      const text = (word.punctuated_word ?? word.word ?? '').trim()
      if (text.length === 0 || typeof word.start !== 'number' || typeof word.end !== 'number') {
        return null
      }

      return {
        startSeconds: word.start + offsetSeconds,
        endSeconds: word.end + offsetSeconds,
        text,
        normalized: text.toLowerCase(),
        ...(word.speaker !== undefined ? { speaker: formatSpeakerLabel(word.speaker) } : {}),
        timingSource: 'native' as const
      }
    })
    .filter((word): word is NonNullable<typeof word> => word !== null)
}

export const runDeepgramTranscribe = async (
  audioPath: string,
  outputDir: string,
  options: SttSegmentRunOptions
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const apiKey = requireApiKey('DEEPGRAM_API_KEY', 'stt:deepgram', 'Deepgram transcription')

  const { model: modelName, segmentOffsetMinutes = 0, segmentNumber, totalSegments } = options
  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: 'deepgram', action: 'started', segmentNumber, totalSegments, model: modelName })
  }

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60

  const file = Bun.file(audioPath)
  const mimeType = inferDeepgramMimeType(audioPath, file.type)
  const baseURL = DEEPGRAM_DEFAULT_BASE_URL
  let transcribeMs = 0
  let requestCount = 0
  const retryMetrics = createSttRetryMetrics()

  const transcribeStartedAt = Date.now()
  const payload = await sttStageRequest({
    operationName: 'deepgram-stt',
    stage: 'transcribe',
    retryClass: 'runtime_http_create_retriable',
    maxAttempts: 4,
    timeoutMs: REQUEST_TIMEOUT_MS,
    errorPrefix: 'Deepgram',
    failureLabel: 'transcription',
    schema: DeepgramResponseSchema,
    schemaLabel: 'Deepgram STT response',
    metrics: sttRetryMetricsToCallbacks(retryMetrics, () => {
      requestCount += 1
    }),
    attachError: attachDeepgramErrorContext,
    doFetch: async (signal) => await fetch(buildDeepgramUrl(baseURL, modelName), {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': mimeType
      },
      body: file,
      signal: signal ?? null
    })
  })
  transcribeMs += Date.now() - transcribeStartedAt

  const primaryAlternative = selectPrimaryAlternative(payload)
  const transcript = (primaryAlternative?.transcript ?? '').trim()
  const utteranceSegments = segmentsFromUtterances(payload.results.utterances, offsetSeconds)
  const wordSegments = segmentsFromWords(primaryAlternative?.words, offsetSeconds)
  const segments = utteranceSegments.length > 0 ? utteranceSegments : wordSegments
  const text = transcript || toTextFromWords(primaryAlternative?.words)
  const evidenceWords = evidenceWordsFromDeepgram(primaryAlternative?.words, offsetSeconds)
  return await finalizeHostedSttResult({
    provider: 'deepgram',
    model: modelName,
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
