import { getFfmpegBinary } from '~/utils/runtime-paths'
import { childEnv } from '~/utils/child-env'
import { UsageError } from '~/utils/error-handler'
import { getAudioDuration } from '~/cli/commands/stt/stt-utils/audio-splitter'

export const validateGeminiReferenceRecording = async (path: string, consent = false): Promise<number> => {
  const duration = await getAudioDuration(path)
  if (!Number.isFinite(duration) || duration <= 0 || !consent && (duration < 10 || duration > 30)) throw UsageError(consent ? 'Gemini consent audio must have a positive verified duration.' : 'Gemini reference recording must be 10-30 seconds.')
  const process = Bun.spawn([getFfmpegBinary(), '-v', 'error', '-xerror', '-nostdin', '-i', path, '-map', '0:a:0', '-f', 'null', '-'], { env: childEnv(), stdout: 'ignore', stderr: 'pipe' })
  const [exitCode, errors] = await Promise.all([process.exited, new Response(process.stderr).text()])
  if (exitCode !== 0 || errors.trim()) throw UsageError('Gemini recording must decode completely before upload.')
  return Math.round(duration * 1000)
}
