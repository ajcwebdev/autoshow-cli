import { formatCaptionTimestamp, hmsPartsToSeconds } from '~/cli/commands/audio/music/lyrics-video/captions'
import { TRANSCRIPT_CUE_LIMITS, buildTranscriptionCues } from '~/cli/commands/audio/music/lyrics-video/cue-builder'
import { formatSpeakerDisplayLabel } from '~/cli/commands/audio/music/lyrics-video/render'
import type { CaptionCue, TranscriptCue, TranscriptCueSource, TranscriptionResult } from '~/types'
import { ValidationError } from '~/utils/error-handler'

const TRANSCRIPT_LINE_PATTERN = /^\[(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)\]\s+(?:\[([^\]]+)\]\s+)?(.*)$/

const MAX_TRANSCRIPT_WORDS_PER_CUE = 12

const MAX_TRANSCRIPT_CHARACTERS_PER_CUE = 78

const normalizeText = (text: string): string =>
  text.replace(/\s+/g, ' ').trim()

const splitTranscriptText = (text: string): string[] => {
  const words = normalizeText(text).split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return []
  }

  const chunks: string[] = []
  let currentWords: string[] = []

  const flush = (): void => {
    if (currentWords.length === 0) {
      return
    }
    chunks.push(currentWords.join(' '))
    currentWords = []
  }

  for (const word of words) {
    const projected = currentWords.length === 0 ? word : `${currentWords.join(' ')} ${word}`
    if (
      currentWords.length > 0
      && (
        currentWords.length >= MAX_TRANSCRIPT_WORDS_PER_CUE
        || projected.length > MAX_TRANSCRIPT_CHARACTERS_PER_CUE
      )
    ) {
      flush()
    }

    currentWords.push(word)

    if (
      currentWords.length >= 6
      && (
        /[.!?]$/.test(word)
        || (currentWords.length >= 8 && /[,;:]$/.test(word))
      )
    ) {
      flush()
    }
  }

  flush()
  return chunks
}

const splitTranscriptCue = (cue: TranscriptCue): TranscriptCue[] => {
  const chunks = splitTranscriptText(cue.text)
  if (chunks.length <= 1) {
    return [{
      ...cue,
      text: chunks[0] ?? cue.text
    }]
  }

  const cueDuration = Math.max(cue.end - cue.start, 0.1)
  const weights = chunks.map((chunk) => Math.max(1, chunk.split(/\s+/).filter(Boolean).length))
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  let elapsedWeight = 0

  return chunks.map((chunk, index) => {
    const startWeight = elapsedWeight
    elapsedWeight += weights[index] ?? 1
    return {
      ...cue,
      index: 0,
      start: cue.start + (cueDuration * startWeight / totalWeight),
      end: cue.start + (cueDuration * elapsedWeight / totalWeight),
      text: chunk
    }
  })
}

const expandTranscriptCues = (
  cues: TranscriptCue[],
  audioDurationSeconds?: number | undefined
): TranscriptCue[] =>
  repairCueDurations(cues, audioDurationSeconds)
    .flatMap(splitTranscriptCue)
    .map((cue, index) => ({ ...cue, index }))

const parseTimestampToSeconds = (timestamp: string): number => {
  const match = timestamp.trim().match(/^(\d{2}):(\d{2}):(\d{2})(?:([.,])(\d{1,3}))?$/)
  if (!match) {
    return Number.NaN
  }

  return hmsPartsToSeconds(match[1]!, match[2]!, match[3]!, match[5]?.padEnd(3, '0') ?? '0')
}

const repairCueDurations = (
  cues: TranscriptCue[],
  audioDurationSeconds?: number | undefined
): TranscriptCue[] => cues.map((cue, index) => {
  const nextCue = cues[index + 1]
  let end = cue.end

  if (!Number.isFinite(end) || end <= cue.start) {
    if (nextCue && nextCue.start > cue.start) {
      end = nextCue.start
    } else if (audioDurationSeconds !== undefined && audioDurationSeconds > cue.start) {
      end = audioDurationSeconds
    } else {
      end = cue.start + 2.5
    }
  }

  return {
    ...cue,
    end: Math.max(end, cue.start + 0.1)
  }
}).filter((cue) => cue.end > cue.start)

export const buildCuesFromTranscriptionResult = (
  result: TranscriptionResult
): { cues: TranscriptCue[], cueSource: TranscriptCueSource } => {
  if ((result.evidence?.words?.length ?? 0) > 0) {
    const { cues } = buildTranscriptionCues(result, TRANSCRIPT_CUE_LIMITS)
    const wordCues = cues.map((cue, index) => ({
      index,
      start: cue.start,
      end: cue.end,
      text: cue.text,
      ...(cue.speaker ? { speaker: cue.speaker } : {})
    }))

    if (wordCues.length > 0) {
      return { cues: wordCues, cueSource: 'extract-evidence-words' }
    }
  }

  const evidenceSegments = result.evidence?.segments ?? []
  if (evidenceSegments.length > 0) {
    const cues = evidenceSegments
      .map((segment) => ({
        index: 0,
        start: segment.startSeconds,
        end: segment.endSeconds,
        text: normalizeText(segment.text),
        ...(segment.speaker ? { speaker: segment.speaker } : {})
      }))
      .filter((cue) =>
        Number.isFinite(cue.start)
        && Number.isFinite(cue.end)
        && cue.text.length > 0
      )
      .sort((left, right) => left.start - right.start || left.end - right.end)
      .map((cue, index) => ({ ...cue, index }))

    if (cues.length > 0) {
      return { cues: expandTranscriptCues(cues), cueSource: 'extract-evidence-segments' }
    }
  }

  const cues = result.segments
    .map((segment) => ({
      index: 0,
      start: parseTimestampToSeconds(segment.start),
      end: parseTimestampToSeconds(segment.end),
      text: normalizeText(segment.text),
      ...(segment.speaker ? { speaker: segment.speaker } : {})
    }))
    .filter((cue) =>
      Number.isFinite(cue.start)
      && Number.isFinite(cue.end)
      && cue.text.length > 0
    )
    .sort((left, right) => left.start - right.start || left.end - right.end)
    .map((cue, index) => ({ ...cue, index }))

  return { cues: expandTranscriptCues(cues), cueSource: 'extract-result-segments' }
}

export const buildCuesFromTranscriptText = (
  transcriptText: string,
  audioDurationSeconds?: number | undefined
): { result: TranscriptionResult, cues: TranscriptCue[] } => {
  const parsed: Array<Omit<TranscriptCue, 'index' | 'end'> & { end?: number | undefined }> = []

  for (const rawLine of transcriptText.split('\n')) {
    const line = rawLine.trim()
    if (line.length === 0) {
      continue
    }

    const match = line.match(TRANSCRIPT_LINE_PATTERN)
    if (!match) {
      continue
    }

    const text = normalizeText(match[3] ?? '')
    const start = parseTimestampToSeconds(match[1]!)
    if (!Number.isFinite(start) || text.length === 0) {
      continue
    }

    parsed.push({
      start,
      text,
      ...(typeof match[2] === 'string' && match[2].trim().length > 0 ? { speaker: match[2].trim() } : {})
    })
  }

  if (parsed.length === 0) {
    throw ValidationError('Transcript text contained no timestamped lines in [HH:MM:SS] format', { stage: 'video:transcript' })
  }

  const cues = parsed.map((cue, index) => ({
    ...cue,
    index,
    end: parsed[index + 1]?.start ?? audioDurationSeconds ?? cue.start + 2.5
  }))

  const repaired = expandTranscriptCues(cues, audioDurationSeconds)
  return {
    result: {
      text: repaired.map((cue) => cue.text).join(' ').trim(),
      segments: repaired.map((cue) => ({
        start: formatCaptionTimestamp(cue.start, '.'),
        end: formatCaptionTimestamp(cue.end, '.'),
        text: cue.text,
        ...(cue.speaker ? { speaker: cue.speaker } : {})
      }))
    },
    cues: repaired
  }
}

export const toCaptionCuesWithSpeakerLabels = (cues: TranscriptCue[]): CaptionCue[] =>
  cues.map((cue, index) => ({
    index,
    start: cue.start,
    end: cue.end,
    text: cue.speaker ? `${formatSpeakerDisplayLabel(cue.speaker)}: ${cue.text}` : cue.text
  }))

export const toRenderCues = (cues: TranscriptCue[]): CaptionCue[] =>
  cues.map((cue, index) => ({
    index,
    start: cue.start,
    end: cue.end,
    text: cue.text,
    ...(cue.speaker ? { speaker: cue.speaker } : {})
  }))

export const collectSpeakerInventory = (cues: TranscriptCue[]): string[] => {
  const speakers: string[] = []
  const seen = new Set<string>()
  for (const cue of cues) {
    if (!cue.speaker || seen.has(cue.speaker)) {
      continue
    }
    seen.add(cue.speaker)
    speakers.push(cue.speaker)
  }
  return speakers
}
