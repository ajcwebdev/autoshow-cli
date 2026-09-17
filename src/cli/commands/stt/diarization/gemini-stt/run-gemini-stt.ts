import { basename, extname } from 'node:path'
import * as l from '~/utils/app-logger/app-logger'
import type { GeminiGenerateContentUsageMetadata, Step2Metadata, TranscriptionEvidenceWord, TranscriptionResult, TranscriptionSegment } from '~/types'
import { logSttSegmentLifecycle } from '~/cli/commands/stt/stt-logging'
import { createGeminiRetryClassifier } from '~/cli/commands/text/write/write-services/write-gemini/gemini-utils'
import { appendToken, buildSegmentsFromWords, formatSpeakerLabel } from '~/cli/commands/stt/stt-utils/stt-utils'
import { finalizeHostedSttResult } from '../../stt-shared/finalize-hosted-stt'
import { withRetry, pollUntil, classifyFetchRetry } from '~/utils/retries'
import { resolveCredential } from '~/utils/validate/env-utils'
import { InfraError, InternalError, ValidationError } from '~/utils/error-handler'
import { geminiCreateInteraction, geminiDeleteFile, geminiGetInteraction, geminiUploadFile, waitForGeminiFileActive } from '~/utils/gemini/gemini-rest'
import { isObjectLike } from '~/utils/value-helpers'

const GEMINI_FILE_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000
const POLL_INTERVAL_MS = 2_000
const GEMINI_TRANSCRIBE_MODEL = 'gemini-3.5-transcribe'
const GEMINI_STT_PRICING_BY_MODEL: Record<string, {
  inputCostPer1MTokensCents: number
  outputCostPer1MTokensCents: number
}> = {
  'gemini-3.5-transcribe': {
    inputCostPer1MTokensCents: 200,
    outputCostPer1MTokensCents: 1200
  }
}

const AUDIO_MIME_BY_EXTENSION: Record<string, string> = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mp3',
  '.aiff': 'audio/aiff',
  '.aif': 'audio/aiff',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.flac': 'audio/flac',
  '.mpeg': 'audio/mpeg',
  '.m4a': 'audio/m4a',
  '.l16': 'audio/l16',
  '.opus': 'audio/opus',
  '.alaw': 'audio/alaw',
  '.mulaw': 'audio/mulaw',
  '.webm': 'audio/webm'
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const asFiniteNumber = (value: unknown): number | undefined => {
  if (isFiniteNumber(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

const getGeminiModalityTokenCount = (
  details: GeminiGenerateContentUsageMetadata['promptTokensDetails'],
  modality: string
): number | undefined => {
  if (!Array.isArray(details)) {
    return undefined
  }

  const targetModality = modality.toUpperCase()
  const total = details.reduce((sum, entry) => {
    if (typeof entry.modality !== 'string' || entry.modality.toUpperCase() !== targetModality) {
      return sum
    }
    return sum + (isFiniteNumber(entry.tokenCount) ? entry.tokenCount : 0)
  }, 0)

  return total > 0 ? total : undefined
}

export const computeGeminiSttBillingFromUsage = (
  model: string,
  usage: GeminiGenerateContentUsageMetadata | undefined
): NonNullable<Step2Metadata['billing']> | undefined => {
  if (!usage) {
    return undefined
  }

  const pricing = GEMINI_STT_PRICING_BY_MODEL[model]
  if (!pricing) {
    throw InternalError(`Missing Gemini STT usage pricing for model ${model}`, { stage: 'stt:gemini' })
  }

  const promptTokens = isFiniteNumber(usage.promptTokenCount) ? usage.promptTokenCount : undefined
  const candidatesTokens = isFiniteNumber(usage.candidatesTokenCount) ? usage.candidatesTokenCount : undefined
  const thinkingTokens = isFiniteNumber(usage.thoughtsTokenCount) ? usage.thoughtsTokenCount : 0
  if (promptTokens === undefined && candidatesTokens === undefined && thinkingTokens === 0) {
    return undefined
  }

  const inputTokens = promptTokens ?? 0
  const audioInputTokens = getGeminiModalityTokenCount(usage.promptTokensDetails, 'AUDIO') ?? inputTokens
  const textInputTokens = Math.max(0, inputTokens - audioInputTokens)
  const outputTokens = (candidatesTokens ?? 0) + thinkingTokens
  const totalTokens = isFiniteNumber(usage.totalTokenCount)
    ? usage.totalTokenCount
    : inputTokens + outputTokens
  const totalCost = (inputTokens / 1_000_000) * pricing.inputCostPer1MTokensCents
    + (outputTokens / 1_000_000) * pricing.outputCostPer1MTokensCents

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    audioInputTokens,
    textInputTokens,
    totalCost,
    source: 'provider_usage',
    mode: 'token'
  }
}

const getAudioMimeType = (filePath: string): string => {
  const mimeType = AUDIO_MIME_BY_EXTENSION[extname(filePath).toLowerCase()]
  if (!mimeType) {
    throw ValidationError(
      `Gemini 3.5 Transcribe does not accept ${basename(filePath)}. Supported audio extensions: ${Object.keys(AUDIO_MIME_BY_EXTENSION).join(', ')}.`,
      { stage: 'stt:gemini' }
    )
  }
  return mimeType
}

const parseOffsetSeconds = (value: unknown): number | undefined => {
  const numeric = asFiniteNumber(value)
  if (numeric !== undefined) {
    return numeric
  }
  if (typeof value !== 'string') {
    return undefined
  }
  const match = /^(-?\d+(?:\.\d+)?)s$/i.exec(value.trim())
  if (!match) {
    return undefined
  }
  const seconds = Number.parseFloat(match[1] ?? '')
  return Number.isFinite(seconds) ? seconds : undefined
}

const normalizeGeminiSpeaker = (speaker: unknown): string | undefined => {
  if (typeof speaker === 'number' && Number.isFinite(speaker)) {
    return formatSpeakerLabel(speaker)
  }
  if (typeof speaker !== 'string') {
    return undefined
  }
  const match = /^spk[_-]?(\d+)$/i.exec(speaker.trim())
  if (match) {
    return `speaker-${match[1]}`
  }
  return formatSpeakerLabel(speaker)
}

const readUsageMetadata = (interaction: unknown): GeminiGenerateContentUsageMetadata | undefined => {
  if (!isObjectLike(interaction)) {
    return undefined
  }
  const raw = [interaction['usageMetadata'], interaction['usage_metadata'], interaction['usage']]
    .find(isObjectLike)
  if (!raw) {
    return undefined
  }
  const details = raw['promptTokensDetails'] ?? raw['prompt_tokens_details']
  return {
    ...(asFiniteNumber(raw['promptTokenCount'] ?? raw['prompt_token_count'] ?? raw['input_tokens']) !== undefined
      ? { promptTokenCount: asFiniteNumber(raw['promptTokenCount'] ?? raw['prompt_token_count'] ?? raw['input_tokens']) }
      : {}),
    ...(asFiniteNumber(raw['candidatesTokenCount'] ?? raw['candidates_token_count'] ?? raw['output_tokens']) !== undefined
      ? { candidatesTokenCount: asFiniteNumber(raw['candidatesTokenCount'] ?? raw['candidates_token_count'] ?? raw['output_tokens']) }
      : {}),
    ...(asFiniteNumber(raw['totalTokenCount'] ?? raw['total_token_count'] ?? raw['total_tokens']) !== undefined
      ? { totalTokenCount: asFiniteNumber(raw['totalTokenCount'] ?? raw['total_token_count'] ?? raw['total_tokens']) }
      : {}),
    ...(asFiniteNumber(raw['thoughtsTokenCount'] ?? raw['thoughts_token_count']) !== undefined
      ? { thoughtsTokenCount: asFiniteNumber(raw['thoughtsTokenCount'] ?? raw['thoughts_token_count']) }
      : {}),
    ...(Array.isArray(details) ? { promptTokensDetails: details as GeminiGenerateContentUsageMetadata['promptTokensDetails'] } : {})
  }
}

const extractInteractionId = (interaction: unknown): string | undefined => {
  if (!isObjectLike(interaction) || typeof interaction['id'] !== 'string' || interaction['id'].length === 0) {
    return undefined
  }
  const id = interaction['id']
  return id.startsWith('interactions/') ? id.slice('interactions/'.length) : id
}

const readInteractionStatus = (interaction: unknown): string | undefined => {
  if (!isObjectLike(interaction) || typeof interaction['status'] !== 'string') {
    return undefined
  }
  return interaction['status']
}

const extractOutputText = (interaction: unknown): string => {
  if (isObjectLike(interaction) && typeof interaction['output_text'] === 'string' && interaction['output_text'].trim().length > 0) {
    return interaction['output_text'].trim()
  }
  if (!isObjectLike(interaction) || !Array.isArray(interaction['steps'])) {
    return ''
  }
  const parts: string[] = []
  for (const step of interaction['steps']) {
    if (!isObjectLike(step) || step['type'] !== 'model_output' || !Array.isArray(step['content'])) {
      continue
    }
    for (const content of step['content']) {
      if (isObjectLike(content) && content['type'] === 'text' && typeof content['text'] === 'string' && content['text'].trim().length > 0) {
        parts.push(content['text'].trim())
      }
    }
  }
  return parts.join(' ').trim()
}

const extractWordAnnotations = (interaction: unknown): unknown[] => {
  const words: unknown[] = []
  if (!isObjectLike(interaction) || !Array.isArray(interaction['steps'])) {
    return words
  }
  for (const step of interaction['steps']) {
    if (!isObjectLike(step) || !Array.isArray(step['content'])) {
      continue
    }
    for (const content of step['content']) {
      if (!isObjectLike(content) || !Array.isArray(content['annotations'])) {
        continue
      }
      for (const annotation of content['annotations']) {
        if (isObjectLike(annotation) && annotation['type'] === 'word_info') {
          words.push(annotation)
        }
      }
    }
  }
  return words
}

const parseGeminiWord = (
  annotation: unknown,
  offsetSeconds: number
): { start: number, end: number, text: string, speaker?: string | undefined, evidence: TranscriptionEvidenceWord } | undefined => {
  if (!isObjectLike(annotation)) {
    return undefined
  }
  const text = typeof annotation['text'] === 'string' ? annotation['text'].trim() : ''
  if (text.length === 0) {
    return undefined
  }
  const start = parseOffsetSeconds(annotation['start_offset'] ?? annotation['startOffset'])
  const end = parseOffsetSeconds(annotation['end_offset'] ?? annotation['endOffset'])
  if (start === undefined || end === undefined) {
    throw InfraError('Gemini 3.5 Transcribe returned a word without parseable start and end offsets.', { stage: 'stt:gemini' })
  }
  const speaker = normalizeGeminiSpeaker(annotation['speaker'])
  return {
    start,
    end,
    text,
    ...(speaker ? { speaker } : {}),
    evidence: {
      startSeconds: start + offsetSeconds,
      endSeconds: end + offsetSeconds,
      text,
      normalized: text.toLowerCase(),
      ...(speaker ? { speaker } : {}),
      timingSource: 'native'
    }
  }
}

const segmentsFromWords = (
  words: Array<{ start: number, end: number, text: string, speaker?: string | undefined }>,
  offsetSeconds: number
): TranscriptionSegment[] => {
  if (words.length === 0) {
    return []
  }

  const segments: TranscriptionSegment[] = []
  let currentSpeaker = words[0]?.speaker
  let group: typeof words = []

  const flush = (): void => {
    if (group.length === 0) {
      return
    }
    segments.push(...buildSegmentsFromWords(group, offsetSeconds))
    group = []
  }

  for (const word of words) {
    if (group.length > 0 && word.speaker !== currentSpeaker) {
      flush()
      currentSpeaker = word.speaker
    }
    group.push(word)
  }

  flush()
  return segments
}

const textFromWords = (words: Array<{ text: string }>): string => {
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

const assertCompletedInteraction = (interaction: unknown): void => {
  if (!isObjectLike(interaction)) {
    throw InfraError('Gemini 3.5 Transcribe returned an invalid interaction.', { stage: 'stt:gemini' })
  }
  if (interaction['error'] !== undefined) {
    throw InfraError('Gemini 3.5 Transcribe interaction failed.', { stage: 'stt:gemini' })
  }
  const status = readInteractionStatus(interaction)
  if (status === 'failed' || status === 'cancelled') {
    throw InfraError(`Gemini 3.5 Transcribe interaction ${status}.`, { stage: 'stt:gemini' })
  }
  if (status !== undefined && status !== 'completed') {
    throw InfraError(`Gemini 3.5 Transcribe interaction did not complete (status ${status}).`, { stage: 'stt:gemini' })
  }
}

const waitForCompletedInteraction = async (
  apiKey: string,
  interaction: unknown,
  abortSignal?: AbortSignal
): Promise<unknown> => {
  const status = readInteractionStatus(interaction)
  if (status === undefined || status === 'completed') {
    assertCompletedInteraction(interaction)
    return interaction
  }
  if (status === 'failed' || status === 'cancelled') {
    assertCompletedInteraction(interaction)
  }
  const interactionId = extractInteractionId(interaction)
  if (!interactionId) {
    throw InfraError(`Gemini 3.5 Transcribe interaction did not complete (status ${status}).`, { stage: 'stt:gemini' })
  }
  return await pollUntil({
    operationName: 'gemini-stt-poll',
    intervalMs: POLL_INTERVAL_MS,
    deadlineMs: REQUEST_TIMEOUT_MS,
    ...(abortSignal ? { abortSignal } : {}),
    pollFn: async () => await withRetry({
      retryClass: 'runtime_http_poll',
      operationName: 'gemini-stt-poll',
      ...(abortSignal ? { abortSignal } : {})
    }, async (signal) => await geminiGetInteraction(apiKey, interactionId, signal), (error) => classifyFetchRetry(error, 'runtime_http_poll')),
    isDone: (value) => readInteractionStatus(value) === 'completed',
    isFailed: (value) => {
      const current = readInteractionStatus(value)
      if (current === 'failed' || current === 'cancelled' || (isObjectLike(value) && value['error'] !== undefined)) {
        return { failed: true, reason: `Gemini 3.5 Transcribe interaction ${current ?? 'failed'}` }
      }
      return { failed: false }
    }
  })
}

const buildTranscriptionConfig = (diarize: boolean): Record<string, unknown> => ({
  mode: {
    type: 'verbatim',
    timestamp_granularities: ['word'],
    ...(diarize ? { diarization_mode: 'speaker' } : {})
  }
})

export const runGeminiStt = async (
  audioPath: string,
  outputDir: string,
  options: {
    diarizationOptions?: { enabled?: boolean | undefined } | undefined
    model: string
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
    audioDurationSeconds?: number | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const { model, segmentOffsetMinutes = 0, segmentNumber, totalSegments } = options
  if (model !== GEMINI_TRANSCRIBE_MODEL) {
    throw ValidationError(
      `Gemini STT model "${model}" is not supported. Use "${GEMINI_TRANSCRIBE_MODEL}".`,
      { stage: 'stt:gemini' }
    )
  }
  const apiKey = resolveCredential('gemini', 'require', { stage: 'stt:gemini', description: 'Gemini transcription' })
  const diarize = options.diarizationOptions?.enabled !== false

  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle({ provider: 'gemini-stt', action: 'started', segmentNumber, totalSegments, model })
  }

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const mimeType = getAudioMimeType(audioPath)
  const fileSizeBytes = Bun.file(audioPath).size
  if (fileSizeBytes > GEMINI_FILE_UPLOAD_BYTES) {
    throw ValidationError(`Gemini STT input exceeds the 2 GB file upload limit for ${basename(audioPath)}.`, { stage: 'stt:gemini' })
  }

  const transcribeStartedAt = Date.now()
  let uploadedFileName: string | undefined
  const deleteUpload = async (): Promise<void> => {
    if (!uploadedFileName) {
      return
    }
    const name = uploadedFileName
    uploadedFileName = undefined
    try {
      await geminiDeleteFile(apiKey, name)
    } catch (error) {
      l.warn(`Failed to delete Gemini STT upload ${name}: ${error instanceof Error ? error.message : String(error)}`, {
        category: 'pipeline',
        metadata: { provider: 'gemini', uploadedFileName: name },
        error
      })
    }
  }
  let interaction: unknown
  try {
    const created = await withRetry(
      {
        retryClass: 'runtime_http_create_conservative',
        operationName: 'gemini-stt',
        timeoutMs: REQUEST_TIMEOUT_MS
      },
      async (signal) => {
        try {
          const uploadedFile = await geminiUploadFile(apiKey, audioPath, {
            mimeType,
            displayName: basename(audioPath),
            ...(signal ? { abortSignal: signal } : {})
          })
          uploadedFileName = uploadedFile.name ?? undefined
          if (uploadedFileName) {
            await waitForGeminiFileActive(apiKey, uploadedFileName, {
              stage: 'stt:gemini',
              ...(signal ? { abortSignal: signal } : {})
            })
          }
          const fileMimeType = uploadedFile.mimeType ?? mimeType
          if (typeof uploadedFile.uri !== 'string' || uploadedFile.uri.length === 0) {
            throw InfraError('Gemini Files API upload did not return a file URI.', { stage: 'stt:gemini' })
          }
          return await geminiCreateInteraction(apiKey, {
            model: GEMINI_TRANSCRIBE_MODEL,
            input: [
              {
                type: 'audio',
                uri: uploadedFile.uri,
                mime_type: fileMimeType
              }
            ],
            generation_config: {
              transcription_config: buildTranscriptionConfig(diarize)
            }
          }, signal)
        } catch (error) {
          await deleteUpload()
          throw error
        }
      },
      createGeminiRetryClassifier('runtime_http_create_conservative')
    )
    interaction = await waitForCompletedInteraction(apiKey, created)
  } finally {
    await deleteUpload()
  }
  const transcribeMs = Date.now() - transcribeStartedAt

  assertCompletedInteraction(interaction)
  const parsedWords = extractWordAnnotations(interaction).map((annotation) => parseGeminiWord(annotation, offsetSeconds))
    .filter((word): word is NonNullable<typeof word> => word !== undefined)
  const outputText = extractOutputText(interaction)
  const text = outputText.length > 0 ? outputText : textFromWords(parsedWords)
  if (parsedWords.length === 0 && text.length === 0) {
    throw InfraError('Gemini 3.5 Transcribe completed without transcript text or word annotations.', { stage: 'stt:gemini' })
  }
  if (parsedWords.length === 0) {
    throw InfraError('Gemini 3.5 Transcribe completed without word-level timestamps.', { stage: 'stt:gemini' })
  }

  const segments = segmentsFromWords(parsedWords, offsetSeconds)
  const finalized = await finalizeHostedSttResult({
    provider: 'gemini-stt',
    model,
    outputDir,
    segmentNumber,
    totalSegments,
    offsetSeconds,
    startTime,
    transcribeMs,
    requestCount: 1,
    retryCount: 0,
    rateLimitCount: 0,
    text,
    segments,
    evidenceWords: parsedWords.map((word) => word.evidence),
    rawResponse: interaction
  })
  const billing = computeGeminiSttBillingFromUsage(model, readUsageMetadata(interaction))
  if (billing) {
    finalized.metadata.billing = billing
  }
  if (finalized.result.evidence) {
    finalized.result.evidence.source = 'gemini:native-transcribe'
  }
  return finalized
}
