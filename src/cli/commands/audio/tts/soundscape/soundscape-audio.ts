import type { ObservedAudioFormat } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { getFfprobeBinary } from '~/utils/runtime-paths'
import { childEnv } from '~/utils/child-env'
import { parseWaveMetadata, wavePcmFormat } from '../tts-utils/wave-metadata'

export const inspectSoundscapeAudio = async (path: string): Promise<{ format: ObservedAudioFormat, durationMs: number }> => {
  const bytes = Buffer.from(await Bun.file(path).arrayBuffer())
  const wave = parseWaveMetadata(bytes)
  if (wave) {
    // Composition needs a real duration, so a zero byte rate or empty data is rejected.
    if (wave.sampleRate <= 0 || wave.channels <= 0 || wave.byteRate <= 0 || wave.dataBytes <= 0) throw UsageError(`Soundscape WAV has invalid or empty audio metadata: ${path}`)
    return { format: wavePcmFormat(wave), durationMs: Math.round(wave.dataBytes / wave.byteRate * 1000) }
  }
  const process = Bun.spawn([getFfprobeBinary(), '-v', 'error', '-show_entries', 'format=format_name,duration:stream=codec_name,sample_rate,channels', '-of', 'json', path], { env: childEnv(), stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, code] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited])
  if (code !== 0) throw UsageError(`Could not inspect generated sound audio: ${stderr.trim() || `ffprobe exited ${code}`}`)
  const parsed = JSON.parse(stdout) as { streams?: Array<{ codec_name?: string, sample_rate?: string, channels?: number }>, format?: { format_name?: string, duration?: string } }
  const stream = parsed.streams?.[0]
  const sampleRate = Number(stream?.sample_rate)
  const channels = Number(stream?.channels)
  const durationSeconds = Number(parsed.format?.duration)
  if (!stream?.codec_name || !Number.isFinite(sampleRate) || sampleRate <= 0 || !Number.isSafeInteger(channels) || channels <= 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0) throw UsageError('Generated sound audio inspection returned incomplete format or duration evidence.')
  return { format: { codec: stream.codec_name, container: parsed.format?.format_name?.split(',')[0] ?? 'unknown', sampleRate, channels }, durationMs: Math.round(durationSeconds * 1000) }
}
