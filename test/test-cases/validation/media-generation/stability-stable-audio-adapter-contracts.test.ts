import { describe, expect, test } from 'bun:test'
import { resolveSoundEffectTarget } from '~/cli/commands/process-steps/step-4-tts/soundscape/elevenlabs-sfx-adapter'
import {
  createStabilitySoundEffectAdapter,
  serializeStabilitySoundEffectRequest,
  STABILITY_STABLE_AUDIO_MODEL_ID,
  STABILITY_STABLE_AUDIO_SELECTOR,
  validateStabilitySoundEffectTask,
} from '~/cli/commands/process-steps/step-4-tts/soundscape/stability-stable-audio-adapter'

describe('Stability Stable Audio 3 SFX contracts', () => {
  test('resolves the registered Stability SFX selector', () => {
    const target = resolveSoundEffectTarget(STABILITY_STABLE_AUDIO_SELECTOR)
    expect(target.provider).toBe('stability')
    expect(target.model).toBe(STABILITY_STABLE_AUDIO_MODEL_ID)
    expect(() => resolveSoundEffectTarget('stability=stable-audio-2')).toThrow(/Unsupported Stability sound-effect model/)
  })

  test('rejects vocal reactions and serializes action-SFX requests', () => {
    const target = resolveSoundEffectTarget(STABILITY_STABLE_AUDIO_SELECTOR)
    const task = {
      taskId: 'task-1',
      cueId: 'cue-1',
      kind: 'action-sfx' as const,
      prompt: 'glass shatter',
      durationSeconds: 4,
      requestIdentity: '',
      outputFormat: 'wav',
      promptInfluence: 1,
      generationIdentity: 'gen-1',
      required: true,
      loop: false,
    }
    expect(() => validateStabilitySoundEffectTask({ ...task, kind: 'vocal-reaction' }, target)).toThrow(/cannot render vocal reactions/)
    expect(serializeStabilitySoundEffectRequest(task, target)).toEqual({
      path: '/v2beta/audio/stable-audio-3/text-to-audio',
      body: { prompt: 'glass shatter', duration: 4, output_format: 'wav' },
    })
  })

  test('rejects a missing API key', () => {
    expect(() => createStabilitySoundEffectAdapter({ apiKey: '' })).toThrow(/STABILITY_API_KEY/)
  })
})
