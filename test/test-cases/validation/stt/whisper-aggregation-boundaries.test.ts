import { describe, expect, test } from 'bun:test'
import { parseWhisperJson } from '~/cli/commands/stt/local/whisper/parse-whisper-output'

const stamp = (ms: number) => new Date(ms).toISOString().slice(11, 23)
const segment = (text: string, start: number) => ({ text, timestamps: { from: stamp(start), to: stamp(start + 100) }, offsets: { from: start, to: start + 100 } })

describe('Whisper gap and word-count boundaries', () => {
  for (const [gap, expected] of [[10, 'Helloworld.'], [11, 'Hello world.'], [800, 'Hello world.'], [801, 'Hello, world.'], [1500, 'Hello, world.'], [1501, 'Hello. World.']] as const) {
    test(`spacing and punctuation at ${gap} ms`, () => {
      expect(parseWhisperJson(JSON.stringify({ transcription: [segment('hello', 0), segment('world', 100 + gap)] })).text).toBe(expected)
    })
  }
  for (const [boundary, gap, punctuation, counts] of [
    [0, 0, false, [45, 1]],
    [10, 3000, false, [45, 1]],
    [10, 3001, false, [10, 36]],
    [9, 3001, false, [45, 1]],
    [20, 1500, true, [45, 1]],
    [20, 1501, true, [20, 26]],
    [35, 50, true, [35, 11]],
  ] as const) {
    test(`segment boundary after ${boundary} words with gap ${gap} and punctuation ${punctuation}`, () => {
      let start = 0
      const transcription = Array.from({ length: 46 }, (_, index) => {
        const value = segment(punctuation && index + 1 === boundary ? 'word.' : 'word', start)
        start += 100 + (index + 1 === boundary ? gap : 50)
        return value
      })
      const result = parseWhisperJson(JSON.stringify({ transcription }))
      expect(result.segments.map(segment => segment.text.split(/\s+/).length)).toEqual([...counts])
      expect(result.segments[0]!.start).toBe('00:00:00.000')
      expect(result.segments.at(-1)!.end).toBe(transcription.at(-1)!.timestamps.to)
    })
  }
})
