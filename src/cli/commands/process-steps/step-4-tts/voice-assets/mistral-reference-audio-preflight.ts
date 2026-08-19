import { resolve } from 'node:path'

import { getFfmpegBinary, getFfprobeBinary } from '~/utils/runtime-paths'
import { CLIUsageError } from '~/utils/error-handler'
import type { MistralReferenceAudioProbeRunner, MistralReferenceAudioProbeStatus } from '~/types'

const runReadOnlyProbe: MistralReferenceAudioProbeRunner = async (command, args) => {
  try {
    const process = Bun.spawn([command, ...args], { stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
      process.exited
    ])
    return { exitCode, stdout, stderr }
  } catch (error) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error)
    }
  }
}

// This is deliberately a decode-to-null probe: it verifies both stream selection and the exact
// local conversion path without creating a temporary output or exposing the protected edge path in
// errors/artifacts. Global readiness separately explains missing/broken ffmpeg prerequisites.
export const assertMistralReferenceAudioDecodable = async (
  sourcePath: string,
  runner: MistralReferenceAudioProbeRunner = runReadOnlyProbe
): Promise<MistralReferenceAudioProbeStatus> => {
  const runtimeChecks = await Promise.all([
    runner(getFfprobeBinary(), ['-version']).catch(() => ({ exitCode: 1, stdout: '', stderr: '' })),
    runner(getFfmpegBinary(), ['-version']).catch(() => ({ exitCode: 1, stdout: '', stderr: '' }))
  ])
  if (runtimeChecks.some((result) => result.exitCode !== 0)) return 'runtime-unavailable'

  const resolvedSourcePath = resolve(sourcePath)
  const stream = await runner(getFfprobeBinary(), [
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'stream=codec_type',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    resolvedSourcePath
  ])
  if (stream.exitCode !== 0 || !stream.stdout.split(/\s+/).includes('audio')) {
    throw CLIUsageError('Protected Mistral reference audio is not a decodable audio input.')
  }

  const decode = await runner(getFfmpegBinary(), [
    '-v', 'error',
    '-nostdin',
    '-i', resolvedSourcePath,
    '-map', '0:a:0',
    '-f', 'null',
    '-'
  ])
  if (decode.exitCode !== 0) {
    throw CLIUsageError('Protected Mistral reference audio cannot be converted by the ready local audio runtime.')
  }
  return 'ready'
}
