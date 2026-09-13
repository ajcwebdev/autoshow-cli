import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { prepareWhisperfileInput } from '~/cli/commands/stt/local/whisperfile/transcribe'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { assertDecodableMedia } from '../../../test-utils/assert-generated-content'

describe('Whisperfile input preparation', () => {
  test('converts PCM WAV through the supported decoder and preserves source audio', async () => {
    await withTempDir('whisper-input-', async dir => {
      const source = join(dir, 'voice.wav')
      const bytes = createSyntheticWavBytes({ durationSeconds: 0.3, frequencyHz: 440, amplitude: 0.3 })
      await Bun.write(source, bytes)
      const prepared = await prepareWhisperfileInput(source)
      try {
        expect(prepared.audioPath).not.toBe(source)
        expect(prepared.audioPath.endsWith('.mp3')).toBe(true)
        await assertDecodableMedia(prepared.audioPath, 'audio', { durationSeconds: 2 })
        const passthrough = await prepareWhisperfileInput(prepared.audioPath)
        expect(passthrough.audioPath).toBe(prepared.audioPath)
        await passthrough.cleanup()
        expect(await Bun.file(prepared.audioPath).exists()).toBe(true)
      } finally {
        await prepared.cleanup()
      }
      expect(await Bun.file(prepared.audioPath).exists()).toBe(false)
      expect(new Uint8Array(await Bun.file(source).arrayBuffer())).toEqual(new Uint8Array(bytes))
    })
  })
})
