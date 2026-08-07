import { describe, expect, test } from 'bun:test'
import { basename } from 'node:path'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/download-targets/build-opts-from-flags/build-options-from-flags'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import {
  getGroqDefaultTtsVoiceForModel,
  DEEPGRAM_DEFAULT_VOICE,
  GROK_DEFAULT_TTS_VOICE,
  SUPPORTED_ELEVENLABS_TTS_MODELS,
  SUPPORTED_DEEPGRAM_TTS_MODELS,
  SUPPORTED_GEMINI_TTS_MODELS,
  SUPPORTED_GROK_TTS_MODELS,
  SUPPORTED_GROQ_TTS_MODELS,
  SUPPORTED_HUME_TTS_MODELS,
  SUPPORTED_KITTEN_TTS_MODELS,
  SUPPORTED_MINIMAX_TTS_MODELS,
  SUPPORTED_MISTRAL_TTS_MODELS,
  SUPPORTED_OPENAI_TTS_MODELS,
  SUPPORTED_CARTESIA_TTS_MODELS,
  SUPPORTED_SPEECHIFY_TTS_MODELS
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { MISTRAL_DEFAULT_REF_AUDIO } from '~/cli/commands/setup-and-utilities/models/tts-models'

const REMOVED_GROQ_TTS_MODEL = ['canopylabs/orpheus', 'arabic-saudi'].join('-')

const REMOVED_GROQ_TTS_VOICE = ['no', 'ura'].join('')

describe('option resolution contracts', () => {
  test('hosted TTS exposes exactly 24 active selectors and rejects all retired IDs', () => {
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
      ...SUPPORTED_CARTESIA_TTS_MODELS
    ]
    expect(hostedSelectors).toHaveLength(24)
    expect(hostedSelectors).toEqual(expect.arrayContaining([
      'sonic-3.5-2026-05-04',
      'gpt-4o-mini-tts-2025-12-15',
      'simba-3.2',
      'simba-3.0',
      'aura-2-helena-en',
      'aura-2-arcas-en',
      'aura-2-aries-en',
      'eleven_multilingual_v2',
      'eleven_flash_v2_5'
    ]))
    for (const [flag, model] of [
      ['cartesia-tts', 'sonic-3'],
      ['cartesia-tts', 'sonic-3.5'],
      ['openai-tts', 'gpt-4o-mini-tts'],
      ['speechify-tts', 'simba-english']
    ] as const) {
      expect(() => buildOptsFromFlags(false, { [flag]: model })).toThrow(`Invalid --${flag} model "${model}"`)
    }
  })

  test('buildOptsFromFlags maps repeatable dialogue speaker flags', () => {
      const opts = buildOptsFromFlags(false, {
        'mistral-tts': 'voxtral-mini-tts-2603',
        'tts-dialogue-format': 'screenplay',
        'tts-speaker': [
          'DUCO=input/examples/audio/anthony-voice.mp3',
          'CHAT=https://ajc.pics/autoshow/examples/0-audio-short.mp3'
        ]
      })

      expect(opts.ttsDialogueFormat).toBe('screenplay')
      expect(opts.ttsSpeakers).toEqual([
        'DUCO=input/examples/audio/anthony-voice.mp3',
        'CHAT=https://ajc.pics/autoshow/examples/0-audio-short.mp3'
      ])
    })

  test('buildOptsFromFlags maps and validates provider-specific TTS request controls', () => {
      const opts = buildOptsFromFlags(false, {
        'grok-tts': 'grok-tts',
        'grok-tts-voice': 'AB12CD34',
        'grok-tts-language': 'pt-br',
        'grok-tts-text-normalization': true,
        'openai-tts': 'gpt-4o-mini-tts-2025-12-15',
        'openai-tts-instructions': 'Speak with calm narration.',
        'openai-tts-speed': '1.25',
        'minimax-tts': 'speech-2.8-hd',
        'minimax-tts-language-boost': 'english',
        'minimax-tts-speed': '1.2',
        'minimax-tts-volume': '2.5',
        'minimax-tts-pitch': '-2',
        'minimax-tts-emotion': 'CALM',
        'minimax-tts-english-normalization': true,
        'minimax-tts-pronunciation': ['AutoShow/auto show', 'TTS/tee tee ess'],
        'deepgram-tts': 'aura-2-thalia-en',
        'deepgram-tts-encoding': 'linear16',
        'deepgram-tts-container': 'wav',
        'deepgram-tts-bit-rate': '128000',
        'deepgram-tts-sample-rate': '24000',
        'deepgram-tts-speed': '1.1',
        'speechify-tts': 'simba-3.0',
        'speechify-tts-audio-format': 'PCM',
        'speechify-tts-language': 'es-ES',
        'elevenlabs-tts': 'eleven_v3',
        'elevenlabs-tts-output-format': 'mp3_22050_32',
        'elevenlabs-tts-language-code': 'en',
        'elevenlabs-tts-stability': '0.4',
        'elevenlabs-tts-similarity-boost': '0.8',
        'elevenlabs-tts-style': '0.2',
        'elevenlabs-tts-use-speaker-boost': true,
        'elevenlabs-tts-speed': '1.1',
        'elevenlabs-tts-seed': '12345',
        'elevenlabs-tts-text-normalization': 'AUTO',
        'elevenlabs-tts-pronunciation-dictionary-locator': ['dict_1:version_2'],
        'elevenlabs-tts-optimize-streaming-latency': '2'
      })

      expect(opts.grokTtsVoice).toBe('ab12cd34')
      expect(opts.grokTtsLanguage).toBe('pt-BR')
      expect(opts.grokTtsTextNormalization).toBe(true)
      expect(opts.openaiTtsInstructions).toBe('Speak with calm narration.')
      expect(opts.openaiTtsSpeed).toBe(1.25)
      expect(opts.minimaxTtsModel).toBe('speech-2.8-hd')
      expect(opts.minimaxTtsLanguageBoost).toBe('English')
      expect(opts.minimaxTtsSpeed).toBe(1.2)
      expect(opts.minimaxTtsVolume).toBe(2.5)
      expect(opts.minimaxTtsPitch).toBe(-2)
      expect(opts.minimaxTtsEmotion).toBe('calm')
      expect(opts.minimaxTtsEnglishNormalization).toBe(true)
      expect(opts.minimaxTtsPronunciations).toEqual(['AutoShow/auto show', 'TTS/tee tee ess'])
      expect(opts.deepgramTtsEncoding).toBe('linear16')
      expect(opts.deepgramTtsContainer).toBe('wav')
      expect(opts.deepgramTtsBitRate).toBe(128000)
      expect(opts.deepgramTtsSampleRate).toBe(24000)
      expect(opts.deepgramTtsSpeed).toBe(1.1)
      expect(opts.speechifyTtsAudioFormat).toBe('pcm')
      expect(opts.speechifyTtsLanguage).toBe('es-ES')
      expect(opts.elevenlabsTtsOutputFormat).toBe('mp3_22050_32')
      expect(opts.elevenlabsTtsLanguageCode).toBe('en')
      expect(opts.elevenlabsTtsStability).toBe(0.4)
      expect(opts.elevenlabsTtsSimilarityBoost).toBe(0.8)
      expect(opts.elevenlabsTtsStyle).toBe(0.2)
      expect(opts.elevenlabsTtsUseSpeakerBoost).toBe(true)
      expect(opts.elevenlabsTtsSpeed).toBe(1.1)
      expect(opts.elevenlabsTtsSeed).toBe(12345)
      expect(opts.elevenlabsTtsTextNormalization).toBe('auto')
      expect(opts.elevenlabsTtsPronunciationDictionaryLocators).toEqual(['dict_1:version_2'])
      expect(opts.elevenlabsTtsOptimizeStreamingLatency).toBe(2)

      expect(() => buildOptsFromFlags(false, { 'grok-tts-language': 'xx' })).toThrow('Invalid --grok-tts-language "xx"')
      expect(() => buildOptsFromFlags(false, { 'openai-tts-speed': '0.1' })).toThrow('Invalid --openai-tts-speed value "0.1"')
      expect(() => buildOptsFromFlags(false, { 'minimax-tts-language-boost': 'Klingon' })).toThrow('Invalid --minimax-tts-language-boost "Klingon"')
      expect(() => buildOptsFromFlags(false, { 'minimax-tts-speed': '0.4' })).toThrow('Invalid --minimax-tts-speed value "0.4"')
      expect(() => buildOptsFromFlags(false, { 'minimax-tts-volume': '0' })).toThrow('Invalid --minimax-tts-volume value "0"')
      expect(() => buildOptsFromFlags(false, { 'minimax-tts-pitch': '1.5' })).toThrow('Invalid --minimax-tts-pitch value "1.5"')
      expect(() => buildOptsFromFlags(false, { 'minimax-tts-emotion': 'bored' })).toThrow('Invalid --minimax-tts-emotion "bored"')
      expect(() => buildOptsFromFlags(false, { 'speechify-tts-audio-format': 'flac' })).toThrow('Invalid --speechify-tts-audio-format "flac"')
      expect(() => buildOptsFromFlags(false, { 'hume-tts': 'octave-1' })).toThrow('Invalid --hume-tts model "octave-1"')
      expect(() => buildOptsFromFlags(false, { 'hume-tts-voice-provider': 'PRIVATE' })).toThrow('Invalid --hume-tts-voice-provider "PRIVATE"')
      expect(() => buildOptsFromFlags(false, { 'cartesia-tts': 'sonic-2' })).toThrow('Invalid --cartesia-tts model "sonic-2"')
      expect(() => buildOptsFromFlags(false, { 'deepgram-tts-sample-rate': '1.5' })).toThrow('Invalid --deepgram-tts-sample-rate value "1.5"')
      expect(() => buildOptsFromFlags(false, { 'elevenlabs-tts-text-normalization': 'always' })).toThrow('Invalid --elevenlabs-tts-text-normalization "always"')
      expect(() => buildOptsFromFlags(false, { 'elevenlabs-tts-optimize-streaming-latency': '5' })).toThrow('Invalid --elevenlabs-tts-optimize-streaming-latency value "5"')
    })

  test('TTS request control flags require their matching provider selection', () => {
      expect(() => collectTtsTargets(buildOptsFromFlags(false, {
        'openai-tts-speed': '1.1'
      }))).toThrow('OpenAI TTS request control flags require selecting openai TTS')

      expect(() => collectTtsTargets(buildOptsFromFlags(false, {
        'grok-tts-text-normalization': true
      }))).toThrow('Grok TTS request control flags require selecting grok TTS')

      expect(() => collectTtsTargets(buildOptsFromFlags(false, {
        'minimax-tts-emotion': 'calm'
      }))).toThrow('MiniMax TTS request control flags require selecting minimax TTS')

      expect(() => collectTtsTargets(buildOptsFromFlags(false, {
        'deepgram-tts-speed': '1.1'
      }))).toThrow('Deepgram TTS request control flags require selecting deepgram TTS')

      expect(() => collectTtsTargets(buildOptsFromFlags(false, {
        'elevenlabs-tts-output-format': 'mp3_22050_32'
      }))).toThrow('ElevenLabs TTS request control flags require selecting elevenlabs TTS')

      expect(() => collectTtsTargets(buildOptsFromFlags(false, {
        'speechify-tts-audio-format': 'wav'
      }))).toThrow('Speechify TTS request control flags require selecting speechify TTS')

      expect(() => collectTtsTargets(buildOptsFromFlags(false, {
        'hume-tts-voice': 'Studio Voice'
      }))).toThrow('Hume TTS voice flags require selecting hume TTS')

      expect(() => collectTtsTargets(buildOptsFromFlags(false, {
        'cartesia-tts-language': 'en'
      }))).toThrow('Cartesia TTS request control flags require selecting cartesia TTS')

    })

  test('OpenAI classic models reject instructions before pricing or dispatch', () => {
    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'openai-tts': 'tts-1',
      'openai-tts-instructions': 'Warm narration'
    }))).toThrow('instructions are supported only by gpt-4o-mini-tts-2025-12-15')
  })

  test('Speechify validates model-specific languages, curated voices, and cloning', () => {
    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'speechify-tts': 'simba-3.2',
      'speechify-tts-language': 'es-ES'
    }))).toThrow('supports only en or en-*')
    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'speechify-tts': 'simba-3.2',
      'speechify-voice': 'george'
    }))).toThrow('not compatible with simba-3.2')
    expect(collectTtsTargets(buildOptsFromFlags(false, {
      'speechify-tts': 'simba-3.2',
      'speechify-voice': 'approved_clone_123'
    }))[0]?.voice).toBe('approved_clone_123')
    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'speechify-tts': 'simba-3.2',
      'speechify-tts-ref-audio': 'sample.mp3',
      'speechify-tts-consent-name': 'Owner',
      'speechify-tts-consent-email': 'owner@example.com'
    }))).toThrow('does not support immediate custom-voice creation')
    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'speechify-tts': 'simba-3.0',
      'speechify-tts-language': 'ja-JP'
    }))).toThrow('does not support language')
  })

  test('Hume and Cartesia TTS target collection preserves model and voice controls', () => {
      const targets = collectTtsTargets(buildOptsFromFlags(false, {
        'hume-tts': 'octave-2',
        'hume-tts-voice': 'Studio Voice',
        'hume-tts-voice-provider': 'CUSTOM_VOICE',
        'cartesia-tts': 'sonic-3.5-2026-05-04',
        'cartesia-tts-voice': 'cartesia-voice-id',
        'cartesia-tts-language': 'en'
      }))

      expect(targets.map((target) => ({
        service: target.service,
        model: target.model,
        voice: target.voice
      }))).toEqual([
        {
          service: 'hume',
          model: 'octave-2',
          voice: 'Studio Voice'
        },
        {
          service: 'cartesia',
          model: 'sonic-3.5-2026-05-04',
          voice: 'cartesia-voice-id'
        }
      ])
    })

  test('--all-tts expands hosted self-contained TTS models and excludes special-input modes', () => {
      const opts = buildOptsFromFlags(false, { 'all-tts': true })
      const targets = collectTtsTargets(opts)
      const services = targets.map((target) => target.service)
      const targetModelsFor = (service: string) => targets
        .filter((target) => target.service === service)
        .map((target) => target.model)
      const deepgramTargets = collectTtsTargets(opts).filter((target) => target.service === 'deepgram')
      const grokTargets = collectTtsTargets(opts).filter((target) => target.service === 'grok')
      const mistralTargets = collectTtsTargets(opts).filter((target) => target.service === 'mistral')
      const speechifyTargets = collectTtsTargets(opts).filter((target) => target.service === 'speechify')
      const humeTargets = collectTtsTargets(opts).filter((target) => target.service === 'hume')
      const cartesiaTargets = collectTtsTargets(opts).filter((target) => target.service === 'cartesia')

      expect(services).not.toContain('runway')
      expect(services).not.toContain('kitten')
      expect(opts.kittenTtsModels).toBeUndefined()
      expect(targetModelsFor('kitten')).toEqual([])
      expect(opts.elevenlabsTtsModels).toEqual([...SUPPORTED_ELEVENLABS_TTS_MODELS])
      expect(targetModelsFor('elevenlabs')).toEqual([...SUPPORTED_ELEVENLABS_TTS_MODELS])
      expect(opts.minimaxTtsModels).toEqual([...SUPPORTED_MINIMAX_TTS_MODELS])
      expect(targetModelsFor('minimax')).toEqual([...SUPPORTED_MINIMAX_TTS_MODELS])
      expect(opts.groqTtsModels).toEqual([...SUPPORTED_GROQ_TTS_MODELS])
      expect(targetModelsFor('groq')).toEqual([...SUPPORTED_GROQ_TTS_MODELS])
      expect(opts.grokTtsModels).toEqual([...SUPPORTED_GROK_TTS_MODELS])
      expect(grokTargets.map((target) => target.model)).toEqual([...SUPPORTED_GROK_TTS_MODELS])
      expect(grokTargets.map((target) => target.voice)).toEqual([undefined])
      expect(opts.mistralTtsModels).toEqual([...SUPPORTED_MISTRAL_TTS_MODELS])
      expect(mistralTargets.map((target) => target.model)).toEqual([...SUPPORTED_MISTRAL_TTS_MODELS])
      expect(mistralTargets.map((target) => target.voice)).toEqual([
        `ref_audio:${basename(MISTRAL_DEFAULT_REF_AUDIO)}`
      ])
      expect(opts.openaiTtsModels).toEqual([...SUPPORTED_OPENAI_TTS_MODELS])
      expect(targetModelsFor('openai')).toEqual([...SUPPORTED_OPENAI_TTS_MODELS])
      expect(opts.geminiTtsModels).toEqual([...SUPPORTED_GEMINI_TTS_MODELS])
      expect(targetModelsFor('gemini')).toEqual([...SUPPORTED_GEMINI_TTS_MODELS])
      expect(opts.deepgramTtsModels).toEqual([DEEPGRAM_DEFAULT_VOICE])
      expect(deepgramTargets.map((target) => target.model)).toEqual([DEEPGRAM_DEFAULT_VOICE])
      expect(opts.speechifyTtsModels).toEqual([...SUPPORTED_SPEECHIFY_TTS_MODELS])
      expect(speechifyTargets.map((target) => target.model)).toEqual([...SUPPORTED_SPEECHIFY_TTS_MODELS])
      expect(opts.humeTtsModels).toEqual([...SUPPORTED_HUME_TTS_MODELS])
      expect(humeTargets.map((target) => target.model)).toEqual([...SUPPORTED_HUME_TTS_MODELS])
      expect(opts.cartesiaTtsModels).toEqual([...SUPPORTED_CARTESIA_TTS_MODELS])
      expect(cartesiaTargets.map((target) => target.model)).toEqual([...SUPPORTED_CARTESIA_TTS_MODELS])
    })

  test('--all-local-tts expands local Kitten TTS models only', () => {
      const opts = buildOptsFromFlags(false, { 'all-local-tts': true })
      const targets = collectTtsTargets(opts)

      expect(opts.kittenTtsModels).toEqual([...SUPPORTED_KITTEN_TTS_MODELS])
      expect(targets.map((target) => target.service)).toEqual(
        SUPPORTED_KITTEN_TTS_MODELS.map(() => 'kitten')
      )
      expect(targets.map((target) => target.model)).toEqual([...SUPPORTED_KITTEN_TTS_MODELS])
      expect(opts.elevenlabsTtsModels).toBeUndefined()
      expect(opts.openaiTtsModels).toBeUndefined()
    })

  test('--all-tts rejects special-input modes that need an explicit model', () => {
      expect(() => collectTtsTargets(buildOptsFromFlags(false, {
        'all-tts': true,
        'groq-voice': REMOVED_GROQ_TTS_VOICE
      }))).toThrow(`Invalid --tts-voice groq="${REMOVED_GROQ_TTS_VOICE}"`)

      expect(() => collectTtsTargets(buildOptsFromFlags(false, {
        'all-tts': true,
        'mistral-tts': 'voxtral-mini-tts-2603',
        'tts-dialogue-format': 'labeled',
        'tts-speaker': ['Host=input/examples/audio/anthony-voice.mp3']
      }))).toThrow('does not support reference audio for multi-speaker TTS')
    })

  test('Groq TTS exposes only English Orpheus model and voices', () => {
      const englishTargets = collectTtsTargets(buildOptsFromFlags(false, {
        'groq-tts': 'canopylabs/orpheus-v1-english'
      })).filter((target) => target.service === 'groq')
      const explicitEnglishTargets = collectTtsTargets(buildOptsFromFlags(false, {
        'groq-tts': 'canopylabs/orpheus-v1-english',
        'groq-voice': 'HANNAH'
      })).filter((target) => target.service === 'groq')

      expect(getGroqDefaultTtsVoiceForModel('canopylabs/orpheus-v1-english')).toBe('troy')
      expect(englishTargets.map((target) => target.voice)).toEqual(['troy'])
      expect(explicitEnglishTargets.map((target) => target.voice)).toEqual(['hannah'])
      expect(() => collectTtsTargets(buildOptsFromFlags(false, {
        'groq-tts': REMOVED_GROQ_TTS_MODEL
      }))).toThrow(`Invalid --groq-tts model "${REMOVED_GROQ_TTS_MODEL}"`)
      expect(() => collectTtsTargets(buildOptsFromFlags(false, {
        'groq-tts': 'canopylabs/orpheus-v1-english',
        'groq-voice': REMOVED_GROQ_TTS_VOICE
      }))).toThrow(`Invalid --tts-voice groq="${REMOVED_GROQ_TTS_VOICE}"`)
    })

  test('grok tts voice validation normalizes case', () => {
      const opts = buildOptsFromFlags(false, {
        'grok-tts': ['grok-tts'],
        'grok-tts-voice': 'EVE'
      })
      const targets = collectTtsTargets(opts).filter((target) => target.service === 'grok')

      expect(opts.grokTtsVoice).toBe(GROK_DEFAULT_TTS_VOICE)
      expect(targets.map((target) => target.voice)).toEqual([GROK_DEFAULT_TTS_VOICE])
    })

  test('explicit deepgram tts flags can still select multiple voices and apply voice overrides', () => {
      const opts = buildOptsFromFlags(false, {
        'deepgram-tts': ['aura-2-thalia-en', 'aura-2-andromeda-en']
      })
      const deepgramTargets = collectTtsTargets(opts).filter((target) => target.service === 'deepgram')

      expect(opts.deepgramTtsModels).toEqual(['aura-2-thalia-en', 'aura-2-andromeda-en'])
      expect(deepgramTargets.map((target) => target.model)).toEqual(['aura-2-thalia-en', 'aura-2-andromeda-en'])

      const overrideOpts = buildOptsFromFlags(false, {
        'deepgram-tts': ['aura-2-thalia-en'],
        'deepgram-voice': 'aura-2-andromeda-en'
      })
      const overrideTargets = collectTtsTargets(overrideOpts).filter((target) => target.service === 'deepgram')

      expect(overrideOpts.deepgramVoiceId).toBe('aura-2-andromeda-en')
      expect(overrideTargets.map((target) => ({
        model: target.model,
        voice: target.voice
      }))).toEqual([{
        model: 'aura-2-thalia-en',
        voice: 'aura-2-andromeda-en'
      }])
    })
})
