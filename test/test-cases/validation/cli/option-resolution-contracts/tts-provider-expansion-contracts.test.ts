import { describe,expect,test } from 'bun:test'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import {
DEEPGRAM_DEFAULT_VOICE,
SUPPORTED_CARTESIA_TTS_MODELS,
SUPPORTED_ELEVENLABS_TTS_MODELS,
SUPPORTED_GEMINI_TTS_MODELS,
SUPPORTED_GROK_TTS_MODELS,
SUPPORTED_GROQ_TTS_MODELS,
SUPPORTED_HUME_TTS_MODELS,
SUPPORTED_MINIMAX_TTS_MODELS,
SUPPORTED_OPENAI_TTS_MODELS,
SUPPORTED_SPEECHIFY_TTS_MODELS
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'

const INVALID_GROQ_TTS_VOICE = 'not-a-groq-voice'

describe('option resolution contracts', () => {

  test('--all-tts expands hosted self-contained TTS models and excludes special-input modes', () => {
      const opts = buildOptsFromFlags({ 'all-tts': true })
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
      expect(opts.elevenlabsTtsModels).toEqual([...SUPPORTED_ELEVENLABS_TTS_MODELS])
      expect(targetModelsFor('elevenlabs')).toEqual([...SUPPORTED_ELEVENLABS_TTS_MODELS])
      expect(opts.minimaxTtsModels).toEqual([...SUPPORTED_MINIMAX_TTS_MODELS])
      expect(targetModelsFor('minimax')).toEqual([...SUPPORTED_MINIMAX_TTS_MODELS])
      expect(opts.groqTtsModels).toEqual([...SUPPORTED_GROQ_TTS_MODELS])
      expect(targetModelsFor('groq')).toEqual([...SUPPORTED_GROQ_TTS_MODELS])
      expect(opts.grokTtsModels).toEqual([...SUPPORTED_GROK_TTS_MODELS])
      expect(grokTargets.map((target) => target.model)).toEqual([...SUPPORTED_GROK_TTS_MODELS])
      expect(grokTargets.map((target) => target.voice)).toEqual([undefined])
      expect(opts.mistralTtsModels).toBeUndefined()
      expect(mistralTargets).toEqual([])
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

  test('--all-tts rejects special-input modes that need an explicit model', () => {
      expect(() => collectTtsTargets(buildOptsFromFlags({
        'all-tts': true,
        'tts-voice': `groq=${INVALID_GROQ_TTS_VOICE}`
      }))).toThrow(`Invalid --tts-voice groq="${INVALID_GROQ_TTS_VOICE}"`)

      expect(() => collectTtsTargets(buildOptsFromFlags({
        'all-tts': true,
        'mistral-tts': 'voxtral-mini-tts-2603',
        'tts-dialogue-format': 'labeled',
        'tts-speaker': ['Host=input/examples/audio/anthony-voice.mp3']
      }))).toThrow('--tts-speaker SPEAKER=path mappings cannot enter generic TTS runtime options')
    })
})
