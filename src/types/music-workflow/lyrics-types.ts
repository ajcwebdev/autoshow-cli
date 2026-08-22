import type { TimedTextRangeBase } from '~/types'

export type CaptionCue = TimedTextRangeBase<number> & {
  index: number
  speaker?: string | undefined
}

export type LyricsCueSource = 'caption-file' | 'whisper-words' | 'whisper-segments'

export type CueBuildLimits = {
  maxWordsPerCue: number
  maxCharactersPerCue: number
  maxCueDurationSeconds: number
  hardBreakGapSeconds: number
}

export type OverlaySegment = {
  start: number
  end: number
  previousText?: string | undefined
  currentText?: string | undefined
  nextText?: string | undefined
  currentSpeaker?: string | undefined
}

export type OverlayTextLayout = {
  activeFontScale: number
  contextFontScale: number
  wrapWidthRatio: number
  lineSpacingRatio?: number | undefined
}
