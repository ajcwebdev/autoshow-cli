import type { TimedTextRangeBase } from '~/types'

export type CaptionCue = TimedTextRangeBase<number> & {
  index: number
  /** Diarized speaker label for this cue. Lyric cues leave it unset. */
  speaker?: string | undefined
}

export type LyricsCueSource = 'caption-file' | 'whisper-words' | 'whisper-segments'

/** Cue sizing thresholds; sung lyric lines and spoken transcript lines want different limits. */
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
  /** Speaker of the active line, used to colour it. Context lines stay neutral. */
  currentSpeaker?: string | undefined
}

/** Text sizing and placement for the rendered overlay, as fractions of the frame. */
export type OverlayTextLayout = {
  activeFontScale: number
  contextFontScale: number
  wrapWidthRatio: number
  /**
   * Fixed distance from the active line to each context line. Set it only when lines are short
   * enough that they cannot wrap — it pins all three lines so nothing moves between frames. Leave it
   * undefined to space lines by their measured heights instead.
   */
  lineSpacingRatio?: number | undefined
}
