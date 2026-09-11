import { describe, expect, test } from 'bun:test'
import { inferTestKind } from '../../../../test-runner/reports/context'

describe('test-runner test-kind classification', () => {
  test('path rules take precedence over conflicting title hints', () => {
    const collisions = [
      ['/audio/music/example.test.ts', 'extract a document', 'music'],
      ['/visuals/video/example.test.ts', 'transcribe speech.wav', 'video'],
      ['/visuals/image/example.test.ts', 'generate music', 'image'],
      ['/audio/tts/example.test.ts', 'generate an image', 'tts'],
      ['/text/write/example.test.ts', 'generate a video', 'write'],
      ['/stt/example.test.ts', 'extract a page', 'transcribe'],
      ['/text/ocr/example.test.ts', 'generate music', 'extract'],
      ['/text/url/example.test.ts', 'generate music', 'extract'],
      ['/e2e/local/stt/whisperfile/example.test.ts', 'extract a page', 'transcribe'],
      ['/e2e/service/stt/diarization/example.test.ts', 'extract a page', 'transcribe'],
      ['/e2e/service/stt/diarization-off-by-default/example.test.ts', 'extract a page', 'transcribe'],
      ['/e2e/service/stt/direct-url/example.test.ts', 'extract a page', 'transcribe'],
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
