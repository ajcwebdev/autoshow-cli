import { describe, expect, test } from 'bun:test'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import {
  resolveOpenAITtsVoiceForModel,
  SUPPORTED_CARTESIA_TTS_MODELS,
  SUPPORTED_GROK_TTS_VOICES,
  SUPPORTED_INWORLD_TTS_MODELS,
  SUPPORTED_OPENAI_TTS_MODELS,
  SUPPORTED_OPENAI_TTS_VOICES,
  validateCartesiaTtsModel,
  validateGrokTtsVoice,
  validateInworldTtsModel,
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'

const CHECKED_AT = '2026-09-14'

describe('official TTS provider catalog refresh', () => {
  test('xAI registry exposes all 26 current built-ins and preserves custom-ID validation', () => {
    const service = getModelRegistry().tts['grok']

    expect(service?.catalogSourceUrl).toBe('https://docs.x.ai/developers/model-capabilities/audio/text-to-speech')
    expect(service?.catalogCheckedAt).toBe(CHECKED_AT)
    expect(SUPPORTED_GROK_TTS_VOICES).toHaveLength(26)
    expect(SUPPORTED_GROK_TTS_VOICES).toEqual(expect.arrayContaining([
      'carina', 'zagan', 'helix', 'atlas', 'ara', 'eve', 'leo', 'rex', 'sal'
    ]))
    expect(validateGrokTtsVoice('CARINA')).toBe('carina')
    expect(validateGrokTtsVoice('AB12CD34')).toBe('ab12cd34')
    expect(() => validateGrokTtsVoice('not-a-voice')).toThrow('Invalid --grok-tts-voice')
  })

  test('OpenAI retains fixed request-schema models and types eligible custom voices as objects', () => {
    const service = getModelRegistry().tts['openai']

    expect(service?.catalogSourceUrl).toBe('https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create')
    expect(service?.catalogCheckedAt).toBe(CHECKED_AT)
    expect(SUPPORTED_OPENAI_TTS_MODELS).toEqual([
      'gpt-4o-mini-tts-2025-12-15'
    ])
    expect(SUPPORTED_OPENAI_TTS_VOICES).toHaveLength(13)
    expect(resolveOpenAITtsVoiceForModel('gpt-4o-mini-tts-2025-12-15', 'MARIN')).toEqual({
      kind: 'built-in',
      voiceId: 'marin',
      requestVoice: 'marin'
    })
    expect(resolveOpenAITtsVoiceForModel('gpt-4o-mini-tts-2025-12-15', 'voice_123abc')).toEqual({
      kind: 'custom',
      voiceId: 'voice_123abc',
      requestVoice: { id: 'voice_123abc' }
    })
    expect(() => resolveOpenAITtsVoiceForModel('gpt-4o-mini-tts-2025-12-15', 'made-up')).toThrow('eligible custom voice ID')
  })

  test('Cartesia and Inworld catalogs stay on the 2026-09-14 one-model-per-provider pins', () => {
    const cartesia = getModelRegistry().tts['cartesia']
    const inworld = getModelRegistry().tts['inworld']

    expect(cartesia?.catalogCheckedAt).toBe(CHECKED_AT)
    expect(inworld?.catalogCheckedAt).toBe(CHECKED_AT)
    expect(SUPPORTED_CARTESIA_TTS_MODELS).toEqual(['sonic-3.6-2026-08-27'])
    expect(SUPPORTED_INWORLD_TTS_MODELS).toEqual(['realtime-tts-2'])
    expect(validateCartesiaTtsModel('sonic-3.6-2026-08-27')).toBe('sonic-3.6-2026-08-27')
    expect(validateInworldTtsModel('realtime-tts-2')).toBe('realtime-tts-2')
    expect(() => validateCartesiaTtsModel('sonic-3.6')).toThrow('Invalid model "sonic-3.6"')
    expect(() => validateCartesiaTtsModel('sonic-preview')).toThrow('Invalid model "sonic-preview"')
  })
})
