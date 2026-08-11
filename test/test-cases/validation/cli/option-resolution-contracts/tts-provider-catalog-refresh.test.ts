import { describe, expect, test } from 'bun:test'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import {
  getGroqDefaultTtsVoiceForModel,
  getGroqTtsVoicesForModel,
  resolveOpenAITtsVoiceForModel,
  SUPPORTED_DEEPGRAM_TTS_MODELS,
  SUPPORTED_GEMINI_TTS_VOICES,
  SUPPORTED_GROK_TTS_VOICES,
  SUPPORTED_GROQ_ARABIC_TTS_VOICES,
  SUPPORTED_GROQ_ENGLISH_TTS_VOICES,
  SUPPORTED_GROQ_TTS_MODELS,
  SUPPORTED_OPENAI_TTS_MODELS,
  SUPPORTED_OPENAI_TTS_VOICES,
  validateDeepgramTtsModel,
  validateGeminiTtsVoice,
  validateGrokTtsVoice,
  validateGroqTtsVoiceForModel
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

  test('Gemini registry validates the complete 30-voice catalog case-insensitively', () => {
    const service = getModelRegistry().tts['gemini']

    expect(service?.catalogSourceUrl).toBe('https://ai.google.dev/gemini-api/docs/speech-generation')
    expect(service?.catalogCheckedAt).toBe(CHECKED_AT)
    expect(SUPPORTED_GEMINI_TTS_VOICES).toHaveLength(30)
    expect(SUPPORTED_GEMINI_TTS_VOICES).toContain('Zubenelgenubi')
    expect(validateGeminiTtsVoice('zUbEnElGeNuBi')).toBe('Zubenelgenubi')
    expect(() => validateGeminiTtsVoice('NotARealGeminiVoice')).toThrow('Invalid --tts-voice gemini=')
  })

  test('Deepgram registry exactly covers all 91 current Aura-2 voices across seven languages', () => {
    const service = getModelRegistry().tts['deepgram']
    const registryModels = Object.keys(service?.models ?? {})

    expect(service?.catalogSourceUrl).toBe('https://developers.deepgram.com/docs/tts-models')
    expect(service?.catalogCheckedAt).toBe(CHECKED_AT)
    expect(SUPPORTED_DEEPGRAM_TTS_MODELS).toHaveLength(91)
    const supportedModels: string[] = [...SUPPORTED_DEEPGRAM_TTS_MODELS]
    expect(supportedModels.sort()).toEqual(registryModels.sort())
    expect(Object.fromEntries(
      ['en', 'es', 'nl', 'fr', 'de', 'it', 'ja'].map((language) => [
        language,
        SUPPORTED_DEEPGRAM_TTS_MODELS.filter((model) => model.endsWith(`-${language}`)).length
      ])
    )).toEqual({ en: 41, es: 17, nl: 9, fr: 2, de: 7, it: 10, ja: 5 })
    expect(validateDeepgramTtsModel('aura-2-ama-ja')).toBe('aura-2-ama-ja')
    expect(() => validateDeepgramTtsModel('aura-asteria-en')).toThrow('Invalid model')
    expect(() => validateDeepgramTtsModel('flux-general-en')).toThrow('Invalid model')
  })

  test('Groq registry exposes separate English and Saudi-Arabic selectors and voices', () => {
    const service = getModelRegistry().tts['groq']

    expect(service?.catalogSourceUrl).toBe('https://console.groq.com/docs/text-to-speech/orpheus')
    expect(service?.catalogCheckedAt).toBe(CHECKED_AT)
    expect(SUPPORTED_GROQ_TTS_MODELS).toEqual([
      'canopylabs/orpheus-v1-english',
      'canopylabs/orpheus-arabic-saudi'
    ])
    expect(getGroqTtsVoicesForModel('canopylabs/orpheus-v1-english')).toEqual(SUPPORTED_GROQ_ENGLISH_TTS_VOICES)
    expect(getGroqTtsVoicesForModel('canopylabs/orpheus-arabic-saudi')).toEqual(SUPPORTED_GROQ_ARABIC_TTS_VOICES)
    expect(getGroqDefaultTtsVoiceForModel('canopylabs/orpheus-v1-english')).toBe('troy')
    expect(getGroqDefaultTtsVoiceForModel('canopylabs/orpheus-arabic-saudi')).toBe('abdullah')
    expect(validateGroqTtsVoiceForModel('canopylabs/orpheus-arabic-saudi', 'NOURA')).toBe('noura')
    expect(() => validateGroqTtsVoiceForModel('canopylabs/orpheus-v1-english', 'noura')).toThrow('for canopylabs/orpheus-v1-english')
    expect(() => validateGroqTtsVoiceForModel('canopylabs/orpheus-arabic-saudi', 'hannah')).toThrow('for canopylabs/orpheus-arabic-saudi')
  })

  test('OpenAI retains fixed request-schema models and types eligible custom voices as objects', () => {
    const service = getModelRegistry().tts['openai']

    expect(service?.catalogSourceUrl).toBe('https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create')
    expect(service?.catalogCheckedAt).toBe(CHECKED_AT)
    expect(SUPPORTED_OPENAI_TTS_MODELS).toEqual([
      'gpt-4o-mini-tts-2025-12-15',
      'tts-1',
      'tts-1-hd'
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
    expect(() => resolveOpenAITtsVoiceForModel('tts-1', 'marin')).toThrow('for tts-1')
    expect(() => resolveOpenAITtsVoiceForModel('gpt-4o-mini-tts-2025-12-15', 'made-up')).toThrow('eligible custom voice ID')
  })
})
