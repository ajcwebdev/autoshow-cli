import type { LyricsVideoOverlaySource } from '~/types'
import { exec } from '~/utils/cli-utils'
import { getFfmpegBinary } from '~/utils/runtime-paths'

let encoderPromise: Promise<string> | undefined
let ffmpegFiltersPromise: Promise<string> | undefined

export const checkFfmpegEncoder = async (encoder: string, execute = exec): Promise<boolean> => {
  // FFmpeg can list hardware encoders whose device or driver is unavailable in a container.
  // Encode one synthetic frame before choosing hardware for the full render.
  try {
    const result = await execute(getFfmpegBinary(), [
      '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=320x240:r=1',
      '-frames:v', '1', '-an', '-c:v', encoder, '-pix_fmt', 'yuv420p', '-f', 'null', '-'
    ], { signal: AbortSignal.timeout(5000), maxBufferBytes: 4096 })
    return result.exitCode === 0
  } catch {
    return false
  }
}

export const readFfmpegFilters = async (): Promise<string> => {
  if (!ffmpegFiltersPromise) {
    ffmpegFiltersPromise = exec(getFfmpegBinary(), ['-hide_banner', '-filters']).then((result) => result.stdout)
  }

  return await ffmpegFiltersPromise
}

export const hasFfmpegFilter = async (filterName: string): Promise<boolean> => {
  const filters = await readFfmpegFilters()
  return filters.split('\n').some((line) => line.trim().split(/\s+/).includes(filterName))
}

export const selectLyricsEncoder = async (probe = checkFfmpegEncoder, platform = process.platform): Promise<string> => {
  if (platform === 'darwin' && await probe('h264_videotoolbox')) return 'h264_videotoolbox'
  if (await probe('h264_nvenc')) return 'h264_nvenc'
  if (await probe('h264_amf')) return 'h264_amf'
  return 'libx264'
}

export const detectLyricsEncoder = async (): Promise<string> => {
  encoderPromise ??= selectLyricsEncoder()
  return await encoderPromise
}

export const getEncoderSettings = (encoder: string): string[] => {
  switch (encoder) {
    case 'h264_videotoolbox':
      return ['-c:v', 'h264_videotoolbox', '-b:v', '8M', '-profile:v', 'high', '-allow_sw', '1', '-movflags', '+faststart']
    case 'h264_nvenc':
      return ['-c:v', 'h264_nvenc', '-preset', 'p4', '-cq', '23', '-b:v', '0', '-profile:v', 'high', '-movflags', '+faststart']
    case 'h264_amf':
      return ['-c:v', 'h264_amf', '-quality', 'balanced', '-rc', 'cqp', '-qp_i', '23', '-movflags', '+faststart']
    default:
      return ['-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-tune', 'stillimage', '-threads', '0', '-movflags', '+faststart']
  }
}

export const buildImageBackgroundFilter = (options: {
  width: number
  height: number
  includeEq: boolean
}): string =>
  [
    '[0:v]',
    `scale=${options.width}:${options.height}:force_original_aspect_ratio=increase:flags=lanczos`,
    `,crop=${options.width}:${options.height}`,
    ',setpts=PTS-STARTPTS',
    ...(options.includeEq ? [',eq=brightness=-0.15:contrast=0.85'] : []),
    ',vignette=PI/3.5',
    '[bg]'
  ].join('')

export const buildLyricsVideoFfmpegArgs = (options: {
  audioPath: string
  outputRelativePath: string
  width: number
  height: number
  fps: number
  encoderSettings: readonly string[]
  includeEq: boolean
  overlay: LyricsVideoOverlaySource
  imageRelativePath?: string | undefined
}): string[] => {
  const imageInput = options.imageRelativePath
    ? ['-noautorotate', '-loop', '1', '-i', options.imageRelativePath]
    : []
  const overlayInput = options.overlay.kind === 'frames'
    ? ['-f', 'concat', '-safe', '0', '-i', options.overlay.path]
    : []
  const audioInput = ['-i', options.audioPath]
  const inputArgs = options.imageRelativePath
    ? [...imageInput, ...overlayInput, ...audioInput]
    : [...audioInput, ...overlayInput]
  const backgroundFilter = options.imageRelativePath
    ? buildImageBackgroundFilter({
        width: options.width,
        height: options.height,
        includeEq: options.includeEq
      })
    : [
        '[0:a]',
        `showspectrum=s=${options.width}x${options.height}:mode=combined:color=intensity:scale=log`,
        ',format=yuv420p',
        ',vignette=PI/7',
        '[bg]'
      ].join('')
  const overlayFilter = options.overlay.kind === 'ass'
    ? `[bg]ass=filename=${options.overlay.path}[v]`
    : '[bg][1:v]overlay=format=auto[v]'
  const audioInputIndex = options.imageRelativePath
    ? options.overlay.kind === 'frames' ? 2 : 1
    : 0

  return [
    '-y',
    ...inputArgs,
    '-filter_complex', `${backgroundFilter};${overlayFilter}`,
    '-map', '[v]',
    '-map', `${audioInputIndex}:a`,
    '-r', String(options.fps),
    ...options.encoderSettings,
    '-pix_fmt', 'yuv420p',
    '-metadata:s:v:0', 'rotate=0',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    options.outputRelativePath
  ]
}
