import type { AssStyle, AssTheme, CaptionCue } from '~/types'
import { buildSpeakerColorMap, TRANSCRIPT_OVERLAY_TEXT_LAYOUT } from './lyrics-overlay-renderer'

export const escapeAssText = (text: string): string =>
  text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\r?\n/g, '\\N')

export const toAssColor = (hexColor: string): string => {
  const match = hexColor.trim().match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!match) {
    return '&H00FFFFFF&'
  }

  return `&H00${match[3]!.toUpperCase()}${match[2]!.toUpperCase()}${match[1]!.toUpperCase()}&`
}

export const assTime = (seconds: number): string => {
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

export const buildAssStyle = (
  style: AssStyle,
  font: string,
  horizontalMargin: number,
  verticalMargin: number
): string =>
  `Style: ${style.name},${font},${style.fontSize},${style.primaryColor},${style.primaryColor},&H00000000,&HA0000000,${style.bold ? 1 : 0},0,0,0,100,100,0,0,1,${style.outline},${style.shadow},${style.alignment},${horizontalMargin},${horizontalMargin},${verticalMargin},1`

export const buildCueDialogue = (options: {
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
