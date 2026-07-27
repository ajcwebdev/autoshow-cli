import { exec } from '~/utils/cli-utils'
import * as l from '~/utils/app-logger/app-logger'
import type { AudioVariant } from '~/types'
import { getFfmpegBinary } from '~/utils/runtime-paths'
import { InfraError } from '~/utils/error-handler'

const buildAtempoFilterChain = (speed: number): string => {
  const filters: string[] = []
  let remaining = speed
  while (remaining > 2.0) {
    filters.push('atempo=2.0')
    remaining /= 2.0
  }
  filters.push(`atempo=${remaining}`)
  return filters.join(',')
}

export const generateCompressionVariant = async (
  sourcePath: string,
  outputPath: string,
  bitrateKbps: number
): Promise<AudioVariant> => {
  const bitrate = String(bitrateKbps * 1000)
  const label = `${bitrateKbps}k`

  l.write('info', `  Generating compression variant: ${label}`)
  const { exitCode, stderr } = await exec(getFfmpegBinary(), [
    '-i', sourcePath,
    '-map', '0:a:0',
    '-vn',
    '-map_metadata', '-1',
    '-map_chapters', '-1',
    '-c:a', 'aac',
    '-profile:a', 'aac_low',
    '-b:a', bitrate,
    '-ac', '1',
    '-f', 'ipod',
    '-y', outputPath
  ])

  if (exitCode !== 0) {
    throw InfraError(`ffmpeg failed generating ${label} variant: ${stderr}`, { stage: 'benchmark:audio-variants' })
  }

  return { path: outputPath, kind: 'compression', label, bitrateKbps }
}

export const generateSpeedVariant = async (
  sourcePath: string,
  outputPath: string,
  speedMultiplier: number
): Promise<AudioVariant> => {
  const label = `${speedMultiplier}x`
  const filterChain = buildAtempoFilterChain(speedMultiplier)

  l.write('info', `  Generating speed variant: ${label}`)
  const { exitCode, stderr } = await exec(getFfmpegBinary(), [
    '-i', sourcePath,
    '-filter:a', filterChain,
    '-map_metadata', '-1',
    '-map_chapters', '-1',
    '-c:a', 'aac',
    '-profile:a', 'aac_low',
    '-b:a', '96000',
    '-ac', '1',
    '-f', 'ipod',
    '-y', outputPath
  ])

  if (exitCode !== 0) {
    throw InfraError(`ffmpeg failed generating ${label} variant: ${stderr}`, { stage: 'benchmark:audio-variants' })
  }

  return { path: outputPath, kind: 'speed', label, speedMultiplier }
}
