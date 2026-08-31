import { describe, expect, test } from 'bun:test'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import {
  resolveOpenAITtsVoiceForModel,
  SUPPORTED_GROK_TTS_VOICES,
  SUPPORTED_OPENAI_TTS_MODELS,
  SUPPORTED_OPENAI_TTS_VOICES,
  validateGrokTtsVoice,
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'

const CHECKED_AT = '2026-08-11'

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
})
