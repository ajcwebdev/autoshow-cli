import { resolveCaptionWordCoverage } from '~/cli/commands/stt/workflows/captions/caption-word-coverage'
import { ValidationError } from '~/utils/error-handler'
import type { CaptionCue, CueBuildLimits, LyricsCueSource, TranscriptionEvidenceWord, TranscriptionResult, TranscriptionSegment } from '~/types'

export const LYRICS_CUE_LIMITS: CueBuildLimits = {
  maxWordsPerCue: 7,
  maxCharactersPerCue: 42,
  maxCueDurationSeconds: 4.5,
  hardBreakGapSeconds: 0.65
}

export const TRANSCRIPT_CUE_LIMITS: CueBuildLimits = {
  maxWordsPerCue: 10,
  maxCharactersPerCue: 58,
  maxCueDurationSeconds: 5,
  hardBreakGapSeconds: 0.9
}

const isPunctuationOnly = (text: string): boolean =>
  text.length > 0 && !/[\p{L}\p{N}]/u.test(text)

const normalizeCueText = (text: string): string =>
  text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()

const shouldInsertSpace = (currentText: string, nextToken: string): boolean => {
  if (currentText.length === 0 || nextToken.length === 0) {
    return false
  }

  const first = nextToken[0]!
  if (',.;:!?)]}'.includes(first) || /^(?:['’](?:s|re|ve|ll|d|m)?|n['’]t)$/i.test(nextToken)) {
    return false
  }

  const last = currentText[currentText.length - 1]
  if (last === undefined) {
    return false
  }
  if (last === '\'' || '([{'.includes(last)) {
    return false
  }

  return true
}

const appendCueToken = (currentText: string, token: string): string => {
  const trimmed = token.trim()
  if (trimmed.length === 0) {
    return currentText
  }

  return shouldInsertSpace(currentText, trimmed) ? `${currentText} ${trimmed}` : `${currentText}${trimmed}`
}

const flushWordCue = (
  cues: CaptionCue[],
  words: TranscriptionEvidenceWord[],
  text: string
): void => {
  const normalizedText = normalizeCueText(text)
  if (words.length === 0 || normalizedText.length === 0) {
    return
  }

  const start = words[0]!.startSeconds
  const end = Math.max(...words.map(word => word.endSeconds), start + 0.001)
  if (end <= start) {
    return
  }

  const speaker = words.find((word) => word.speaker !== undefined)?.speaker

  cues.push({
    index: cues.length,
    start,
    end,
    text: normalizedText,
    ...(speaker ? { speaker } : {})
  })
}

const countedWords = (entries: TranscriptionEvidenceWord[]): number =>
  entries.reduce((total, entry) => isPunctuationOnly(entry.text.trim()) ? total : total + 1, 0)

const countProjectedLines = (projectedText: string, limits: CueBuildLimits): number => {
  let projectedLines = 1
  let lineLength = 0
  for (const token of projectedText.split(/\s+/)) {
    const nextLength = lineLength === 0 ? token.length : lineLength + 1 + token.length
    if (lineLength > 0 && nextLength > (limits.maxCharactersPerLine ?? Infinity)) {
      projectedLines++
      lineLength = token.length
    } else lineLength = nextLength
  }
  return projectedLines
}

type PendingCue = { words: TranscriptionEvidenceWord[], text: string }

const shouldBreakBeforeWord = (
  pending: PendingCue,
  word: TranscriptionEvidenceWord,
  token: string,
  limits: CueBuildLimits
): boolean => {
  const projectedText = appendCueToken(pending.text, token)
  const projectedLines = countProjectedLines(projectedText, limits)
  const previousWord = pending.words[pending.words.length - 1]
  const gapFromPrevious = previousWord ? word.startSeconds - previousWord.endSeconds : 0
  const currentDuration = previousWord && pending.words[0]
    ? word.endSeconds - pending.words[0]!.startSeconds
    : 0
  const speakerChanged = previousWord !== undefined
    && word.speaker !== previousWord.speaker

  return pending.words.length > 0
    && !isPunctuationOnly(token)
    && (
      speakerChanged
      || gapFromPrevious >= limits.hardBreakGapSeconds
      || countedWords(pending.words) >= limits.maxWordsPerCue
      || projectedLines > (limits.maxLinesPerCue ?? Infinity)
      || projectedText.length > limits.maxCharactersPerCue
      || currentDuration >= limits.maxCueDurationSeconds
    )
}

const shouldBreakAfterWord = (
  pending: PendingCue,
  word: TranscriptionEvidenceWord,
  nextWord: TranscriptionEvidenceWord | undefined,
  limits: CueBuildLimits
): boolean => {
  const gapToNext = nextWord ? nextWord.startSeconds - word.endSeconds : Number.POSITIVE_INFINITY
  const cueDuration = word.endSeconds - pending.words[0]!.startSeconds

  return countedWords(pending.words) >= limits.maxWordsPerCue
    || pending.text.length >= limits.maxCharactersPerCue
    || cueDuration >= limits.maxCueDurationSeconds
    || gapToNext >= limits.hardBreakGapSeconds
    || (/[.!?]$/.test(pending.text) && countedWords(pending.words) >= 3)
    || (/[,:;]$/.test(pending.text) && countedWords(pending.words) >= 2 && gapToNext >= 0.25)
}

const buildFromWords = (
  words: TranscriptionEvidenceWord[],
  limits: CueBuildLimits
): CaptionCue[] => {
  const cues: CaptionCue[] = []
  const pending: PendingCue = { words: [], text: '' }

  const flushCurrentCue = (): void => {
    flushWordCue(cues, pending.words, pending.text)
    pending.words = []
    pending.text = ''
  }

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]!
    const token = word.text.trim()
    if (token.length === 0) {
      continue
    }

    if (shouldBreakBeforeWord(pending, word, token, limits)) {
      flushCurrentCue()
    }

    pending.words.push(word)
    pending.text = appendCueToken(pending.text, token)

    if (shouldBreakAfterWord(pending, word, words[index + 1], limits)) {
      flushCurrentCue()
    }
  }

  flushCurrentCue()
  return cues
}

const parseWhisperfileSegmentTimestamp = (timestamp: string): number => {
  const match = timestamp.match(/^(\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,3}))?$/)
  if (!match) {
    return Number.NaN
  }

  const milliseconds = match[4] ? Number(match[4].padEnd(3, '0')) : 0
  return (Number(match[1]) * 3600) + (Number(match[2]) * 60) + Number(match[3]) + (milliseconds / 1000)
}

const buildFromSegments = (segments: TranscriptionSegment[]): CaptionCue[] => {
  const cues: CaptionCue[] = []

  for (const segment of segments) {
    const start = parseWhisperfileSegmentTimestamp(segment.start)
    const end = parseWhisperfileSegmentTimestamp(segment.end)
    const text = normalizeCueText(segment.text)

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || text.length === 0) {
      continue
    }

    cues.push({
      index: cues.length,
      start,
      end,
      text,
      ...(segment.speaker ? { speaker: segment.speaker } : {})
    })
  }

  return cues
}

export const buildTranscriptionCues = (
  transcription: TranscriptionResult,
  limits: CueBuildLimits
): { cues: CaptionCue[], source: LyricsCueSource } => {
  const coverage = resolveCaptionWordCoverage(transcription)
  if (coverage.uncoveredText && (transcription.evidence?.words?.length ?? 0) > 0) {
    throw ValidationError('Transcript text has no matching timed words or segments. Repair the saved result before exporting captions.', { stage: 'captions:coverage' })
  }
  const words = (transcription.evidence?.words?.length ?? 0) > 0 ? coverage.words : []
  const wordCues = buildFromWords(words, limits)
  if (wordCues.length > 0) {
    return { cues: wordCues, source: 'transcript-words' }
  }

  return {
    cues: buildFromSegments(transcription.segments),
    source: 'transcript-segments'
  }
}
