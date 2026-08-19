import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { AssStyle, AssTheme, CaptionCue, LyricsRenderSummary, LyricsVideoOverlaySource, OverlaySegment, OverlayTextLayout } from '~/types'
import { commandExists, exec } from '~/utils/cli-utils'
import { getFfmpegBinary } from '~/utils/runtime-paths'
import { InfraError } from '~/utils/error-handler'

export const FIXED_RENDER_WIDTH = 1920
export const FIXED_RENDER_HEIGHT = 1080
export const FIXED_RENDER_FPS = 30

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'] as const

let encoderPromise: Promise<string> | undefined
let ffmpegFiltersPromise: Promise<string> | undefined

const escapeAssText = (text: string): string =>
  text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\r?\n/g, '\\N')

/** ASS colours are &HBBGGRR&, the reverse byte order of a #RRGGBB hex string. */
const toAssColor = (hexColor: string): string => {
  const match = hexColor.trim().match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!match) {
    return '&H00FFFFFF&'
  }

  return `&H00${match[3]!.toUpperCase()}${match[2]!.toUpperCase()}${match[1]!.toUpperCase()}&`
}

export const extractTitle = (audioPath: string): string => {
  const baseName = audioPath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? audioPath
  const match = baseName.match(/^(\d+)[-\s.]+(.+)$/)
  return match ? `${match[1]} - ${match[2]}` : baseName
}

const assTime = (seconds: number): string => {
  const clamped = Math.max(0, seconds)
  const totalCentiseconds = Math.round(clamped * 100)
  const centiseconds = totalCentiseconds % 100
  const totalSeconds = Math.floor(totalCentiseconds / 100)
  const secs = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}

export const LYRICS_ASS_THEME: AssTheme = {
  horizontalMarginRatio: 0.1,
  verticalMarginRatio: 0.1,
  styles: (height) => {
    const activeSize = Math.round(height * 0.045)
    const contextSize = Math.round(activeSize * 0.85)
    const titleSize = Math.round(activeSize * 0.9)
    return [
      { name: 'Active', fontSize: activeSize, primaryColor: '&H00FFFFFF', bold: true, outline: Math.max(3, Math.round(activeSize * 0.08)), shadow: Math.max(2, Math.round(activeSize * 0.04)), alignment: 5 },
      { name: 'Context', fontSize: contextSize, primaryColor: '&H00C0C0C0', bold: false, outline: Math.max(2, Math.round(contextSize * 0.08)), shadow: Math.max(1, Math.round(contextSize * 0.04)), alignment: 5 },
      { name: 'Title', fontSize: titleSize, primaryColor: '&H00FFFFFF', bold: true, outline: Math.max(2, Math.round(titleSize * 0.08)), shadow: Math.max(1, Math.round(titleSize * 0.04)), alignment: 8 }
    ]
  },
  title: { style: 'Title', layer: 3, yRatio: 0.08 },
  cue: {
    activeStyle: 'Active',
    contextStyle: 'Context',
    activeLayer: 0,
    previousLayer: 1,
    nextLayer: 2,
    centerYRatio: 0.5,
    lineSpacingRatio: 0.08
  }
}

export const TRANSCRIPT_ASS_THEME: AssTheme = {
  horizontalMarginRatio: 0.085,
  verticalMarginRatio: 0.09,
  styles: (height) => {
    const activeSize = Math.round(height * TRANSCRIPT_OVERLAY_TEXT_LAYOUT.activeFontScale)
    const contextSize = Math.round(height * TRANSCRIPT_OVERLAY_TEXT_LAYOUT.contextFontScale)
    const speakerSize = Math.round(activeSize * 0.66)
    const titleSize = Math.round(activeSize * 0.72)
    const labelOutline = Math.max(2, Math.round(speakerSize * 0.08))
    return [
      { name: 'TranscriptActive', fontSize: activeSize, primaryColor: '&H00FFFFFF', bold: true, outline: Math.max(3, Math.round(activeSize * 0.08)), shadow: 2, alignment: 5 },
      // Kept for byte compatibility even though speaker identity is currently carried by line colour.
      { name: 'TranscriptSpeaker', fontSize: speakerSize, primaryColor: '&H004FE7FF', bold: true, outline: labelOutline, shadow: 1, alignment: 5 },
      { name: 'TranscriptContext', fontSize: contextSize, primaryColor: '&H00C0C0C0', bold: false, outline: Math.max(2, Math.round(contextSize * 0.08)), shadow: 1, alignment: 5 },
      { name: 'TranscriptTitle', fontSize: titleSize, primaryColor: '&H00FFFFFF', bold: true, outline: labelOutline, shadow: 1, alignment: 8 }
    ]
  },
  title: { style: 'TranscriptTitle', layer: 4, yRatio: 0.07 },
  cue: {
    activeStyle: 'TranscriptActive',
    contextStyle: 'TranscriptContext',
    activeLayer: 2,
    previousLayer: 1,
    nextLayer: 1,
    centerYRatio: 0.52,
    lineSpacingRatio: 0.06,
    colorActiveBySpeaker: true
  }
}

const buildAssStyle = (
  style: AssStyle,
  font: string,
  horizontalMargin: number,
  verticalMargin: number
): string =>
  `Style: ${style.name},${font},${style.fontSize},${style.primaryColor},${style.primaryColor},&H00000000,&HA0000000,${style.bold ? 1 : 0},0,0,0,100,100,0,0,1,${style.outline},${style.shadow},${style.alignment},${horizontalMargin},${horizontalMargin},${verticalMargin},1`

const buildCueDialogue = (options: {
  layer: number
  start: number
  end: number
  style: string
  x: number
  y: number
  text: string
  extraTags?: string | undefined
}): string =>
  `Dialogue: ${options.layer},${assTime(options.start)},${assTime(options.end)},${options.style},,0,0,0,,{\\pos(${options.x},${options.y})\\an5\\blur0.6\\q2${options.extraTags ?? ''}}${escapeAssText(options.text)}`

export const buildCueAss = (
  options: { width: number, height: number, font: string, title: string },
  cues: ReadonlyArray<CaptionCue>,
  theme: AssTheme
): string => {
  const { width, height, font, title } = options
  const horizontalMargin = Math.round(width * theme.horizontalMarginRatio)
  const verticalMargin = Math.round(height * theme.verticalMarginRatio)
  const styles = theme.styles(height).map((style) => buildAssStyle(style, font, horizontalMargin, verticalMargin))
  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    ...styles,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ].join('\n')

  const events: string[] = []
  if (cues.length > 0) {
    events.push(buildCueDialogue({
      layer: theme.title.layer,
      start: 0,
      end: cues[cues.length - 1]!.end + 2,
      style: theme.title.style,
      x: width / 2,
      y: Math.round(height * theme.title.yRatio),
      text: title
    }))
  }

  const lineSpacing = Math.round(height * theme.cue.lineSpacingRatio)
  const centerY = Math.round(height * theme.cue.centerYRatio)
  const speakerColors = theme.cue.colorActiveBySpeaker === true
    ? buildSpeakerColorMap(cues)
    : undefined

  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index]!
    if (cue.end <= cue.start) continue
    const pushDialogue = (
      layer: number,
      style: string,
      y: number,
      text: string,
      extraTags?: string
    ): void => {
      events.push(buildCueDialogue({
        layer,
        start: cue.start,
        end: cue.end,
        style,
        x: width / 2,
        y,
        text,
        ...(extraTags ? { extraTags } : {})
      }))
    }

    const previousCue = cues[index - 1]
    if (previousCue) {
      pushDialogue(theme.cue.previousLayer, theme.cue.contextStyle, centerY - lineSpacing, previousCue.text)
    }

    const speakerTint = cue.speaker && speakerColors
      ? `\\c${toAssColor(speakerColors.get(cue.speaker) ?? '#FFFFFF')}`
      : undefined
    pushDialogue(theme.cue.activeLayer, theme.cue.activeStyle, centerY, cue.text, speakerTint)

    const nextCue = cues[index + 1]
    if (nextCue) {
      pushDialogue(theme.cue.nextLayer, theme.cue.contextStyle, centerY + lineSpacing, nextCue.text)
    }
  }

  return `${header}\n${events.join('\n')}\n`
}

export const buildAss = (
  options: { width: number, height: number, font: string, title: string },
  cues: CaptionCue[]
): string => buildCueAss(options, cues, LYRICS_ASS_THEME)

export const buildTranscriptAss = (
  options: { width: number, height: number, font: string, title: string },
  cues: Array<CaptionCue & { speaker?: string | undefined }>
): string => buildCueAss(options, cues, TRANSCRIPT_ASS_THEME)

const checkFfmpegEncoder = async (encoder: string): Promise<boolean> => {
  const result = await exec(getFfmpegBinary(), ['-hide_banner', '-encoders'])
  return result.exitCode === 0 && result.stdout.includes(encoder)
}

const readFfmpegFilters = async (): Promise<string> => {
  if (!ffmpegFiltersPromise) {
    ffmpegFiltersPromise = exec(getFfmpegBinary(), ['-hide_banner', '-filters']).then((result) => result.stdout)
  }

  return await ffmpegFiltersPromise
}

const hasFfmpegFilter = async (filterName: string): Promise<boolean> => {
  const filters = await readFfmpegFilters()
  return filters.split('\n').some((line) => line.trim().split(/\s+/).includes(filterName))
}

const detectLyricsEncoder = async (): Promise<string> => {
  if (!encoderPromise) {
    encoderPromise = (async () => {
      if (process.platform === 'darwin' && await checkFfmpegEncoder('h264_videotoolbox')) {
        return 'h264_videotoolbox'
      }
      if (await checkFfmpegEncoder('h264_nvenc')) {
        return 'h264_nvenc'
      }
      if (await checkFfmpegEncoder('h264_amf')) {
        return 'h264_amf'
      }
      return 'libx264'
    })()
  }

  return await encoderPromise
}

const getEncoderSettings = (encoder: string): string[] => {
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

/** Lyric lines are short and may wrap; spacing is measured from what actually rendered. */
export const DEFAULT_OVERLAY_TEXT_LAYOUT: OverlayTextLayout = {
  activeFontScale: 0.045,
  contextFontScale: 0.038,
  wrapWidthRatio: 0.6
}

/**
 * Transcript lines are sized down and given a wide wrap width so a full cue always fits on one line.
 * That keeps every line one row tall, which is what lets the fixed line spacing hold every frame.
 */
export const TRANSCRIPT_OVERLAY_TEXT_LAYOUT: OverlayTextLayout = {
  activeFontScale: 0.030,
  contextFontScale: 0.026,
  wrapWidthRatio: 0.94,
  lineSpacingRatio: 0.06
}

// Speaker colours, assigned by order of first appearance so a given speaker keeps one colour for the
// whole video. Chosen to stay legible on the dark spectrogram/image backgrounds.
const SPEAKER_COLORS = ['#4FE7FF', '#FFC24F', '#8BE77F', '#FF8FB1', '#C79BFF', '#7FD4FF'] as const

export const buildSpeakerColorMap = (cues: ReadonlyArray<CaptionCue>): Map<string, string> => {
  const colors = new Map<string, string>()
  for (const cue of cues) {
    if (cue.speaker !== undefined && !colors.has(cue.speaker)) {
      colors.set(cue.speaker, SPEAKER_COLORS[colors.size % SPEAKER_COLORS.length]!)
    }
  }
  return colors
}

/**
 * Turn a stored diarization label into something readable on screen. Providers disagree on shape:
 * Soniox stores "1", most store "speaker-0", AssemblyAI "speaker-A", Reverb "SPEAKER_00", and Happy
 * Scribe can store a real name. Only short ids get the "Speaker" prefix; names pass through untouched.
 */
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

const buildOverlaySegments = (cues: CaptionCue[], options?: { includeContext?: boolean | undefined }): OverlaySegment[] => {
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

const resolveConvertCommand = (): string | undefined => {
  if (commandExists('convert')) {
    return 'convert'
  }
  return undefined
}

const escapePangoMarkup = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const renderPangoLayer = async (
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

const readImageHeight = async (convert: string, imagePath: string | undefined): Promise<number> => {
  if (!imagePath) {
    return 0
  }

  const result = await exec(convert, [imagePath, '-format', '%h', 'info:'])
  const height = Number.parseInt(result.stdout.trim(), 10)
  return Number.isFinite(height) && height > 0 ? height : 0
}

const renderOverlayCard = async (options: {
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
      // Speaker identity is carried by colour alone; no label is drawn.
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

  // With a fixed line spacing the three lines sit at the same y on every frame, so nothing shifts as
  // the text changes. That is only safe when lines cannot wrap, so callers that allow wrapping omit
  // it and get offsets measured from each layer's real height instead.
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

const buildOverlaySequence = async (options: {
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
