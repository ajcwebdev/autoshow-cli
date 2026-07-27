import type { CaptionCue, CueBuildLimits, LyricsCueSource, TranscriptionEvidenceWord, TranscriptionResult, TranscriptionSegment } from '~/types'

/** Lyric lines are short and sung; transcript lines are spoken prose and run longer. */
export const LYRICS_CUE_LIMITS: CueBuildLimits = {
  maxWordsPerCue: 7,
  maxCharactersPerCue: 42,
  maxCueDurationSeconds: 4.5,
  hardBreakGapSeconds: 0.65
}

/**
 * Capped so a cue always fits on one rendered line at the transcript font size, which is what keeps
 * the three-line stack from shifting between frames.
 */
export const TRANSCRIPT_CUE_LIMITS: CueBuildLimits = {
  maxWordsPerCue: 10,
  maxCharactersPerCue: 58,
  maxCueDurationSeconds: 5,
  hardBreakGapSeconds: 0.9
}

/** Punctuation-only entries (Speechmatics emits these as their own timed words) attach to the previous
 * word rather than counting against the per-cue word budget or starting a cue. */
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
  if (',.;:!?)]}'.includes(first) || first === '\'') {
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
  const end = Math.max(words[words.length - 1]!.endSeconds, start + 0.1)
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

const buildFromWords = (
  words: TranscriptionEvidenceWord[],
  limits: CueBuildLimits
): CaptionCue[] => {
  const cues: CaptionCue[] = []
  let currentWords: TranscriptionEvidenceWord[] = []
  let currentText = ''

  const flushCurrentCue = (): void => {
    flushWordCue(cues, currentWords, currentText)
    currentWords = []
    currentText = ''
  }

  // Punctuation-only entries never open a cue or count toward its word budget.
  const countedWords = (entries: TranscriptionEvidenceWord[]): number =>
    entries.reduce((total, entry) => isPunctuationOnly(entry.text.trim()) ? total : total + 1, 0)

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]!
    const token = word.text.trim()
    if (token.length === 0) {
      continue
    }

    const projectedText = appendCueToken(currentText, token)
    const previousWord = currentWords[currentWords.length - 1]
    const gapFromPrevious = previousWord ? word.startSeconds - previousWord.endSeconds : 0
    const currentDuration = previousWord && currentWords[0]
      ? previousWord.endSeconds - currentWords[0]!.startSeconds
      : 0
    const speakerChanged = previousWord !== undefined
      && word.speaker !== undefined
      && previousWord.speaker !== undefined
      && word.speaker !== previousWord.speaker

    if (
      currentWords.length > 0
      && !isPunctuationOnly(token)
      && (
        speakerChanged
        || gapFromPrevious >= limits.hardBreakGapSeconds
        || countedWords(currentWords) >= limits.maxWordsPerCue
        || projectedText.length > limits.maxCharactersPerCue
        || currentDuration >= limits.maxCueDurationSeconds
      )
    ) {
      flushCurrentCue()
    }

    currentWords.push(word)
    currentText = appendCueToken(currentText, token)

    const nextWord = words[index + 1]
    const gapToNext = nextWord ? nextWord.startSeconds - word.endSeconds : Number.POSITIVE_INFINITY
    const cueDuration = word.endSeconds - currentWords[0]!.startSeconds

    if (
      countedWords(currentWords) >= limits.maxWordsPerCue
      || currentText.length >= limits.maxCharactersPerCue
      || cueDuration >= limits.maxCueDurationSeconds
      || gapToNext >= limits.hardBreakGapSeconds
      || (/[.!?]$/.test(currentText) && countedWords(currentWords) >= 3)
      || (/[,:;]$/.test(currentText) && countedWords(currentWords) >= 2 && gapToNext >= 0.25)
    ) {
      flushCurrentCue()
    }
  }

  flushCurrentCue()
  return cues
}

const parseWhisperSegmentTimestamp = (timestamp: string): number => {
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
    const start = parseWhisperSegmentTimestamp(segment.start)
    const end = parseWhisperSegmentTimestamp(segment.end)
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

/**
 * Build cues from a transcription, preferring native per-word timings over segment stamps. Word timings
 * are exact; segment stamps only bound a whole utterance, so anything derived from them has to guess
 * where each displayed line starts and ends.
 */
export const buildTranscriptionCues = (
  transcription: TranscriptionResult,
  limits: CueBuildLimits
): { cues: CaptionCue[], source: LyricsCueSource } => {
  const words = transcription.evidence?.words ?? []
  const wordCues = buildFromWords(words, limits)
  if (wordCues.length > 0) {
    return { cues: wordCues, source: 'whisper-words' }
  }

  return {
    cues: buildFromSegments(transcription.segments),
    source: 'whisper-segments'
  }
}

export const buildLyricsCues = (
  transcription: TranscriptionResult
): { cues: CaptionCue[], source: LyricsCueSource } => {
  const words = transcription.evidence?.words ?? []
  const wordCues = buildFromWords(words, LYRICS_CUE_LIMITS)
  if (wordCues.length > 0) {
    return { cues: wordCues, source: 'whisper-words' }
  }

  return {
    cues: buildFromSegments(transcription.segments),
    source: 'whisper-segments'
  }
}
