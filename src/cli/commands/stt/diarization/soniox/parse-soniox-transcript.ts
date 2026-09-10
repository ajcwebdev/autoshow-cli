import type { SonioxTranscriptResponse, TranscriptionEvidenceWord, TranscriptionResult, TranscriptionSegment } from '~/types'
import {
  formatSpeakerLabel,
  toTimestamp
} from '~/cli/commands/stt/stt-utils/stt-utils'
import { buildTranscriptionWordEvidence } from '~/cli/commands/stt/stt-utils/stt-evidence'

const SILENCE_BREAK_MS = 1500
const MIN_SENTENCE_SEGMENT_CHARS = 80
const MAX_SEGMENT_CHARS = 220

const toSegments = (
  tokens: SonioxTranscriptResponse['tokens'],
  offsetSeconds: number
): TranscriptionSegment[] => {
  const segments: TranscriptionSegment[] = []

  let currentText = ''
  let currentSpeaker: string | undefined
  let segmentStartMs: number | null = null
  let segmentEndMs: number | null = null
  let lastEndMs: number | undefined

  const flush = (): void => {
    const text = currentText.trim()
    if (text.length === 0) {
      currentText = ''
      currentSpeaker = undefined
      segmentStartMs = null
      segmentEndMs = null
      return
    }

    const startSeconds = ((segmentStartMs ?? 0) / 1000) + offsetSeconds
    const endSeconds = ((segmentEndMs ?? segmentStartMs ?? 0) / 1000) + offsetSeconds
    segments.push({
      start: toTimestamp(startSeconds),
      end: toTimestamp(endSeconds),
      text,
      ...(currentSpeaker ? { speaker: currentSpeaker } : {})
    })

    currentText = ''
    currentSpeaker = undefined
    segmentStartMs = null
    segmentEndMs = null
  }

  for (const token of tokens) {
    if (token.text.length === 0) {
      continue
    }

    const startMs: number = token.start_ms ?? segmentEndMs ?? 0
    const endMs: number = token.end_ms ?? startMs
    const speaker = formatSpeakerLabel(token.speaker)
    const speakerChanged = currentText.trim().length > 0 && speaker !== currentSpeaker
    const gapBreak = currentText.trim().length > 0 && lastEndMs !== undefined && startMs - lastEndMs > SILENCE_BREAK_MS

    if (speakerChanged || gapBreak) {
      flush()
    }

    if (segmentStartMs === null) {
      segmentStartMs = startMs
    }

    if (currentSpeaker === undefined && speaker !== undefined) {
      currentSpeaker = speaker
    }

    currentText += token.text
    segmentEndMs = Math.max(segmentEndMs ?? endMs, endMs)
    lastEndMs = endMs

    const trimmed = currentText.trimEnd()
    if ((trimmed.length >= MIN_SENTENCE_SEGMENT_CHARS && /[.!?]["')\]]?$/.test(trimmed)) || trimmed.length >= MAX_SEGMENT_CHARS) {
      flush()
    }
  }

  flush()
  return segments
}

const toEvidenceWords = (
  tokens: SonioxTranscriptResponse['tokens'],
  offsetSeconds: number
): TranscriptionEvidenceWord[] => {
  const words: TranscriptionEvidenceWord[] = []
  const chunks: SonioxTranscriptResponse['tokens'][] = []
  for (const token of tokens) {
    const chunk = chunks.at(-1)
    const previous = chunk?.at(-1)
    if (!chunk || !previous || formatSpeakerLabel(token.speaker) !== formatSpeakerLabel(previous.speaker)
      || token.language !== previous.language
      || (typeof token.start_ms === 'number' && typeof previous.end_ms === 'number' && token.start_ms - previous.end_ms > SILENCE_BREAK_MS)) {
      chunks.push([token])
    } else chunk.push(token)
  }
  for (const chunk of chunks) {
    const text = chunk.map(token => token.text).join('')
    let segmenter: Intl.Segmenter
    try { segmenter = new Intl.Segmenter(chunk[0]?.language ?? undefined, { granularity: 'word' }) }
    catch { segmenter = new Intl.Segmenter(undefined, { granularity: 'word' }) }
    const starts = new Set([...segmenter.segment(text)].filter(span => span.isWordLike).map(span => span.index))
    const groups: SonioxTranscriptResponse['tokens'][] = []
    let position = 0
    for (const token of chunk) {
      // Only split at provider-token boundaries. A token spanning several
      // linguistic words keeps its original interval; no intra-token times exist.
      const startsWord = Array.from({ length: token.text.length }, (_, i) => position + i).some(index => starts.has(index))
      if (groups.length === 0 || (startsWord && groups.at(-1)!.some(part => /[\p{L}\p{N}]/u.test(part.text)))) groups.push([token])
      else groups.at(-1)!.push(token)
      position += token.text.length
    }
    for (const group of groups) {
      const text = group.map(token => token.text).join('').trim()
      if (!text) continue
      const timed = group.filter(token => typeof token.start_ms === 'number' && typeof token.end_ms === 'number'
        && Number.isFinite(token.start_ms) && Number.isFinite(token.end_ms) && token.start_ms >= 0 && token.end_ms > token.start_ms)
      if (timed.length === 0) continue
      const confidence = timed.flatMap(token => typeof token.confidence === 'number' && Number.isFinite(token.confidence) && token.confidence >= 0 && token.confidence <= 1 ? [token.confidence] : [])
      const speaker = formatSpeakerLabel(group[0]?.speaker)
      words.push({
        startSeconds: Math.min(...timed.map(token => token.start_ms!)) / 1000 + offsetSeconds,
        endSeconds: Math.max(...timed.map(token => token.end_ms!)) / 1000 + offsetSeconds,
        text, normalized: text.toLowerCase(),
        ...(speaker ? { speaker } : {}),
        ...(confidence.length ? { confidence: Math.min(...confidence) } : {}),
        timingSource: group.some(token => /[\p{L}\p{N}]/u.test(token.text) && !timed.includes(token)) ? 'repaired' : group.length > 1 ? 'token_derived' : 'native'
      })
    }
  }
  return words
}

export const normalizeSonioxTranscript = (
  transcript: SonioxTranscriptResponse,
  offsetSeconds: number
): TranscriptionResult => {
  const text = transcript.text.trim().length > 0
    ? transcript.text.trim()
    : transcript.tokens.map((token) => token.text).join('').trim()
  const segments = toSegments(transcript.tokens, offsetSeconds)
  const finalSegments = segments.length > 0
    ? segments
    : [{
        start: toTimestamp(offsetSeconds),
        end: toTimestamp(offsetSeconds),
        text
      }]
  const evidenceWords = toEvidenceWords(transcript.tokens, offsetSeconds)

  return {
    text,
    segments: finalSegments,
    evidence: buildTranscriptionWordEvidence({ words: evidenceWords, segments: finalSegments, rawResponse: transcript })
  }
}
