import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/download-targets/build-opts-from-flags/build-options-from-flags'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { ELEVENLABS_TTS_IVC_SETUP_MS, validateElevenLabsTtsIvcAudio } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-elevenlabs/elevenlabs-ivc'
import { LOCAL_SHORT_AUDIO_PATH } from './shared'

describe('ElevenLabs clone option contracts', () => {
  test('elevenlabs voice clone target records reference audio speaker and setup estimate', () => {
      const opts = buildOptsFromFlags(false, {
        'elevenlabs-tts': ['eleven_v3'],
        'elevenlabs-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3',
        'elevenlabs-tts-voice-name': 'AutoShow Anthony',
        'elevenlabs-tts-clone-remove-background-noise': true
      }, [], {}, new Set(), [
        '--elevenlabs-tts',
        'eleven_v3',
        '--elevenlabs-tts-ref-audio',
        'input/examples/audio/anthony-voice.mp3',
        '--elevenlabs-tts-voice-name',
        'AutoShow Anthony',
        '--elevenlabs-tts-clone-remove-background-noise'
      ])
      const targets = collectTtsTargets(opts).filter((target) => target.service === 'elevenlabs')

      expect(opts.elevenlabsTtsRefAudio).toBe('input/examples/audio/anthony-voice.mp3')
      expect(opts.elevenlabsTtsVoiceName).toBe('AutoShow Anthony')
      expect(opts.elevenlabsTtsCloneRemoveBackgroundNoise).toBe(true)
      expect(targets.map((target) => ({
        model: target.model,
        voice: target.voice,
        setupCostCents: target.setupCostCents,
        setupTimeMs: target.setupTimeMs,
        setupNote: target.setupNote
      }))).toEqual([
        {
          model: 'eleven_v3',
          voice: 'ref_audio:anthony-voice.mp3',
          setupCostCents: 0,
          setupTimeMs: ELEVENLABS_TTS_IVC_SETUP_MS,
          setupNote: 'ElevenLabs instant voice clone setup'
        }
      ])
    })

  test('elevenlabs clone options validate provider selection and voice reuse', () => {
      const missingElevenLabsModel = buildOptsFromFlags(false, {
        'elevenlabs-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3'
      })
      const voiceNameWithoutReference = buildOptsFromFlags(false, {
        'elevenlabs-tts': 'eleven_v3',
        'elevenlabs-tts-voice-name': 'AutoShow Anthony'
      })
      const voiceWithClone = buildOptsFromFlags(false, {
        'elevenlabs-tts': 'eleven_v3',
        'elevenlabs-voice': 'voice_existing123',
        'elevenlabs-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3'
      })
      const existingVoice = buildOptsFromFlags(false, {
        'elevenlabs-tts': 'eleven_v3',
        'elevenlabs-voice': 'voice_existing123'
      })

      expect(() => collectTtsTargets(missingElevenLabsModel)).toThrow('ElevenLabs TTS IVC flags require selecting elevenlabs TTS')
      expect(() => collectTtsTargets(voiceNameWithoutReference)).toThrow('requires --elevenlabs-tts-ref-audio')
      expect(() => collectTtsTargets(voiceWithClone)).toThrow('cannot be combined with --elevenlabs-voice')
      expect(collectTtsTargets(existingVoice).map((target) => target.voice)).toEqual(['voice_existing123'])
    })

  test('elevenlabs clone audio validation enforces file and extension while warning on duration guidance', async () => {
      const sample = await validateElevenLabsTtsIvcAudio('input/examples/audio/anthony-voice.mp3')
      expect(sample.basename).toBe('anthony-voice.mp3')
      expect(sample.mimeType).toBe('audio/mpeg')

      const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-elevenlabs-ref-audio-'))
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
