import type { TranscriptionSegment, WhisperfileJsonOutput } from '~/types'
import { WhisperfileJsonOutputSchema } from '~/types'
import { validateJson } from '~/utils/validate/validation'
import { clampSegmentsToKnownEnd, clampWordTimingsToKnownEnd } from '../../workflows/timing/stt-timing-quality'
import { appendWhisperfileSegmentText, cleanWhisperfileSegmentText, resolveWhisperfileSegmentBreak } from './whisperfile-aggregation-policy'

export const parseWhisperfileJson = (
  jsonContent: string,
  options: { maxEndSeconds?: number | undefined } = {}
): { text: string, segments: TranscriptionSegment[] } => {
  const data = validateJson(WhisperfileJsonOutputSchema, jsonContent, 'Whisper JSON output')
  const wordSegments = data.transcription.filter(seg => seg.text.trim().length > 0)
  const aggregatedSegments = clampSegmentsToKnownEnd(
    aggregateWordSegments(wordSegments),
    options.maxEndSeconds
  ).segments
  const fullText = aggregatedSegments.map(seg => seg.text).join(' ')
  return { text: fullText, segments: aggregatedSegments }
}

export const extractWhisperfileWords = (
  jsonContent: string,
  options: { maxEndSeconds?: number | undefined } = {}
): Array<{ start: number; end: number; word: string; confidence?: number; repaired?: boolean }> => {
  const data = validateJson(WhisperfileJsonOutputSchema, jsonContent, 'Whisper JSON output words')
  const words: Array<{ start: number, end: number, word: string; confidence?: number; repaired?: boolean }> = []
  const usesLeadingSpaces = data.transcription.some(segment => /^\s/.test(segment.text))
  for (const segment of data.transcription) {
    const text = segment.text
    if (!text.trim() || /^\[.*\]$/.test(text.trim())) continue
    const start = parseTimestampMs(segment.timestamps.from) / 1000
    const end = parseTimestampMs(segment.timestamps.to) / 1000
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) continue
    const probabilities = (segment.tokens ?? []).flatMap(token => typeof token.p === 'number' && Number.isFinite(token.p) && token.p >= 0 && token.p <= 1 ? [token.p] : [])
    const confidence = probabilities.length ? Math.min(...probabilities) : undefined
    const previous = words.at(-1)
    const punctuation = /^[,.;:!?'’)]/.test(text)
    if (previous && (punctuation || /['’]$/.test(previous.word) || (usesLeadingSpaces && !/^\s/.test(text)))) {
      previous.word += text.trim()
      previous.end = Math.max(previous.end, end)
      if (confidence !== undefined) previous.confidence = Math.min(previous.confidence ?? confidence, confidence)
    } else {
      words.push({ start, end, word: text.trim(), ...(confidence !== undefined ? { confidence } : {}) })
    }
  }

  return clampWordTimingsToKnownEnd(words, options.maxEndSeconds).words.map((word, index) => ({
    ...word, ...(word.start !== words[index]!.start || word.end !== words[index]!.end ? { repaired: true } : {})
  }))
}

const aggregateWordSegments = (wordSegments: WhisperfileJsonOutput['transcription']): TranscriptionSegment[] => {
  const segments: TranscriptionSegment[] = []
  let currentText = ''
  let segmentStart = ''
  let segmentEnd = ''
  let actualWordCount = 0
  let i = 0
  let isNewSentence = true
  while (i < wordSegments.length) {
    const wordSeg = wordSegments[i]!
    let text = wordSeg.text
    if (!text || text.trim().length === 0) {
      i++
      continue
    }
    if (!segmentStart) {
      segmentStart = formatTimestampForDisplay(wordSeg.timestamps.from)
    }
    const prevSeg = i > 0 ? wordSegments[i - 1] : null
    const nextSeg = i + 1 < wordSegments.length ? wordSegments[i + 1] : null
    const currentStartTime = parseTimestamp(wordSeg.timestamps.from)
    const prevEndTime = prevSeg ? parseTimestamp(prevSeg.timestamps.to) : 0
    const gapFromPrev = prevSeg ? currentStartTime - prevEndTime : 1000
    const appended = appendWhisperfileSegmentText(currentText, text, isNewSentence, gapFromPrev)
    currentText = appended.currentText
    text = appended.text
    isNewSentence = appended.isNewSentence
    const currentFullText = currentText.trim()
    actualWordCount = currentFullText.split(/\s+/).filter(w => w.length > 0).length
    segmentEnd = formatTimestampForDisplay(wordSeg.timestamps.to)
    const isLastSegment = i === wordSegments.length - 1
    const nextGap = nextSeg ? parseTimestamp(nextSeg.timestamps.from) - parseTimestamp(wordSeg.timestamps.to) : 0
    const { shouldBreak, hasVeryLongPause } = resolveWhisperfileSegmentBreak(text, actualWordCount, nextGap, isLastSegment)
    if (shouldBreak) {
      const cleanedText = cleanWhisperfileSegmentText(currentFullText, isLastSegment || hasVeryLongPause)
      if (cleanedText.length > 0) {
        segments.push({
          start: segmentStart,
          end: segmentEnd,
          text: cleanedText
        })
      }
      currentText = ''
      segmentStart = ''
      actualWordCount = 0
      isNewSentence = true
    }
    i++
  }
  if (currentText.trim().length > 0) {
    const cleanedText = cleanWhisperfileSegmentText(currentText.trim(), true)
    segments.push({
      start: segmentStart,
      end: segmentEnd,
      text: cleanedText
    })
  }
  return segments
}

const formatTimestampForDisplay = (timestamp: string): string => {
  const cleaned = timestamp.replace(',', '.')
  const parts = cleaned.split(':')
  if (parts.length === 3) {
    const [hours, minutes, secondsWithMs] = parts
    const [seconds, milliseconds] = secondsWithMs!.split('.')
    return `${hours}:${minutes}:${seconds!.padStart(2, '0')}.${(milliseconds ?? '').padEnd(3, '0')}`
  }
  return cleaned
}

const parseTimestamp = (timestamp: string): number => {
  const cleaned = timestamp.replace(',', '.')
  const match = cleaned.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})/)
  if (match) {
    const [, hours, minutes, seconds, ms] = match
    return parseInt(hours!) * 3600000 +
           parseInt(minutes!) * 60000 +
           parseInt(seconds!) * 1000 +
           parseInt(ms!)
  }
  return 0
}

const parseTimestampMs = (timestamp: string): number => {
  const cleaned = timestamp.replace(',', '.')
  const m = cleaned.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})/)
  if (!m) return Number.NaN
  const [, h, mnt, s, ms] = m
  return parseInt(h!) * 3600000 + parseInt(mnt!) * 60000 + parseInt(s!) * 1000 + parseInt(ms!)
}
