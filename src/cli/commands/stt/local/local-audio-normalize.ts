import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import type { PreparedLocalSttInput } from '~/types'
import { exec } from '~/utils/cli-utils'
import { getFfmpegBinary } from '~/utils/runtime-paths'
import { InfraError } from '~/utils/error-handler'

const wavEncodeArgs = (inputPath: string, outputPath: string): string[] => [
  '-i', inputPath,
  '-vn',
  '-ar', '16000',
  '-ac', '1',
  '-c:a', 'pcm_s16le',
  '-y',
  outputPath
]

const mp3EncodeArgs = (inputPath: string, outputPath: string): string[] => [
  '-i', inputPath,
  '-vn',
  '-ar', '16000',
  '-ac', '1',
  '-c:a', 'libmp3lame',
  '-q:a', '4',
  '-y',
  outputPath
]

export const prepareLocalSttInput = async (
  audioPath: string,
  tempPrefix: string,
  options?: {
    passthroughExtensions?: readonly string[] | undefined
    convertFormat?: 'wav' | 'mp3' | undefined
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
  const outputPath = join(workspaceDir, convertFormat === 'mp3' ? 'input.mp3' : 'input.wav')

  try {
    const result = await exec(
      getFfmpegBinary(),
      convertFormat === 'mp3' ? mp3EncodeArgs(audioPath, outputPath) : wavEncodeArgs(audioPath, outputPath)
    )

    if (result.exitCode !== 0) {
      throw InfraError(`Failed to prepare local STT input: ${result.stderr}`, { stage: 'stt:local-normalize' })
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
