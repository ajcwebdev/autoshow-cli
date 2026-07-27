import { resolve } from 'node:path'
import type { RunTtsChunksOptions } from '~/types'
import { exec } from '~/utils/cli-utils'
import { getFfmpegBinary } from '~/utils/runtime-paths'
import { InfraError, ValidationError } from '~/utils/error-handler'
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

const utf8ByteLength = (value: string): number =>
  Buffer.byteLength(value, 'utf8')

export const splitTextIntoUtf8ByteChunks = (text: string, maxBytes: number): string[] => {
  const chunks: string[] = []
  let remaining = text.trim()

  while (utf8ByteLength(remaining) > maxBytes) {
    let best = ''
    let bestIndex = 0
    let current = ''
    let currentBytes = 0

    for (const char of remaining) {
      const nextBytes = currentBytes + utf8ByteLength(char)
      if (nextBytes > maxBytes) {
        break
      }

      current += char
      currentBytes = nextBytes
      if (/\s/.test(char)) {
        best = current.trim()
        bestIndex = current.length
      }
    }

    if (!best) {
      best = current.trim()
      bestIndex = current.length
    }
    if (!best) {
      throw ValidationError(`Unable to split TTS input into ${maxBytes}-byte chunks.`, { stage: 'tts:audio-utils' })
    }

    chunks.push(best)
    remaining = remaining.slice(bestIndex).trim()
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
    return await scheduler.runChunks(options.provider, chunks, runChunk, { job: options.job })
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
  providerLabel: string
): Promise<string> => {
  const wavPath = `${outputDir}/speech.wav`

  if (chunkPaths.length === 1) {
    const ffmpeg = await exec(getFfmpegBinary(), [
      '-i', chunkPaths[0] as string,
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      '-y',
      wavPath
    ])
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

  const ffmpeg = await exec(getFfmpegBinary(), [
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
    '-ar', '16000',
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    '-y',
    wavPath
  ])

  if (ffmpeg.exitCode !== 0) {
    throw InfraError(`Failed to concatenate ${providerLabel} audio chunks: ${ffmpeg.stderr.trim()}`, { stage: 'tts:audio-utils' })
  }

  await Bun.$`rm -f ${concatListPath}`.quiet().nothrow()
  return wavPath
}

export const convertAudioToWav = async (
  inputPath: string,
  outputPath: string,
  providerLabel: string,
  purposeLabel = 'audio'
): Promise<string> => {
  const ffmpeg = await exec(getFfmpegBinary(), [
    '-i', inputPath,
    '-vn',
    '-map', '0:a:0',
    '-ar', '16000',
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    '-y',
    outputPath
  ])

  if (ffmpeg.exitCode !== 0) {
    throw InfraError(`Failed to convert ${providerLabel} ${purposeLabel} to WAV: ${ffmpeg.stderr.trim()}`, { stage: 'tts:audio-utils' })
  }

  return outputPath
}
