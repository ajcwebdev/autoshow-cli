import { resolve } from 'node:path'
import type { RunTtsChunksOptions } from '~/types'
import { exec } from '~/utils/cli-utils'
import { getFfmpegBinary } from '~/utils/runtime-paths'
import { InfraError } from '~/utils/error-handler'
import { createHostedTtsChunkScheduler, normalizeHostedTtsChunkConcurrency } from './hosted-tts-chunk-scheduler'

export const splitTextIntoChunks = (text: string, maxChars: number): string[] => {
  const chunks: string[] = []
  let remaining = text.trim()

  while (remaining.length > maxChars) {
    let splitAt = remaining.lastIndexOf('\n', maxChars)
    if (splitAt < Math.floor(maxChars * 0.5)) {
      splitAt = remaining.lastIndexOf(' ', maxChars)
    }
    if (splitAt < Math.floor(maxChars * 0.5)) {
      splitAt = maxChars
    }

    const chunk = remaining.slice(0, splitAt).trim()
    if (chunk.length > 0) {
      chunks.push(chunk)
    }
    remaining = remaining.slice(splitAt).trim()
  }

  if (remaining.length > 0) {
    chunks.push(remaining)
  }

  return chunks
}

export const normalizeTtsChunkConcurrency = (concurrency: number | undefined): number => {
  return normalizeHostedTtsChunkConcurrency(concurrency)
}

export const runTtsChunks = async <T>(
  chunks: readonly string[],
  concurrency: number | undefined,
  runChunk: (chunk: string, index: number) => Promise<T>,
  options: RunTtsChunksOptions = {}
): Promise<T[]> => {
  if (options.provider) {
    const scheduler = options.scheduler ?? createHostedTtsChunkScheduler(concurrency)
    return await scheduler.runChunks(options.provider, chunks, runChunk, {
      job: options.job,
      abortSignal: options.abortSignal
    })
  }

  const normalizedConcurrency = normalizeTtsChunkConcurrency(concurrency)
  const results = new Array<T>(chunks.length)
  let nextIndex = 0
  let firstError: unknown

  const worker = async (): Promise<void> => {
    while (true) {
      if (firstError !== undefined) return
      const index = nextIndex
      nextIndex += 1
      if (index >= chunks.length) return

      try {
        results[index] = await runChunk(chunks[index] as string, index)
      } catch (error) {
        if (firstError === undefined) {
          firstError = error
        }
        return
      }
    }
  }

  const workerCount = Math.min(normalizedConcurrency, chunks.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))

  if (firstError !== undefined) {
    throw firstError
  }

  return results
}

export const concatAndConvertToWav = async (
  chunkPaths: string[],
  outputDir: string,
  providerLabel: string,
  abortSignal?: AbortSignal | undefined
): Promise<string> => {
  abortSignal?.throwIfAborted()
  const wavPath = `${outputDir}/speech.wav`

  if (chunkPaths.length === 1) {
    const ffmpeg = await exec(getFfmpegBinary(), [
      '-i', chunkPaths[0] as string,
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      '-y',
      wavPath
    ], { signal: abortSignal })
    if (ffmpeg.exitCode !== 0) {
      throw InfraError(`Failed to convert ${providerLabel} audio to WAV: ${ffmpeg.stderr.trim()}`, { stage: 'tts:audio-utils' })
    }
    return wavPath
  }

  const concatListPath = `${outputDir}/speech-${providerLabel.toLowerCase()}-chunks.txt`
  const concatList = chunkPaths
    .map(path => `file '${resolve(path).replace(/'/g, `'\\''`)}'`)
    .join('\n')
  await Bun.write(concatListPath, `${concatList}\n`)

  try {
    const ffmpeg = await exec(getFfmpegBinary(), [
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      '-y',
      wavPath
    ], { signal: abortSignal })

    if (ffmpeg.exitCode !== 0) {
      throw InfraError(`Failed to concatenate ${providerLabel} audio chunks: ${ffmpeg.stderr.trim()}`, { stage: 'tts:audio-utils' })
    }

    return wavPath
  } finally {
    await Bun.$`rm -f ${concatListPath}`.quiet().nothrow()
  }
}

export const convertAudioToWav = async (
  inputPath: string,
  outputPath: string,
  providerLabel: string,
  purposeLabel = 'audio',
  abortSignal?: AbortSignal | undefined
): Promise<string> => {
  abortSignal?.throwIfAborted()
  const ffmpeg = await exec(getFfmpegBinary(), [
    '-i', inputPath,
    '-vn',
    '-map', '0:a:0',
    '-ar', '16000',
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    '-y',
    outputPath
  ], { signal: abortSignal })

  if (ffmpeg.exitCode !== 0) {
    throw InfraError(`Failed to convert ${providerLabel} ${purposeLabel} to WAV: ${ffmpeg.stderr.trim()}`, { stage: 'tts:audio-utils' })
  }

  return outputPath
}
