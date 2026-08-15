import type { HostedConcurrencyMode, TtsProvider } from '~/types'
import { normalizeTtsChunkConcurrency, splitTextIntoChunks } from './audio-utils'
import { getTtsMaxInputCharacters } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { estimateHostedConcurrencyWallTimeMs } from '~/utils/hosted-concurrency-estimator'

export const TTS_CHUNK_CHARACTER_LIMITS = {
  kitten: 2000,
  elevenlabs: 2000,
  groq: 200,
  deepgram: 2000,
  speechify: 2000,
  openai: 2000,
  mistral: 2000,
  gemini: 2000,
  cartesia: 2000,
  hume: 2000,
  grok: 2000,
  minimax: 2000,
  fish: 2000,
  inworld: 2000,
  deepinfra: 2000,
  replicate: 2000,
  fal: 2000,
} as const satisfies Record<TtsProvider, number | undefined>

export const resolveTtsChunkCharacterLimit = (
  provider: TtsProvider,
  model: string | undefined
): number | undefined =>
  model ? getTtsMaxInputCharacters(provider, model) ?? TTS_CHUNK_CHARACTER_LIMITS[provider] : TTS_CHUNK_CHARACTER_LIMITS[provider]

const SEQUENTIAL_TTS_CHUNK_PROVIDERS = new Set<TtsProvider>(['kitten'])

const resolveSyntheticChunkLengths = (
  characterCount: number,
  maxChars: number
): number[] => {
  const normalizedCharacterCount = Math.max(0, Math.floor(characterCount))
  const normalizedMaxChars = Math.max(1, Math.floor(maxChars))
  const chunks: number[] = []
  let remaining = normalizedCharacterCount

  while (remaining > normalizedMaxChars) {
    chunks.push(normalizedMaxChars)
    remaining -= normalizedMaxChars
  }

  if (remaining > 0) {
    chunks.push(remaining)
  }

  return chunks
}

const resolveTtsChunkLengths = (
  input: {
    text?: string | undefined
    characterCount: number
    maxChars: number
  }
): number[] => {
  if (typeof input.text === 'string') {
    return splitTextIntoChunks(input.text, input.maxChars).map((chunk) => chunk.length)
  }

  return resolveSyntheticChunkLengths(input.characterCount, input.maxChars)
}

const estimateWorkerPoolWallTimeMs = (
  chunkDurationsMs: readonly number[],
  concurrency: number | undefined
): number => {
  if (chunkDurationsMs.length === 0) {
    return 0
  }

  const workerCount = Math.min(
    normalizeTtsChunkConcurrency(concurrency),
    chunkDurationsMs.length
  )
  const workerTimes = Array.from({ length: workerCount }, () => 0)

  for (const duration of chunkDurationsMs) {
    let nextWorkerIndex = 0
    for (let i = 1; i < workerTimes.length; i += 1) {
      if ((workerTimes[i] ?? 0) < (workerTimes[nextWorkerIndex] ?? 0)) {
        nextWorkerIndex = i
      }
    }
    workerTimes[nextWorkerIndex] = (workerTimes[nextWorkerIndex] ?? 0) + duration
  }

  return Math.max(...workerTimes)
}

export const estimateTtsSynthesisProcessingTimeMs = (
  input: {
    provider: TtsProvider
    model?: string | undefined
    text?: string | undefined
    characterCount: number
    msPer1KChars: number
    setupTimeMs?: number | undefined
    chunkConcurrency?: number | undefined
    concurrencyMode?: HostedConcurrencyMode | undefined
  }
): number => {
  const setupTimeMs = typeof input.setupTimeMs === 'number' && Number.isFinite(input.setupTimeMs)
    ? Math.max(0, input.setupTimeMs)
    : 0
  const normalizedCharacterCount = Math.max(0, Math.floor(input.characterCount))
  const chunkLimit = resolveTtsChunkCharacterLimit(input.provider, input.model)

  if (chunkLimit === undefined || SEQUENTIAL_TTS_CHUNK_PROVIDERS.has(input.provider)) {
    return setupTimeMs + (normalizedCharacterCount / 1000) * input.msPer1KChars
  }

  const chunkLengths = resolveTtsChunkLengths({
    text: input.text,
    characterCount: normalizedCharacterCount,
    maxChars: chunkLimit,
  })
  const chunkDurationsMs = chunkLengths.map((length) =>
    (length / 1000) * input.msPer1KChars
  )

  const concurrency = normalizeTtsChunkConcurrency(input.chunkConcurrency)
  return setupTimeMs + (input.concurrencyMode
    ? estimateHostedConcurrencyWallTimeMs(chunkDurationsMs, concurrency, input.concurrencyMode)
    : estimateWorkerPoolWallTimeMs(chunkDurationsMs, concurrency))
}
