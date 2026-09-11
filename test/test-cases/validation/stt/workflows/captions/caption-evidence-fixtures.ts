import type { TranscriptionResult } from '~/types'

export const word = (text: string, start: number, end: number, speaker?: string) => ({ text, normalized: text.toLowerCase(), startSeconds: start, endSeconds: end, timingSource: 'native' as const, ...(speaker ? { speaker } : {}) })
export const partial: TranscriptionResult = {
  text: 'Hello world. Goodbye.',
  segments: [
    { start: '00:00:00.125', end: '00:00:01.500', text: 'Hello world.', speaker: 'A' },
    { start: '00:00:02.125', end: '00:00:03.750', text: 'Goodbye.', speaker: 'B' }
  ],
  evidence: { words: [word('Hello', .125, .5, 'A'), word('world.', .75, 1.5, 'A')], timingQuality: 'native_word' }
}
