import type { HostedConcurrencyMode, TtsProvider } from '~/types'
import { normalizeTtsChunkConcurrency } from './audio-utils'
import { resolveTtsChunkCharacterLimit } from './tts-chunk-limits'
export { resolveTtsChunkCharacterLimit, TTS_CHUNK_CHARACTER_LIMITS } from './tts-chunk-limits'
import { planProviderTtsChunks } from './tts-provider-chunk-policy'
import { estimateHostedConcurrencyWallTimeMs } from '~/utils/hosted-concurrency-estimator'

export const resolveSyntheticChunkLengths = (
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
    provider: TtsProvider
    model?: string | undefined
    text?: string | undefined
    characterCount: number
    maxChars: number
  }
): number[] => {
  if (typeof input.text === 'string') {
    return planProviderTtsChunks({ provider: input.provider, model: input.model ?? '', text: input.text, characterLimit: input.maxChars }).map(chunk => chunk.text.length)
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
    chunkLengths?: readonly number[] | undefined
    chunkCharacterLimit?: number | undefined
    chunkConcurrency?: number | undefined
    concurrencyMode?: HostedConcurrencyMode | undefined
  }
): number => {
  const setupTimeMs = typeof input.setupTimeMs === 'number' && Number.isFinite(input.setupTimeMs)
    ? Math.max(0, input.setupTimeMs)
    : 0
  const normalizedCharacterCount = Math.max(0, Math.floor(input.characterCount))
  const chunkLimit = input.chunkCharacterLimit ?? resolveTtsChunkCharacterLimit(input.provider, input.model)

  if (chunkLimit === undefined) {
    return setupTimeMs + (normalizedCharacterCount / 1000) * input.msPer1KChars
  }

  const chunkLengths = input.chunkLengths ?? resolveTtsChunkLengths({
    provider: input.provider, model: input.model,
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
