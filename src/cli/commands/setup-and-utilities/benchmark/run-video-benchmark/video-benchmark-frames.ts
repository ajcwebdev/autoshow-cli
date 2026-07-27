import { mkdir } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { exec } from '~/utils/cli-utils'
import { CLIUsageError } from '~/utils/error-handler'
import { getFfmpegBinary, getFfprobeBinary, hasRuntimeTool } from '~/utils/runtime-paths'
import { round2 } from '../benchmark-utils'
import { VIDEO_FRAME_COUNT } from './video-benchmark-constants'
import type { VideoBenchmarkProvider, VideoFileReference, VideoFrame } from '~/types'

export const requireVideoTools = (): void => {
  const missing = ['ffmpeg', 'ffprobe'].filter((command) => !hasRuntimeTool(command as 'ffmpeg' | 'ffprobe'))
  if (missing.length > 0) {
    throw CLIUsageError(`benchmark --video requires ${missing.join(' and ')} to extract quality frames. Install ffmpeg/ffprobe and rerun.`)
  }
}

const parseDuration = (raw: string): number | undefined => {
  const duration = Number.parseFloat(raw.trim())
  return Number.isFinite(duration) && duration > 0 ? duration : undefined
}

const probeVideoDuration = async (video: VideoFileReference): Promise<number> => {
  const result = await exec(getFfprobeBinary(), [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    video.path
  ])
  const probedDuration = result.exitCode === 0 ? parseDuration(result.stdout) : undefined
  if (probedDuration !== undefined) {
    return probedDuration
  }

  if (video.metadataDurationSeconds !== undefined && video.metadataDurationSeconds > 0) {
    return video.metadataDurationSeconds
  }

  const stderr = result.stderr.trim()
  throw CLIUsageError(`Could not determine video duration for ${video.fileName}. ffprobe failed${stderr ? `: ${stderr}` : ''} and metadata.videoDuration is missing.`)
}

const slugPart = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug.length > 0 ? slug : 'video'
}

const videoStem = (fileName: string): string => {
  const extension = extname(fileName)
  return basename(fileName, extension)
}

const formatTimestampArg = (seconds: number): string => seconds.toFixed(3)

const extractFrameAtTimestamp = async (
  video: VideoFileReference,
  framePath: string,
  timestampSeconds: number
): Promise<boolean> => {
  const result = await exec(getFfmpegBinary(), [
    '-hide_banner',
    '-loglevel', 'error',
    '-ss', formatTimestampArg(timestampSeconds),
    '-i', video.path,
    '-frames:v', '1',
    '-y',
    framePath
  ])
  return result.exitCode === 0 && await Bun.file(framePath).exists()
}

const fallbackTimestamp = (timestampSeconds: number, durationSeconds: number): number => {
  const backoff = Math.min(Math.max(durationSeconds / VIDEO_FRAME_COUNT, 0.1), Math.max(durationSeconds / 2, 0.001))
  return Math.max(0, Math.min(timestampSeconds - 0.001, durationSeconds - backoff))
}

export const extractVideoFrames = async (
  runDir: string,
  provider: VideoBenchmarkProvider,
  video: VideoFileReference
): Promise<{ durationSeconds: number, frames: VideoFrame[] }> => {
  const durationSeconds = await probeVideoDuration(video)
  const providerSlug = slugPart(`${provider.provider}-${provider.model}`)
  const stem = slugPart(videoStem(video.fileName))
  const frameDir = join(runDir, 'video-quality-frames', providerSlug, stem)
  await mkdir(frameDir, { recursive: true })

  const frames: VideoFrame[] = []
  for (let index = 0; index < VIDEO_FRAME_COUNT; index++) {
    const timestampSeconds = round2(((index + 0.5) * durationSeconds) / VIDEO_FRAME_COUNT)
    const frameName = `frame-${String(index + 1).padStart(2, '0')}.png`
    const framePath = join(frameDir, frameName)
    const extracted = await extractFrameAtTimestamp(video, framePath, timestampSeconds)
      || await extractFrameAtTimestamp(video, framePath, fallbackTimestamp(timestampSeconds, durationSeconds))
    if (!extracted) {
      throw CLIUsageError(`Failed to extract video benchmark frame ${index + 1} from ${video.fileName}: ffmpeg did not write ${frameName}`)
    }
    frames.push({
      index: index + 1,
      timestampSeconds,
      fileName: framePath.slice(runDir.length + 1),
      path: framePath
    })
  }

  return {
    durationSeconds,
    frames
  }
}
