import { expect, test } from 'bun:test'
import { normalizeSonioxTranscript } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/soniox/parse-soniox-transcript'
import { TRANSCRIPT_CUE_LIMITS, buildTranscriptionCues } from '~/cli/commands/process-steps/step-7-music/lyrics-video/cue-builder'
import { formatSpeakerDisplayLabel } from '~/cli/commands/process-steps/step-7-music/lyrics-video/render'
import type { SonioxTranscriptResponse, TranscriptionResult } from '~/types'

const sonioxResponse = {
  id: 'fixture',
  text: 'James Perkins, welcome to the show.',
  tokens: [
    { text: 'James', start_ms: 270, end_ms: 330, confidence: 0.99, speaker: '1' },
    { text: ' P', start_ms: 630, end_ms: 690, confidence: 0.98, speaker: '1' },
    { text: 'erk', start_ms: 750, end_ms: 810, confidence: 0.97, speaker: '1' },
    { text: 'in', start_ms: 870, end_ms: 930, confidence: 0.96, speaker: '1' },
    { text: 's,', start_ms: 990, end_ms: 1050, confidence: 0.79, speaker: '1' },
    { text: ' welcome', start_ms: 1170, end_ms: 1350, confidence: 0.99, speaker: '1' },
    { text: ' Thanks', start_ms: 2250, end_ms: 2490, confidence: 0.99, speaker: '2' }
  ]
} as unknown as SonioxTranscriptResponse

test('Soniox sub-word tokens merge into whole evidence words', () => {
  const result = normalizeSonioxTranscript(sonioxResponse, 0)
  const words = result.evidence?.words ?? []

  expect(words.map((word) => word.text)).toEqual(['James', 'Perkins,', 'welcome', 'Thanks'])
  expect(words[1]).toMatchObject({
    text: 'Perkins,',
    startSeconds: 0.63,
    endSeconds: 1.05,
    speaker: '1',
    timingSource: 'native'
  })
  expect(words[1]?.confidence).toBeCloseTo(0.79, 5)
  expect(words[3]).toMatchObject({ text: 'Thanks', speaker: '2' })
})

test('segment stamps keep sub-second precision', () => {
  const result = normalizeSonioxTranscript(sonioxResponse, 0)

  expect(result.segments[0]?.start).toBe('00:00:00.270')
  expect(result.segments.at(-1)?.end).toBe('00:00:02.490')
})

test('transcript cues use native word timings instead of interpolating segment spans', () => {
  const transcription: TranscriptionResult = {
    text: 'one two three four',
    segments: [{ start: '00:00:00.000', end: '00:00:10.000', text: 'one two three four', speaker: '1' }],
    evidence: {
      words: [
        { startSeconds: 4.1, endSeconds: 4.3, text: 'one', normalized: 'one', speaker: '1', timingSource: 'native' },
        { startSeconds: 4.4, endSeconds: 4.7, text: 'two', normalized: 'two', speaker: '1', timingSource: 'native' },
        { startSeconds: 8.2, endSeconds: 8.5, text: 'three', normalized: 'three', speaker: '2', timingSource: 'native' },
        { startSeconds: 8.6, endSeconds: 9.1, text: 'four', normalized: 'four', speaker: '2', timingSource: 'native' }
      ],
      capabilities: { hasNativeWordTiming: true, hasConfidence: false, hasSpeakerLabels: true },
      timingQuality: 'native_word'
    }
  }

  const { cues, source } = buildTranscriptionCues(transcription, TRANSCRIPT_CUE_LIMITS)

  expect(source).toBe('whisper-words')
  expect(cues[0]?.start).toBeCloseTo(4.1, 5)
  expect(cues).toHaveLength(2)
  expect(cues[0]).toMatchObject({ text: 'one two', speaker: '1' })
  expect(cues[1]).toMatchObject({ text: 'three four', speaker: '2' })
  expect(cues[1]?.start).toBeCloseTo(8.2, 5)
  expect(cues[1]?.end).toBeCloseTo(9.1, 5)
})

test('transcript cues fall back to segment stamps when a provider has no word timings', () => {
  const transcription: TranscriptionResult = {
    text: 'only segments',
    segments: [{ start: '00:00:01.500', end: '00:00:03.250', text: 'only segments', speaker: 'speaker-0' }]
  }

  const { cues, source } = buildTranscriptionCues(transcription, TRANSCRIPT_CUE_LIMITS)

  expect(source).toBe('whisper-segments')
  expect(cues[0]?.start).toBeCloseTo(1.5, 5)
  expect(cues[0]?.end).toBeCloseTo(3.25, 5)
  expect(cues[0]?.speaker).toBe('speaker-0')
})

test('every diarized provider label shape renders readably', () => {
  expect(formatSpeakerDisplayLabel('1')).toBe('Speaker 1')
  expect(formatSpeakerDisplayLabel('speaker-0')).toBe('Speaker 0')
  expect(formatSpeakerDisplayLabel('speaker-A')).toBe('Speaker A')
  expect(formatSpeakerDisplayLabel('SPEAKER_00')).toBe('Speaker 0')
  expect(formatSpeakerDisplayLabel('Speaker 2')).toBe('Speaker 2')
  expect(formatSpeakerDisplayLabel('Host')).toBe('Host')
  expect(formatSpeakerDisplayLabel('Guest')).toBe('Guest')
})
