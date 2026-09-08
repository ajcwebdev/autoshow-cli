import { test, expect } from 'bun:test'
import { alignConsensusWords } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/consensus-word-alignment'
import type { TranscriptionEvidenceWord } from '~/types'
const word = (text: string, startSeconds: number, speaker = 'speaker-1'): TranscriptionEvidenceWord => ({ text, normalized: text, startSeconds, endSeconds: startSeconds + .2, speaker, timingSource: 'native' })

test('consensus alignment keeps repetitions, omissions, canonical speakers and timeline offsets', () => {
  const anchors = [word('go', 1), word('go', 1.5), word('now', 2), word('yes', 3, 'speaker-2')]
  const { words, decisions } = alignConsensusWords(anchors, [
    { provider: 'a', words: anchors, offsetSeconds: .04 },
    { provider: 'b', words: [word('go', 1.52), word('now', 2.02), word('yes', 3.02, 'speaker-2')], offsetSeconds: .04 }
  ], .04)
  expect(words.map(w => w.text)).toEqual(['go', 'go', 'now', 'yes'])
  expect(decisions[0]?.supporting).toHaveLength(1)
  expect(decisions[1]?.supporting.map(s => s.wordIndex)).toEqual([1, 0])
  expect(words[1]?.startSeconds).toBeCloseTo(1.55)
  expect(words[3]?.speaker).toBe('speaker-2')
  expect(decisions[1]?.method).toBe('median')
})

test('conflicting boundaries use actual evidence and missing words are explicitly interpolated', () => {
  const { words, decisions } = alignConsensusWords([word('hello', 1), word('missing', 2), word('yes', 3, 'speaker-2')], [
    { provider: 'a', words: [word('hello', 1.02), word('yes', 3, 'speaker-1')], offsetSeconds: 0 },
    { provider: 'b', words: [word('hello', 1.5)], offsetSeconds: 0 }
  ])
  expect(words[0]?.startSeconds).toBe(1.02)
  expect(decisions[0]).toMatchObject({ method: 'provider', review: true })
  expect(words[1]?.timingSource).toBe('interpolated')
  expect(decisions[2]?.supporting).toHaveLength(0)
})
