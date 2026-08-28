import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CaptionCue, OverlaySegment, OverlayTextLayout } from '~/types'
import { commandExists, exec } from '~/utils/cli-utils'
import { InfraError } from '~/utils/error-handler'

export const DEFAULT_OVERLAY_TEXT_LAYOUT: OverlayTextLayout = {
  activeFontScale: 0.045,
  contextFontScale: 0.038,
  wrapWidthRatio: 0.6
}

export const TRANSCRIPT_OVERLAY_TEXT_LAYOUT: OverlayTextLayout = {
  activeFontScale: 0.030,
  contextFontScale: 0.026,
  wrapWidthRatio: 0.94,
  lineSpacingRatio: 0.06
}

export const SPEAKER_COLORS = ['#4FE7FF', '#FFC24F', '#8BE77F', '#FF8FB1', '#C79BFF', '#7FD4FF'] as const

export const buildSpeakerColorMap = (cues: ReadonlyArray<CaptionCue>): Map<string, string> => {
  const colors = new Map<string, string>()
  for (const cue of cues) {
    if (cue.speaker !== undefined && !colors.has(cue.speaker)) {
      colors.set(cue.speaker, SPEAKER_COLORS[colors.size % SPEAKER_COLORS.length]!)
    }
  }
  return colors
}

export const formatSpeakerDisplayLabel = (speaker: string): string => {
  const trimmed = speaker.trim()
  if (trimmed.length === 0) {
    return trimmed
  }

  const withoutPrefix = trimmed.replace(/^speakers?[\s_-]*/i, '')
  if (/^\d+$/.test(withoutPrefix)) {
    return `Speaker ${String(Number(withoutPrefix))}`
  }
  if (/^[A-Za-z]{1,2}$/.test(withoutPrefix)) {
    return `Speaker ${withoutPrefix.toUpperCase()}`
  }

  return trimmed
}

export const buildOverlaySegments = (cues: CaptionCue[], options?: { includeContext?: boolean | undefined }): OverlaySegment[] => {
  if (cues.length === 0) {
    return []
  }
  const includeContext = options?.includeContext !== false

  const segments: OverlaySegment[] = []
  const firstCue = cues[0]!
  if (firstCue.start > 0.05) {
    segments.push({
      start: 0,
      end: firstCue.start
    })
  }

  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index]!
    segments.push({
      start: cue.start,
      end: cue.end,
      ...(includeContext && index > 0 ? { previousText: cues[index - 1]!.text } : {}),
      currentText: cue.text,
      ...(cue.speaker ? { currentSpeaker: cue.speaker } : {}),
      ...(includeContext && index + 1 < cues.length ? { nextText: cues[index + 1]!.text } : {})
    })
  }

  const lastCue = cues[cues.length - 1]!
  segments.push({
    start: lastCue.end,
    end: lastCue.end + 2,
    ...(includeContext ? { previousText: lastCue.text } : {})
  })

  return segments.filter((segment) => segment.end > segment.start + 0.01)
}

export const resolveConvertCommand = (): string | undefined => {
  if (commandExists('convert')) {
    return 'convert'
  }
  return undefined
}

export const escapePangoMarkup = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

export const renderPangoLayer = async (
  options: {
    text?: string | undefined
    font: string
    fill: string
    pointSize: number
    width: number
    outputPath: string
    bold?: boolean | undefined
    wrapWidthRatio?: number | undefined
  }
): Promise<string | undefined> => {
  const text = options.text?.trim()
  if (!text) {
    return undefined
  }

  if (!commandExists('pango-view')) {
    throw InfraError('Lyrics rendering fallback requires pango-view when ffmpeg lacks the ass filter', { stage: 'music:lyrics-video' })
  }

  const weight = options.bold ? ' weight="bold"' : ''
  const markup = `<span foreground="${options.fill}"${weight}>${escapePangoMarkup(text)}</span>`
  const result = await exec('pango-view', [
    '--no-display',
    '--markup',
    '--text', markup,
    '--background', 'transparent',
    '--margin', '0',
    '--align', 'center',
    '--width', String(Math.round(options.width * (options.wrapWidthRatio ?? 0.6))),
    '--wrap', 'word-char',
    '--font', `${options.font} ${options.pointSize}`,
    '--output', options.outputPath
  ])
  if (result.exitCode !== 0) {
    throw InfraError(`pango-view failed while rendering lyric text: ${result.stderr.trim() || result.stdout.trim()}`, { stage: 'music:lyrics-video' })
  }

  return options.outputPath
}

export const readImageHeight = async (convert: string, imagePath: string | undefined): Promise<number> => {
  if (!imagePath) {
    return 0
  }

  const result = await exec(convert, [imagePath, '-format', '%h', 'info:'])
  const height = Number.parseInt(result.stdout.trim(), 10)
  return Number.isFinite(height) && height > 0 ? height : 0
}

export const renderOverlayCard = async (options: {
  outputPath: string
  width: number
  height: number
  font: string
  title: string
  previousText?: string | undefined
  currentText?: string | undefined
  nextText?: string | undefined
  speakerColor?: string | undefined
  layout?: OverlayTextLayout | undefined
}): Promise<void> => {
  const convert = resolveConvertCommand()
  if (!convert) {
    throw InfraError('Lyrics rendering requires either ffmpeg with the ass filter or ImageMagick convert for fallback text overlays', { stage: 'music:lyrics-video' })
  }

  const layout = options.layout ?? DEFAULT_OVERLAY_TEXT_LAYOUT
  const wrapWidthRatio = layout.wrapWidthRatio

  const layerPaths = [
    await renderPangoLayer({
      text: options.title,
      font: options.font,
      fill: '#FFFFFF',
      pointSize: Math.round(options.height * 0.04),
      width: options.width,
      outputPath: `${options.outputPath}.title.png`,
      bold: true
    }),
    await renderPangoLayer({
      text: options.previousText,
      font: options.font,
      fill: '#C0C0C0',
      pointSize: Math.round(options.height * layout.contextFontScale),
      width: options.width,
      outputPath: `${options.outputPath}.prev.png`,
      wrapWidthRatio
    }),
    await renderPangoLayer({
      text: options.currentText,
      font: options.font,
      fill: options.speakerColor ?? '#FFFFFF',
      pointSize: Math.round(options.height * layout.activeFontScale),
      width: options.width,
      outputPath: `${options.outputPath}.current.png`,
      bold: true,
      wrapWidthRatio
    }),
    await renderPangoLayer({
      text: options.nextText,
      font: options.font,
      fill: '#C0C0C0',
      pointSize: Math.round(options.height * layout.contextFontScale),
      width: options.width,
      outputPath: `${options.outputPath}.next.png`,
      wrapWidthRatio
    })
  ] as const

  const [previousHeight, currentHeight, nextHeight] = layout.lineSpacingRatio === undefined
    ? await Promise.all([
        readImageHeight(convert, layerPaths[1]),
        readImageHeight(convert, layerPaths[2]),
        readImageHeight(convert, layerPaths[3])
      ])
    : [0, 0, 0]
  const previousOffset = layout.lineSpacingRatio === undefined
    ? -Math.round((currentHeight / 2) + Math.round(options.height * 0.035) + (previousHeight / 2))
    : -Math.round(options.height * layout.lineSpacingRatio)
  const nextOffset = layout.lineSpacingRatio === undefined
    ? Math.round((currentHeight / 2) + Math.round(options.height * 0.035) + (nextHeight / 2))
    : Math.round(options.height * layout.lineSpacingRatio)

  const args = ['-size', `${options.width}x${options.height}`, 'xc:none']
  const composites: Array<{ path: string | undefined, gravity: 'north' | 'center', yOffset: number }> = [
    { path: layerPaths[0], gravity: 'north', yOffset: Math.round(options.height * 0.08) },
    { path: layerPaths[1], gravity: 'center', yOffset: previousOffset },
    { path: layerPaths[2], gravity: 'center', yOffset: 0 },
    { path: layerPaths[3], gravity: 'center', yOffset: nextOffset }
  ]

  for (const composite of composites) {
    if (!composite.path) {
      continue
    }

    args.push(
      composite.path,
      '-gravity', composite.gravity,
      '-geometry', `+0${composite.yOffset >= 0 ? '+' : ''}${composite.yOffset}`,
      '-composite'
    )
  }
  args.push(`png32:${options.outputPath}`)

  const result = await exec(convert, args)
  if (result.exitCode !== 0) {
    throw InfraError(`ImageMagick failed while rendering lyric overlay: ${result.stderr.trim() || result.stdout.trim()}`, { stage: 'music:lyrics-video' })
  }
}

export const buildOverlaySequence = async (options: {
  overlayDir: string
  width: number
  height: number
  font: string
  title: string
  cues: CaptionCue[]
  includeContext?: boolean | undefined
  layout?: OverlayTextLayout | undefined
}): Promise<string> => {
  const segments = buildOverlaySegments(options.cues, { includeContext: options.includeContext })
  const speakerColors = buildSpeakerColorMap(options.cues)
  const listLines: string[] = []
  let lastFramePath = ''

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!
    const framePath = join(options.overlayDir, `frame-${String(index).padStart(4, '0')}.png`)
    const speakerColor = segment.currentSpeaker ? speakerColors.get(segment.currentSpeaker) : undefined
    await renderOverlayCard({
      outputPath: framePath,
      width: options.width,
      height: options.height,
      font: options.font,
      title: options.title,
      ...(segment.previousText ? { previousText: segment.previousText } : {}),
      ...(segment.currentText ? { currentText: segment.currentText } : {}),
      ...(segment.nextText ? { nextText: segment.nextText } : {}),
      ...(speakerColor ? { speakerColor } : {}),
      ...(options.layout ? { layout: options.layout } : {})
    })
    listLines.push(`file '${framePath}'`)
    listLines.push(`duration ${(segment.end - segment.start).toFixed(3)}`)
    lastFramePath = framePath
  }

  if (lastFramePath.length > 0) {
    listLines.push(`file '${lastFramePath}'`)
  }

  const concatPath = join(options.overlayDir, 'frames.txt')
  await writeFile(concatPath, `${listLines.join('\n')}\n`)
  return concatPath
}
