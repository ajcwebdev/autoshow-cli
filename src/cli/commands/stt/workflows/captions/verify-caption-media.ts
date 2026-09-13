import { childEnv } from '~/utils/child-env'
import { getFfmpegBinary, getFfprobeBinary } from '~/utils/runtime-paths'
import { ValidationError } from '~/utils/error-handler'

const capture = async (args: string[]): Promise<string> => {
  const child = Bun.spawn(args, { env: childEnv(), stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' })
  const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  if (code !== 0) throw ValidationError(`Media verification failed (${code}): ${err.trim()}`)
  return out.trim()
}

export const decodedAudioHash = async (source: string): Promise<string> => capture([getFfmpegBinary(), '-v', 'error', '-nostdin', '-i', source, '-map', '0:a:0', '-c:a', 'pcm_f32le', '-f', 'hash', '-hash', 'sha256', '-'])

export const verifyCopiedCaptionStream = async (source: string, output: string, sourceIndex: number, outputIndex: number) => {
  const inspect = async (path: string, index: number) => {
    const [hash, raw] = await Promise.all([
      capture([getFfmpegBinary(), '-v', 'error', '-nostdin', '-i', path, '-map', `0:${index}`, '-c', 'copy', '-f', 'hash', '-hash', 'sha256', '-']),
      capture([getFfprobeBinary(), '-v', 'error', '-select_streams', String(index), '-show_packets', '-show_entries', 'packet=pts_time', '-of', 'json', path])
    ])
    const packets = (JSON.parse(raw) as { packets: { pts_time?: string }[] }).packets
    return { hash, packets }
  }
  const [original, copied] = await Promise.all([inspect(source, sourceIndex), inspect(output, outputIndex)])
  if (original.hash !== copied.hash || original.packets.length !== copied.packets.length) throw ValidationError(`Copied stream #${sourceIndex} payload or packet count changed.`)
  let maximumTimestampDifferenceSeconds = 0
  for (let index = 0; index < original.packets.length; index++) {
    const before = original.packets[index]!.pts_time, after = copied.packets[index]!.pts_time
    if (before === undefined && after === undefined) continue
    const difference = Math.abs(Number(before) - Number(after))
    if (!Number.isFinite(difference) || difference > .001001) throw ValidationError(`Copied stream #${sourceIndex} changed packet ${index} timing.`)
    maximumTimestampDifferenceSeconds = Math.max(maximumTimestampDifferenceSeconds, difference)
  }
  return { sourceIndex, outputIndex, sha256: original.hash, packetCount: original.packets.length, maximumTimestampDifferenceSeconds }
}
