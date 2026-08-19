import { resolve } from 'node:path'
import type { HostedTtsChunkAdmissionToken, RunTtsChunksOptions, TtsMasteringProfile } from '~/types'
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
  runChunk: (chunk: string, index: number, admission?: HostedTtsChunkAdmissionToken | undefined) => Promise<T>,
  options: RunTtsChunksOptions = {}
): Promise<T[]> => {
  if (options.provider) {
    const scheduler = options.scheduler ?? createHostedTtsChunkScheduler(concurrency)
    return await scheduler.runChunks(options.provider, chunks, runChunk, {
      job: options.job,
      scopeLabel: options.scopeLabel,
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
  abortSignal?: AbortSignal | undefined,
  profile?: TtsMasteringProfile | undefined
): Promise<string> => {
  abortSignal?.throwIfAborted()
  const wavPath = `${outputDir}/speech.wav`
  const sampleRate = profile?.sampleRate ?? 16000
  const channels = profile?.channels ?? 1
  const codec = profile?.codec ?? 'pcm_s16le'

  if (chunkPaths.length === 1) {
    const ffmpeg = await exec(getFfmpegBinary(), [
      '-i', chunkPaths[0] as string,
      '-ar', String(sampleRate),
      '-ac', String(channels),
      '-c:a', codec,
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
      '-ar', String(sampleRate),
      '-ac', String(channels),
      '-c:a', codec,
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

export const mixAudioToWav = async (
  inputPaths: readonly string[],
  outputPath: string,
  providerLabel: string,
  profile: TtsMasteringProfile,
  abortSignal?: AbortSignal | undefined
): Promise<string> => {
  if (inputPaths.length < 2) throw InfraError(`${providerLabel} overlap mixing requires at least two audio inputs.`, { stage: 'tts:audio-utils' })
  abortSignal?.throwIfAborted()
  const inputs = inputPaths.flatMap(path => ['-i', path])
  const inputLabels = inputPaths.map((_, index) => `[${index}:a]`).join('')
  const filter = `${inputLabels}amix=inputs=${inputPaths.length}:duration=longest:normalize=1,alimiter=limit=0.95[aout]`
  const ffmpeg = await exec(getFfmpegBinary(), [
    ...inputs,
    '-filter_complex', filter,
    '-map', '[aout]',
    '-ar', String(profile.sampleRate),
    '-ac', String(profile.channels),
    '-c:a', profile.codec,
    '-y',
    outputPath,
  ], { signal: abortSignal })
  if (ffmpeg.exitCode !== 0) throw InfraError(`Failed to mix ${providerLabel} overlap audio: ${ffmpeg.stderr.trim()}`, { stage: 'tts:audio-utils' })
  return outputPath
}

export const filterAudioToWav = async (
  inputPath: string,
  outputPath: string,
  providerLabel: string,
  audioFilter: string,
  profile: TtsMasteringProfile,
  abortSignal?: AbortSignal | undefined
): Promise<string> => {
  abortSignal?.throwIfAborted()
  const ffmpeg = await exec(getFfmpegBinary(), [
    '-i', inputPath,
    '-af', audioFilter,
    '-ar', String(profile.sampleRate),
    '-ac', String(profile.channels),
    '-c:a', profile.codec,
    '-y',
    outputPath,
  ], { signal: abortSignal })
  if (ffmpeg.exitCode !== 0) throw InfraError(`Failed to apply ${providerLabel} voice effect: ${ffmpeg.stderr.trim()}`, { stage: 'tts:audio-utils' })
  return outputPath
}

export const createSilenceWav = async (
  outputPath: string,
  durationMs: number,
  profile: TtsMasteringProfile,
  abortSignal?: AbortSignal | undefined
): Promise<string> => {
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0) throw InfraError('Silence duration must be a positive integer number of milliseconds.', { stage: 'tts:audio-utils' })
  abortSignal?.throwIfAborted()
  const channelLayout = profile.channels === 1 ? 'mono' : 'stereo'
  const ffmpeg = await exec(getFfmpegBinary(), [
    '-f', 'lavfi',
    '-i', `anullsrc=r=${profile.sampleRate}:cl=${channelLayout}`,
    '-t', (durationMs / 1000).toFixed(3),
    '-ar', String(profile.sampleRate),
    '-ac', String(profile.channels),
    '-c:a', profile.codec,
    '-y',
    outputPath,
  ], { signal: abortSignal })
  if (ffmpeg.exitCode !== 0) throw InfraError(`Failed to create deterministic silence: ${ffmpeg.stderr.trim()}`, { stage: 'tts:audio-utils' })
  return outputPath
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
