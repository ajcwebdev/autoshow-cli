import { describe, expect, test } from 'bun:test'
import { inferTestKind } from '../../../../test-runner/reports/context'

describe('test-runner test-kind classification', () => {
  test('path rules take precedence over conflicting title hints', () => {
    const collisions = [
      ['/step-7-music-gen-e2e/example.test.ts', 'extract a document', 'music'],
      ['/step-6-video-gen-e2e/example.test.ts', 'transcribe speech.wav', 'video'],
      ['/step-5-image-gen-e2e/example.test.ts', 'generate music', 'image'],
      ['/step-4-tts-e2e/example.test.ts', 'generate an image', 'tts'],
      ['/step-3-write-e2e/example.test.ts', 'generate a video', 'write'],
      ['/step-2-stt-e2e/example.test.ts', 'extract a page', 'transcribe'],
      ['/step-2-ocr-e2e/example.test.ts', 'generate music', 'extract'],
    ] as const

    for (const [file, name, expected] of collisions) {
      expect(inferTestKind({ file, name })).toBe(expected)
    }
  })

  test('ordered title rules cover compound media hints and an unmatched case', () => {
    const cases = [
      ['transcribe an image', 'transcribe'],
      ['extract generated music', 'extract'],
      ['writes speech.wav', 'tts'],
      ['uses generated-image output', 'image'],
      ['polls Veo', 'video'],
      ['uses generated music', 'music'],
      ['ordinary validation contract', null],
    ] as const

    for (const [name, expected] of cases) {
      expect(inferTestKind({ file: '/validation/example.test.ts', name })).toBe(expected)
    }
  })
})
