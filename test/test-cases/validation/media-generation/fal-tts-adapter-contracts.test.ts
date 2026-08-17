import { describe, expect, test } from 'bun:test'
import { collectFalTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-fal/fal-tts-targets'
import { runFalTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-fal/run-fal-tts'
import {
  buildFalTtsRequestBody,
  FAL_ASYNC_TTS_PRO_MODEL,
  FAL_MAYA_MODEL,
  FAL_SEED_SPEECH_MODEL,
  FAL_TTS_SERIALIZER_VERSION,
  resolveFalTtsDefaultVoice,
} from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-fal/fal-tts-request'
import { createTtsTargetSelection } from '~/cli/commands/process-steps/step-4-tts/tts-targets/tts-target-selection'
import { resolveSoundEffectTarget } from '~/cli/commands/process-steps/step-4-tts/soundscape/elevenlabs-sfx-adapter'

describe('fal.ai TTS contracts', () => {
  test('collects Seed Speech, Maya, and Async TTS Pro targets', () => {
    const selection = createTtsTargetSelection({
      falTtsModels: [FAL_SEED_SPEECH_MODEL, FAL_MAYA_MODEL, FAL_ASYNC_TTS_PRO_MODEL],
    })
    const targets = collectFalTtsTargets(selection)
    expect(targets.map(target => target.model)).toEqual([FAL_SEED_SPEECH_MODEL, FAL_MAYA_MODEL, FAL_ASYNC_TTS_PRO_MODEL])
    expect(targets.every(target => target.service === 'fal')).toBe(true)
    expect(FAL_TTS_SERIALIZER_VERSION).toBe('fal.tts.v1')
    expect(resolveFalTtsDefaultVoice(FAL_SEED_SPEECH_MODEL)).toBe('stokie_en')
  })

  test('serializes model-specific fal.ai request bodies', () => {
    expect(buildFalTtsRequestBody({ model: FAL_SEED_SPEECH_MODEL, text: 'Hello', voice: 'stokie_en', voiceInstruction: 'Speak warmly' })).toEqual({
      text: 'Hello',
      voice: 'stokie_en',
      output_format: 'mp3',
      sample_rate: 24000,
      voice_instruction: 'Speak warmly',
    })
    expect(buildFalTtsRequestBody({ model: FAL_MAYA_MODEL, text: 'Hello <laugh>', voice: 'unused', voiceInstruction: 'Warm narrator' })).toEqual({
      text: 'Hello <laugh>',
      prompt: 'Warm narrator',
      output_format: 'wav',
      sample_rate: '48 kHz',
    })
    expect(buildFalTtsRequestBody({ model: FAL_ASYNC_TTS_PRO_MODEL, text: 'Hello', voice: 'Jennie' })).toEqual({
      transcript: 'Hello',
      voice: { name: 'Jennie' },
    })
  })

  test('rejects missing credentials and is not an SFX provider', async () => {
    await expect(runFalTts('Hello', 'test-out', { model: FAL_SEED_SPEECH_MODEL, apiKey: '' })).rejects.toThrow('fal.ai API key is required')
    expect(() => resolveSoundEffectTarget('fal=fal-ai/maya')).toThrow(/Unsupported sound-effect provider fal/)
  })
})
