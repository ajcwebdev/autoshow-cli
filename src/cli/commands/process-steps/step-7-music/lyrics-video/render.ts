import { mkdir, readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { CaptionCue, LyricsRenderSummary, LyricsVideoOverlaySource, OverlayTextLayout } from '~/types'
import { getFfmpegBinary } from '~/utils/runtime-paths'
import { InfraError } from '~/utils/error-handler'
import { childEnv } from '~/utils/child-env'
import { buildLyricsVideoFfmpegArgs, detectLyricsEncoder, getEncoderSettings, hasFfmpegFilter } from './lyrics-ffmpeg-plan'
import { buildOverlaySequence } from './lyrics-overlay-renderer'

export const FIXED_RENDER_WIDTH = 1920
export const FIXED_RENDER_HEIGHT = 1080
export const FIXED_RENDER_FPS = 30

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'] as const

export const extractTitle = (audioPath: string): string => {
  const baseName = audioPath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? audioPath
  const match = baseName.match(/^(\d+)[-\s.]+(.+)$/)
  return match ? `${match[1]} - ${match[2]}` : baseName
}

export const findMatchingImage = async (audioPath: string, directory: string): Promise<string | undefined> => {
  const baseName = audioPath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? ''
  for (const extension of IMAGE_EXTENSIONS) {
    const candidate = join(directory, `${baseName}${extension}`)
    if (await Bun.file(candidate).exists()) {
      return candidate
    }
  }

  const trackMatch = baseName.match(/^(\d+)[\s\-_.]/)
  if (!trackMatch) {
    return undefined
  }

  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue
    }

    const extension = extname(entry.name).toLowerCase()
    if (!IMAGE_EXTENSIONS.includes(extension as typeof IMAGE_EXTENSIONS[number])) {
      continue
    }

    const entryMatch = entry.name.match(/^(\d+)[\s\-_.]/)
    if (entryMatch?.[1] === trackMatch[1]) {
      return join(directory, entry.name)
    }
  }

  return undefined
}

export { buildAss, buildTranscriptAss } from './lyrics-ass-builder'
export { buildImageBackgroundFilter, buildLyricsVideoFfmpegArgs } from './lyrics-ffmpeg-plan'
export { TRANSCRIPT_OVERLAY_TEXT_LAYOUT, formatSpeakerDisplayLabel } from './lyrics-overlay-renderer'

export const renderLyricsVideo = async (options: {
  audioPath: string
  assRelativePath: string
  outputRelativePath: string
  width: number
  height: number
  fps: number
  workingDirectory: string
  cues: CaptionCue[]
  title: string
  font: string
  includeContext?: boolean | undefined
  imageRelativePath?: string | undefined
  textLayout?: OverlayTextLayout | undefined
}): Promise<LyricsRenderSummary> => {
  const encoder = await detectLyricsEncoder()
  const encoderSettings = getEncoderSettings(encoder)
  const {
    audioPath,
    assRelativePath,
    outputRelativePath,
    width,
    height,
    fps,
    workingDirectory,
    cues,
    title,
    font,
    includeContext,
    imageRelativePath,
    textLayout
  } = options

  const useAssFilter = await hasFfmpegFilter('ass')
  const useEqFilter = imageRelativePath ? await hasFfmpegFilter('eq') : false
  let overlay: LyricsVideoOverlaySource
  if (useAssFilter) {
    overlay = { kind: 'ass', path: assRelativePath }
  } else {
    const overlayDir = join(workingDirectory, 'overlay')
    await mkdir(overlayDir, { recursive: true })
    const overlayConcatPath = await buildOverlaySequence({
      overlayDir,
      width,
      height,
      font,
      title,
      cues,
      includeContext,
      ...(textLayout ? { layout: textLayout } : {})
    })
    overlay = { kind: 'frames', path: overlayConcatPath }
  }

  const finalArgs = buildLyricsVideoFfmpegArgs({
    audioPath,
    outputRelativePath,
    width,
    height,
    fps,
    encoderSettings,
    includeEq: useEqFilter,
    overlay,
    ...(imageRelativePath ? { imageRelativePath } : {})
  })

  const proc = Bun.spawn([getFfmpegBinary(), ...finalArgs], {
    cwd: workingDirectory,
    env: childEnv(),
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ])
  if (exitCode !== 0) {
    throw InfraError(`ffmpeg failed while rendering lyrics video: ${stderr.trim() || stdout.trim()}`, { stage: 'music:lyrics-video' })
  }

  return {
    encoder,
    backgroundMode: imageRelativePath ? 'image' : 'spectrogram'
  }
}
