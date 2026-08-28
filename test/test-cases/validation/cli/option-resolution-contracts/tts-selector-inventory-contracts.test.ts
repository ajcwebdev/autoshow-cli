import { describe,expect,test } from 'bun:test'
import { formatModelSelector } from '~/cli/commands/setup-and-utilities/models/model-validation'
import {
SUPPORTED_CARTESIA_TTS_MODELS,
SUPPORTED_DEEPGRAM_TTS_MODELS,
SUPPORTED_DEEPINFRA_TTS_MODELS,
SUPPORTED_ELEVENLABS_TTS_MODELS,
SUPPORTED_FISH_TTS_MODELS,
SUPPORTED_GEMINI_TTS_MODELS,
SUPPORTED_GROK_TTS_MODELS,
SUPPORTED_GROQ_TTS_MODELS,
SUPPORTED_HUME_TTS_MODELS,
SUPPORTED_INWORLD_TTS_MODELS,
SUPPORTED_MINIMAX_TTS_MODELS,
SUPPORTED_MISTRAL_TTS_MODELS,
SUPPORTED_OPENAI_TTS_MODELS,
SUPPORTED_REPLICATE_TTS_MODELS,
SUPPORTED_SPEECHIFY_TTS_MODELS
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'

describe('option resolution contracts', () => {
  test('hosted TTS exposes exactly 111 active selectors and rejects all retired IDs', () => {
    const hostedSelectors = [
      ...SUPPORTED_ELEVENLABS_TTS_MODELS,
      ...SUPPORTED_MINIMAX_TTS_MODELS,
      ...SUPPORTED_GROQ_TTS_MODELS,
      ...SUPPORTED_GROK_TTS_MODELS,
      ...SUPPORTED_MISTRAL_TTS_MODELS,
      ...SUPPORTED_OPENAI_TTS_MODELS,
      ...SUPPORTED_GEMINI_TTS_MODELS,
      ...SUPPORTED_DEEPGRAM_TTS_MODELS,
      ...SUPPORTED_SPEECHIFY_TTS_MODELS,
      ...SUPPORTED_HUME_TTS_MODELS,
      ...SUPPORTED_CARTESIA_TTS_MODELS,
      ...SUPPORTED_FISH_TTS_MODELS,
      ...SUPPORTED_INWORLD_TTS_MODELS,
      ...SUPPORTED_DEEPINFRA_TTS_MODELS,
      ...SUPPORTED_REPLICATE_TTS_MODELS
    ]
    expect(hostedSelectors).toHaveLength(111)
    expect(hostedSelectors).toEqual(expect.arrayContaining([
      'sonic-3.5-2026-05-04',
      'gpt-4o-mini-tts-2025-12-15',
      'simba-3.2',
      'octave-1',
      'octave-2',
      'aura-2-helena-en',
      'aura-2-arcas-en',
      'aura-2-aries-en',
      'aura-2-ama-ja',
      's2.1-pro',
      'Qwen/Qwen3-TTS-VoiceDesign',
      'jaaari/kokoro-82m'
    ]))
    for (const [flag, model] of [
      ['cartesia-tts', 'sonic-3'],
      ['cartesia-tts', 'sonic-3.5'],
      ['openai-tts', 'gpt-4o-mini-tts'],
      ['speechify-tts', 'simba-english']
    ] as const) {
      expect(() => buildOptsFromFlags({ [flag]: model }))
        .toThrow(`Invalid model "${model}" for ${formatModelSelector(flag)}`)
    }
    for (const [flag, model, replacement] of [
      ['elevenlabs-tts', 'eleven_multilingual_v2', 'eleven_v3'],
      ['elevenlabs-tts', 'eleven_flash_v2_5', 'eleven_v3'],
      ['inworld-tts', 'realtime-tts-2-flash', 'realtime-tts-2'],
      ['speechify-tts', 'simba-3.0', 'simba-3.2'],
      ['deepinfra-tts', 'ResembleAI/chatterbox-multilingual', 'ResembleAI/chatterbox-turbo'],
      ['fish-tts', 'fish-speech-1.5', 's2.1-pro'],
      ['fish-tts', 's1', 's2.1-pro'],
      ['fish-tts', 's2-pro', 's2.1-pro'],
      ['fish-tts', 'voice-design-1', 's2.1-pro']
    ] as const) {
      expect(() => buildOptsFromFlags({ [flag]: model }))
        .toThrow(`Model "${model}" is retired for ${formatModelSelector(flag)}. Use "${replacement}" instead.`)
    }
  })
})
