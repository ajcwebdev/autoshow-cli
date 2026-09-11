import type { WhisperfileProgressLogContext } from '~/types'

const WHISPERFILE_PROGRESS_PATTERN = /whisper_print_progress_callback:\s+progress =\s*(\d+)%/

const clampPercent = (value: number): number => {
  return Math.max(0, Math.min(100, value))
}

const renderWhisperfileProgressBar = (percent: number, width: number = 24): string => {
  const clamped = clampPercent(percent)
  const filled = Math.round((clamped / 100) * width)
  if (filled >= width) {
    return `[${'='.repeat(width)}]`
  }
  if (filled <= 0) {
    return `[>${' '.repeat(width - 1)}]`
  }
  return `[${'='.repeat(filled - 1)}>${' '.repeat(width - filled)}]`
}

export const parseWhisperfileProgressPercent = (line: string): number | null => {
  const match = line.trim().match(WHISPERFILE_PROGRESS_PATTERN)
  if (!match || !match[1]) {
    return null
  }

  const parsed = Number.parseInt(match[1], 10)
  if (!Number.isFinite(parsed)) {
    return null
  }

  return clampPercent(parsed)
}

const computeWhisperfileOverallPercent = (
  segmentPercent: number,
  context: WhisperfileProgressLogContext
): number | null => {
  if (!context.totalSegments || context.totalSegments <= 1) {
    return null
  }

  if (
    typeof context.segmentStartSeconds !== 'number' ||
    typeof context.segmentDurationSeconds !== 'number' ||
    typeof context.totalDurationSeconds !== 'number' ||
    context.segmentDurationSeconds <= 0 ||
    context.totalDurationSeconds <= 0
  ) {
    return null
  }

  const completedSeconds = context.segmentStartSeconds + (context.segmentDurationSeconds * (clampPercent(segmentPercent) / 100))
  return clampPercent((completedSeconds / context.totalDurationSeconds) * 100)
}

export const formatWhisperfileProgressMessage = (
  segmentPercent: number,
  context: WhisperfileProgressLogContext = {}
): string => {
  const safeSegmentPercent = clampPercent(segmentPercent)
  const overallPercent = computeWhisperfileOverallPercent(safeSegmentPercent, context)
  if (overallPercent !== null && context.segmentNumber && context.totalSegments) {
    const roundedOverallPercent = Math.round(overallPercent)
    return `Whisperfile progress ${renderWhisperfileProgressBar(roundedOverallPercent)} ${roundedOverallPercent}% overall (segment ${context.segmentNumber}/${context.totalSegments}: ${safeSegmentPercent}%)`
  }

  if (context.segmentNumber && context.totalSegments && context.totalSegments > 1) {
    return `Whisperfile progress ${renderWhisperfileProgressBar(safeSegmentPercent)} ${safeSegmentPercent}% (segment ${context.segmentNumber}/${context.totalSegments})`
  }

  return `Whisperfile progress ${renderWhisperfileProgressBar(safeSegmentPercent)} ${safeSegmentPercent}%`
}
