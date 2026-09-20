import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import type { PreparedLocalSttInput } from '~/types'
import { exec } from '~/utils/cli-utils'
import { getFfmpegBinary, getFfprobeBinary } from '~/utils/runtime-paths'
import { InfraError } from '~/utils/error-handler'

const LOCAL_STT_SAMPLE_RATE = 16000
/** 10 ms of silence: the smallest pad that reliably clears a rejected sample count. */
const SAMPLE_COUNT_PAD_SAMPLES = 160

const encodeArgs = (
  inputPath: string,
  outputPath: string,
  format: 'wav' | 'flac',
  filters: string[]
): string[] => [
  '-i', inputPath,
  '-vn',
  '-ar', String(LOCAL_STT_SAMPLE_RATE),
  '-ac', '1',
  ...(filters.length > 0 ? ['-af', filters.join(',')] : []),
  '-c:a', format === 'flac' ? 'flac' : 'pcm_s16le',
  '-y',
  outputPath
]

/**
 * Exact decoded sample count. The stream time base of 16 kHz mono PCM and FLAC is
 * one sample, so duration_ts is the sample count without floating-point rounding.
 */
const readSampleCount = async (path: string): Promise<number | null> => {
  const result = await exec(getFfprobeBinary(), [
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'stream=duration_ts',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    path
  ])
  const parsed = Number.parseInt(result.stdout.trim(), 10)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

export const prepareLocalSttInput = async (
  audioPath: string,
  tempPrefix: string,
  options?: {
    passthroughExtensions?: readonly string[] | undefined
    convertFormat?: 'wav' | 'flac' | undefined
    minimumDurationSeconds?: number | undefined
    /**
     * Sample counts that are an exact multiple of this value are rejected by the
     * caller's decoder, so the prepared file is padded past the boundary.
     */
    rejectedSampleCountMultiple?: number | undefined
  }
): Promise<PreparedLocalSttInput> => {
  const extension = extname(audioPath).toLowerCase()
  if ((options?.passthroughExtensions ?? []).includes(extension)) {
    return {
      audioPath,
      cleanup: async () => {}
    }
  }

  const convertFormat = options?.convertFormat ?? 'wav'
  const workspaceDir = await mkdtemp(join(tmpdir(), tempPrefix))
  const outputPath = join(workspaceDir, convertFormat === 'flac' ? 'input.flac' : 'input.wav')
  const minimumDurationSeconds = options?.minimumDurationSeconds
  const baseFilters = minimumDurationSeconds ? [`apad=whole_dur=${minimumDurationSeconds}`] : []

  const encode = async (filters: string[]): Promise<void> => {
    const result = await exec(getFfmpegBinary(), encodeArgs(audioPath, outputPath, convertFormat, filters))
    if (result.exitCode !== 0) {
      throw InfraError(`Failed to prepare local STT input: ${result.stderr}`, { stage: 'stt:local-normalize' })
    }
  }

  try {
    await encode(baseFilters)

    const rejectedMultiple = options?.rejectedSampleCountMultiple
    if (rejectedMultiple !== undefined && rejectedMultiple > 0) {
      const samples = await readSampleCount(outputPath)
      if (samples !== null && samples % rejectedMultiple === 0) {
        await encode([...baseFilters, `apad=pad_len=${SAMPLE_COUNT_PAD_SAMPLES}`])
      }
    }

    return {
      audioPath: outputPath,
      cleanup: async () => {
        await rm(workspaceDir, { recursive: true, force: true })
      }
    }
  } catch (error) {
    await rm(workspaceDir, { recursive: true, force: true })
    throw error
  }
}
