import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { assertDecodableMedia, assertStructuredContent, assertSummaryFields, assertTextContent, containedArtifactPath } from '../../../test-utils/assert-generated-content'
import { createMockWavBytes, createSyntheticWavBytes, redDotPng } from '../../../test-utils/media-fixtures'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { assertSpokenTextMatch } from '../../../test-utils/tts-transcript-oracle'

describe('generated artifact assertions reject false successes', () => {
  test('spoken-text checks reject leaked directions, missing lines and reordered words', () => {
    const reference = 'I am whispering. This is just for you.'
    expect(() => assertSpokenTextMatch(reference, reference)).not.toThrow()
    expect(() => assertSpokenTextMatch(reference, reference + " [BLANK_AUDIO]")).not.toThrow()
    expect(() => assertSpokenTextMatch(reference, "[BLANK_AUDIO]")).toThrow("nonempty")
    expect(() => assertSpokenTextMatch('AutoShow makes text-to-speech.', 'Auto show makes text to speech.')).not.toThrow()
    expect(() => assertSpokenTextMatch(reference, `As if sharing a private secret with one trusted friend. ${reference}`)).toThrow('Spoken text differs')
    expect(() => assertSpokenTextMatch(reference, 'I am whispering.')).toThrow('Spoken text differs')
    expect(() => assertSpokenTextMatch(reference, 'you for just is This whispering am I')).toThrow('Spoken text differs')
    expect(() => assertSpokenTextMatch(reference, '')).toThrow('nonempty')
  })
  test('JSON parsing alone cannot pass empty or error output', () => {
    for (const value of [null, {}, [], { summary: '' }, { summary: '   ' }, { chapters: [] }, { tokens: 30 }, { error: 'quota exceeded' }]) {
      expect(() => assertStructuredContent(value)).toThrow()
    }
    expect(() => assertStructuredContent({ summary: 'The cat sits by the door.' })).not.toThrow()
  })

  test('timestamps and whitespace alone are not a transcript', () => {
    for (const text of ['', '\n  ', '[00:00:01.250]\n[00:00:02]', '[00:00:01] [speaker-1]', '---']) expect(() => assertTextContent(text)).toThrow()
    expect(() => assertTextContent('[00:00:01] Hello there.')).not.toThrow()
  })

  test('arbitrary JSON strings cannot stand in for the requested summary schema', () => {
    expect(() => assertSummaryFields({ status: 'ok' }, 'shortSummary')).toThrow('episodeDescription')
    expect(() => assertSummaryFields({ episodeDescription: 'A short account.' }, 'shortSummary')).not.toThrow()
    expect(() => assertSummaryFields({ episodeDescription: 'A short account.', episodeSummary: 'A longer account.' }, 'default')).toThrow('chapters')
  })

  test('metadata cannot redirect an artifact assertion outside the run', () => {
    expect(() => containedArtifactPath('/tmp/run', '../old-run/text.json')).toThrow()
    expect(() => containedArtifactPath('/tmp/run', '/tmp/old-run/text.json')).toThrow()
    expect(containedArtifactPath('/tmp/run', 'nested/text.json')).toBe('/tmp/run/nested/text.json')
  })

  test('nonempty corrupt, silent, and wrong-kind files cannot pass media validation', async () => {
    await withTempDir('media-assertion-', async dir => {
      const corrupt = join(dir, 'corrupt.wav')
      await Bun.write(corrupt, '{"error":"provider failed"}')
      await expect(assertDecodableMedia(corrupt, 'audio')).rejects.toThrow()
      const silent = join(dir, 'silent.wav')
      await Bun.write(silent, createMockWavBytes())
      await expect(assertDecodableMedia(silent, 'audio')).rejects.toThrow('silence')
      const tone = join(dir, 'tone.wav')
      await Bun.write(tone, createSyntheticWavBytes({ durationSeconds: 0.25, frequencyHz: 440, amplitude: 0.3 }))
      await assertDecodableMedia(tone, 'audio')
      await expect(assertDecodableMedia(tone, 'audio', { durationSeconds: 5 })).rejects.toThrow('duration')
      await expect(assertDecodableMedia(tone, 'video')).rejects.toThrow('video stream')
      const image = join(dir, 'dot.png')
      await Bun.write(image, redDotPng)
      await assertDecodableMedia(image, 'image')
      const mislabeled = join(dir, 'dot.jpg')
      await Bun.write(mislabeled, redDotPng)
      await expect(assertDecodableMedia(mislabeled, 'image')).rejects.toThrow('file extension')
      await expect(assertDecodableMedia(image, 'image', { aspectRatio: 16 / 9 })).rejects.toThrow('aspect ratio')
    })
  })
})
