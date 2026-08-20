import { describe, expect, test } from 'bun:test'
import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { validateElevenLabsTtsIvcAudio } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-elevenlabs/elevenlabs-ivc'
import { LOCAL_SHORT_AUDIO_PATH } from './shared'
import { makeTempDir } from '../../../../../test-utils/temp-dirs'

describe('ElevenLabs clone option contracts', () => {
  test('elevenlabs synthesis accepts only an existing voice identity', () => {
      const existingVoice = buildOptsFromFlags(false, {
        'elevenlabs-tts': 'eleven_v3',
        'elevenlabs-voice': 'voice_existing123'
      })

      expect(collectTtsTargets(existingVoice).map((target) => target.voice)).toEqual(['voice_existing123'])
    })

  test('elevenlabs clone audio validation enforces file and extension while warning on duration guidance', async () => {
      const sample = await validateElevenLabsTtsIvcAudio('input/examples/audio/anthony-voice.mp3')
      expect(sample.basename).toBe('anthony-voice.mp3')
      expect(sample.mimeType).toBe('audio/mpeg')

      const tempDir = await makeTempDir('autoshow-elevenlabs-ref-audio-')
      const emptyPath = join(tempDir, 'empty.mp3')
      const textPath = join(tempDir, 'not-audio.txt')
      await writeFile(emptyPath, '')
      await writeFile(textPath, 'hello')

      try {
        await expect(validateElevenLabsTtsIvcAudio('input/examples/audio/missing.mp3')).rejects.toThrow('not found')
        await expect(validateElevenLabsTtsIvcAudio(textPath)).rejects.toThrow('mp3/mpeg, wav, m4a/mp4, ogg, flac, aac, or webm')
        await expect(validateElevenLabsTtsIvcAudio(emptyPath)).rejects.toThrow('is empty')
        await expect(validateElevenLabsTtsIvcAudio(LOCAL_SHORT_AUDIO_PATH)).resolves.toMatchObject({
          basename: '0-audio-short.mp3'
        })
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })
})
