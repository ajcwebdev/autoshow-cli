import type { ObservedAudioFormat } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { getFfprobeBinary } from '~/utils/runtime-paths'
import { childEnv } from '~/utils/child-env'

export const inspectSoundscapeAudio = async (path: string): Promise<{ format: ObservedAudioFormat, durationMs: number }> => {
  const bytes = Buffer.from(await Bun.file(path).arrayBuffer())
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE') {
    let sampleRate = 0
    let channels = 0
    let bitsPerSample = 0
    let byteRate = 0
    let dataBytes = 0
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const kind = bytes.toString('ascii', offset, offset + 4)
      const size = bytes.readUInt32LE(offset + 4)
      const content = offset + 8
      if (kind === 'fmt ' && content + 16 <= bytes.length) {
        channels = bytes.readUInt16LE(content + 2)
        sampleRate = bytes.readUInt32LE(content + 4)
        byteRate = bytes.readUInt32LE(content + 8)
        bitsPerSample = bytes.readUInt16LE(content + 14)
      } else if (kind === 'data') dataBytes += Math.min(size, Math.max(0, bytes.length - content))
      offset = content + size + (size % 2)
    }
    if (sampleRate <= 0 || channels <= 0 || byteRate <= 0 || dataBytes <= 0) throw UsageError(`Soundscape WAV has invalid or empty audio metadata: ${path}`)
    return { format: { codec: bitsPerSample === 24 ? 'pcm_s24le' : 'pcm_s16le', container: 'wav', sampleRate, channels }, durationMs: Math.round(dataBytes / byteRate * 1000) }
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
