import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/download-targets/build-opts-from-flags/build-options-from-flags'
import { buildExtractionCallOpts } from '~/cli/commands/process-steps/step-1-download/download-targets/single/document-write'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { normalizeGenericProviderSelectorFlags } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import { STANDALONE_TTS_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import {
  DEFAULT_ALL_PROVIDER_CONCURRENCY,
  DEFAULT_CLI_CONCURRENCY,
  DEFAULT_GROK_TTS_CHUNK_CONCURRENCY,
  DEFAULT_OCR_CONCURRENCY,
  DEFAULT_TTS_CHUNK_CONCURRENCY
} from '~/utils/concurrency-defaults'
import { getStep2AllShortcutModelExpansions } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import {
  validateCerebrasModel,
  validateAnthropicOcrModel,
  validateGeminiOcrModel,
  validateGrokModel,
  validateGrokOcrModel,
  validateKimiOcrModel,
  validateMistralOcrModel,
  validateMinimaxModel,
  validateOpenAIOcrModel,
  validateTogetherModel
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'

describe('option resolution contracts', () => {
  test('MiniMax write model validator accepts M3 and rejects removed predecessor names', () => {
      const removedStandard = ['MiniMax-M2', '5'].join('.')
      const removedHighspeed = `${removedStandard}-highspeed`
      const removedM27 = ['MiniMax-M2', '7'].join('.')
      const removedM27Highspeed = `${removedM27}-highspeed`
      const expectedAllowed = 'Allowed values: MiniMax-M3'

      expect(validateMinimaxModel('MiniMax-M3')).toBe('MiniMax-M3')
      expect(() => validateMinimaxModel(removedStandard)).toThrow(`Invalid --minimax model "${removedStandard}". ${expectedAllowed}`)
      expect(() => validateMinimaxModel(removedHighspeed)).toThrow(`Invalid --minimax model "${removedHighspeed}". ${expectedAllowed}`)
      expect(() => validateMinimaxModel(removedM27)).toThrow(`Invalid --minimax model "${removedM27}". ${expectedAllowed}`)
      expect(() => validateMinimaxModel(removedM27Highspeed)).toThrow(`Invalid --minimax model "${removedM27Highspeed}". ${expectedAllowed}`)
    })

  test('Cerebras write model validator accepts public selectors and rejects raw dedicated IDs', () => {
      const expectedAllowed = 'Allowed values: gpt-oss-120b, zai-glm-4.7'

      expect(validateCerebrasModel('gpt-oss-120b')).toBe('gpt-oss-120b')
      expect(validateCerebrasModel('zai-glm-4.7')).toBe('zai-glm-4.7')
      expect(() => validateCerebrasModel('kimi-k2.6')).toThrow(`Invalid --cerebras model "kimi-k2.6". ${expectedAllowed}`)
      expect(() => validateCerebrasModel('glm-5.1')).toThrow(`Invalid --cerebras model "glm-5.1". ${expectedAllowed}`)
      expect(() => validateCerebrasModel('moonshotai/Kimi-K2.6')).toThrow(`Invalid --cerebras model "moonshotai/Kimi-K2.6". ${expectedAllowed}`)
      expect(() => validateCerebrasModel('zai-org/GLM-5.1')).toThrow(`Invalid --cerebras model "zai-org/GLM-5.1". ${expectedAllowed}`)
    })

  test('Together write model validator accepts public selectors and rejects raw provider IDs', () => {
      const expectedAllowed = 'Allowed values: kimi-k2.6, glm-5.1'

      expect(validateTogetherModel('kimi-k2.6')).toBe('kimi-k2.6')
      expect(validateTogetherModel('glm-5.1')).toBe('glm-5.1')
      expect(() => validateTogetherModel('moonshotai/Kimi-K2.6')).toThrow(`Invalid --together model "moonshotai/Kimi-K2.6". ${expectedAllowed}`)
      expect(() => validateTogetherModel('zai-org/GLM-5.1')).toThrow(`Invalid --together model "zai-org/GLM-5.1". ${expectedAllowed}`)
    })

  test('Grok write model validator accepts Grok 4.5 and rejects aliases', () => {
      const expectedAllowed = 'Allowed values: grok-4.3, grok-4.5'

      expect(validateGrokModel('grok-4.3')).toBe('grok-4.3')
      expect(validateGrokModel('grok-4.5')).toBe('grok-4.5')
      expect(() => validateGrokModel('grok-4.5-latest')).toThrow(`Invalid --grok model "grok-4.5-latest". ${expectedAllowed}`)
      expect(() => validateGrokModel('grok-build-latest')).toThrow(`Invalid --grok model "grok-build-latest". ${expectedAllowed}`)
    })

  test('OCR model validators accept new priority vision selectors and reject invalid IDs', () => {
      expect(validateMistralOcrModel('mistral-ocr-4-0')).toBe('mistral-ocr-4-0')
      expect(validateMistralOcrModel('mistral-ocr-latest')).toBe('mistral-ocr-latest')
      expect(validateAnthropicOcrModel('claude-fable-5')).toBe('claude-fable-5')
      expect(validateAnthropicOcrModel('claude-sonnet-5')).toBe('claude-sonnet-5')
      expect(validateAnthropicOcrModel('claude-haiku-4-5')).toBe('claude-haiku-4-5')
      expect(validateAnthropicOcrModel('claude-opus-5')).toBe('claude-opus-5')
      expect(validateGeminiOcrModel('gemini-3.5-flash')).toBe('gemini-3.5-flash')
      expect(validateGeminiOcrModel('gemini-3.6-flash')).toBe('gemini-3.6-flash')
      expect(validateGeminiOcrModel('gemini-3.5-flash-lite')).toBe('gemini-3.5-flash-lite')
      expect(validateGrokOcrModel('grok-4.20-0309-non-reasoning')).toBe('grok-4.20-0309-non-reasoning')
      expect(validateGrokOcrModel('grok-4.5')).toBe('grok-4.5')
      expect(validateOpenAIOcrModel('gpt-5.6-sol')).toBe('gpt-5.6-sol')
      expect(validateOpenAIOcrModel('gpt-5.4-mini')).toBe('gpt-5.4-mini')
      expect(validateKimiOcrModel('kimi-k2.6')).toBe('kimi-k2.6')
      expect(validateKimiOcrModel('kimi-k3')).toBe('kimi-k3')
      const removedKimiCodeOcrModel = ['kimi-k2', '7-code'].join('.')
      const removedKimiCodeHighspeedOcrModel = `${removedKimiCodeOcrModel}-highspeed`

      expect(() => validateMistralOcrModel('mistral-ocr-2405')).toThrow('Invalid --mistral-ocr model "mistral-ocr-2405"')
      expect(() => validateAnthropicOcrModel('claude-mythos-5')).toThrow('Invalid --anthropic-ocr model "claude-mythos-5"')
      expect(() => validateOpenAIOcrModel('gpt-5.6')).toThrow('Invalid --openai-ocr model "gpt-5.6"')
      expect(() => validateGrokOcrModel('grok-4.20-0309-reasoning')).toThrow('Invalid --grok-ocr model "grok-4.20-0309-reasoning"')
      expect(() => validateKimiOcrModel(removedKimiCodeOcrModel)).toThrow(`Invalid --kimi-ocr model "${removedKimiCodeOcrModel}". Allowed values: kimi-k2.6, kimi-k3`)
      expect(() => validateKimiOcrModel(removedKimiCodeHighspeedOcrModel)).toThrow(`Invalid --kimi-ocr model "${removedKimiCodeHighspeedOcrModel}". Allowed values: kimi-k2.6, kimi-k3`)
    })

  test('OCR provider concurrency defaults, falls back, and clamps like STT concurrency flags', () => {
      const defaults = buildOptsFromFlags(false, {})
      const fallback = buildOptsFromFlags(false, {
        'ocr-provider-concurrency': 'not-a-number',
        'ocr-local-concurrency': 'nope'
      })
      const clamped = buildOptsFromFlags(false, {
        'ocr-provider-concurrency': '0',
        'ocr-local-concurrency': '-4'
      })

      expect(defaults.ocrProviderConcurrency).toBe(DEFAULT_OCR_CONCURRENCY)
      expect(defaults.ocrLocalConcurrency).toBe(DEFAULT_OCR_CONCURRENCY)
      expect(fallback.ocrProviderConcurrency).toBe(DEFAULT_OCR_CONCURRENCY)
      expect(fallback.ocrLocalConcurrency).toBe(DEFAULT_OCR_CONCURRENCY)
      expect(clamped.ocrProviderConcurrency).toBe(1)
      expect(clamped.ocrLocalConcurrency).toBe(1)
    })

  test('OCR provider concurrency ignores parser-injected shared defaults', () => {
      const parserDefaults = buildOptsFromFlags(false, {
        'provider-concurrency': String(DEFAULT_CLI_CONCURRENCY),
        'local-concurrency': String(DEFAULT_CLI_CONCURRENCY)
      })
      const explicitShared = buildOptsFromFlags(false, {
        'provider-concurrency': String(DEFAULT_CLI_CONCURRENCY),
        'local-concurrency': String(DEFAULT_CLI_CONCURRENCY)
      }, [], {}, new Set(['provider-concurrency', 'local-concurrency']))
      const configuredSpecific = buildOptsFromFlags(false, {
        'provider-concurrency': String(DEFAULT_CLI_CONCURRENCY),
        'local-concurrency': String(DEFAULT_CLI_CONCURRENCY),
        'ocr-provider-concurrency': '4',
        'ocr-local-concurrency': '2',
        __autoshowConfigInjectedFlags: ['ocr-provider-concurrency', 'ocr-local-concurrency']
      })

      expect(parserDefaults.ocrProviderConcurrency).toBe(DEFAULT_OCR_CONCURRENCY)
      expect(parserDefaults.ocrLocalConcurrency).toBe(DEFAULT_OCR_CONCURRENCY)
      expect(explicitShared.ocrProviderConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(explicitShared.ocrLocalConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(configuredSpecific.ocrProviderConcurrency).toBe(4)
      expect(configuredSpecific.ocrLocalConcurrency).toBe(2)
    })

  test('OCR page concurrency defaults to hosted auto, falls back on invalid values, and clamps to one', () => {
      const defaults = buildOptsFromFlags(false, {})
      const fallback = buildOptsFromFlags(false, {
        'ocr-concurrency': 'not-a-number'
      })
      const clamped = buildOptsFromFlags(false, {
        'ocr-concurrency': '0'
      })
      const explicit = buildOptsFromFlags(false, {
        'ocr-concurrency': '4'
      })
      const configured = buildOptsFromFlags(false, {
        'ocr-concurrency': '6',
        __autoshowConfigInjectedFlags: ['ocr-concurrency']
      })

      expect(defaults.ocrConcurrency).toBeUndefined()
      expect(defaults.ocrConcurrencyMode).toBe('auto')
      expect(buildExtractionCallOpts('input.pdf', '/tmp/autoshow-output', defaults).ocrConcurrency).toBeUndefined()
      expect(buildExtractionCallOpts('input.pdf', '/tmp/autoshow-output', defaults).ocrConcurrencyMode).toBe('auto')
      expect(fallback.ocrConcurrency).toBe(DEFAULT_OCR_CONCURRENCY)
      expect(fallback.ocrConcurrencyMode).toBe('fixed')
      expect(buildExtractionCallOpts('input.pdf', '/tmp/autoshow-output', fallback).ocrConcurrency).toBe(DEFAULT_OCR_CONCURRENCY)
      expect(buildExtractionCallOpts('input.pdf', '/tmp/autoshow-output', fallback).ocrConcurrencyMode).toBe('fixed')
      expect(clamped.ocrConcurrency).toBe(1)
      expect(clamped.ocrConcurrencyMode).toBe('fixed')
      expect(buildExtractionCallOpts('input.pdf', '/tmp/autoshow-output', clamped).ocrConcurrency).toBe(1)
      expect(explicit.ocrConcurrency).toBe(4)
      expect(explicit.ocrConcurrencyMode).toBe('fixed')
      expect(buildExtractionCallOpts('input.pdf', '/tmp/autoshow-output', explicit).ocrConcurrency).toBe(4)
      expect(configured.ocrConcurrency).toBe(6)
      expect(configured.ocrConcurrencyMode).toBe('fixed')
    })

  test('OCR page input retention flag flows to extraction options', () => {
      const defaults = buildOptsFromFlags(false, {})
      const keepInputs = buildOptsFromFlags(false, {
        'keep-ocr-page-inputs': true
      })

      expect(defaults.keepOcrPageInputs).toBe(false)
      expect(buildExtractionCallOpts('input.pdf', '/tmp/autoshow-output', defaults).keepOcrPageInputs).toBe(false)
      expect(keepInputs.keepOcrPageInputs).toBe(true)
      expect(buildExtractionCallOpts('input.pdf', '/tmp/autoshow-output', keepInputs).keepOcrPageInputs).toBe(true)
    })

  test('LLM provider concurrency defaults, falls back, and clamps like STT/OCR concurrency flags', () => {
      const defaults = buildOptsFromFlags(false, {})
      const fallback = buildOptsFromFlags(false, {
        'llm-provider-concurrency': 'not-a-number',
        'llm-local-concurrency': 'nope'
      })
      const clamped = buildOptsFromFlags(false, {
        'llm-provider-concurrency': '0',
        'llm-local-concurrency': '-4'
      })

      expect(defaults.llmProviderConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(defaults.llmLocalConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(fallback.llmProviderConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(fallback.llmLocalConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(clamped.llmProviderConcurrency).toBe(1)
      expect(clamped.llmLocalConcurrency).toBe(1)
    })

  test('generation provider concurrency defaults, falls back, and clamps like other provider concurrency flags', () => {
      const defaults = buildOptsFromFlags(false, {})
      const fallback = buildOptsFromFlags(false, {
        'tts-provider-concurrency': 'not-a-number',
        'tts-local-concurrency': 'nope',
        'tts-chunk-concurrency': 'bad',
        'image-provider-concurrency': 'bad',
        'image-local-concurrency': 'bad',
        'video-provider-concurrency': 'bad',
        'video-local-concurrency': 'bad',
        'music-provider-concurrency': 'bad',
        'music-local-concurrency': 'bad'
      })
      const clamped = buildOptsFromFlags(false, {
        'tts-provider-concurrency': '0',
        'tts-local-concurrency': '-1',
        'tts-chunk-concurrency': '0',
        'image-provider-concurrency': '0',
        'image-local-concurrency': '-1',
        'video-provider-concurrency': '0',
        'video-local-concurrency': '-1',
        'music-provider-concurrency': '0',
        'music-local-concurrency': '-1'
      })

      expect(defaults.ttsProviderConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(defaults.ttsLocalConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(defaults.ttsChunkConcurrency).toBe(DEFAULT_TTS_CHUNK_CONCURRENCY)
      expect(defaults.imageProviderConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(defaults.imageLocalConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(defaults.videoProviderConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(defaults.videoLocalConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(defaults.musicProviderConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(defaults.musicLocalConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(fallback.ttsProviderConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(fallback.ttsChunkConcurrency).toBe(DEFAULT_TTS_CHUNK_CONCURRENCY)
      expect(fallback.imageProviderConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(fallback.videoProviderConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(fallback.musicProviderConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(clamped.ttsProviderConcurrency).toBe(1)
      expect(clamped.ttsLocalConcurrency).toBe(1)
      expect(clamped.ttsChunkConcurrency).toBe(1)
      expect(clamped.imageProviderConcurrency).toBe(1)
      expect(clamped.imageLocalConcurrency).toBe(1)
      expect(clamped.videoProviderConcurrency).toBe(1)
      expect(clamped.videoLocalConcurrency).toBe(1)
      expect(clamped.musicProviderConcurrency).toBe(1)
      expect(clamped.musicLocalConcurrency).toBe(1)

      const explicit = buildOptsFromFlags(false, {
        'tts-chunk-concurrency': '3'
      })
      expect(explicit.ttsChunkConcurrency).toBe(3)
    })

  test('Grok-only hosted TTS gets a higher implicit chunk concurrency default', () => {
      const grokOnly = buildOptsFromFlags(false, {
        'grok-tts': 'grok-tts'
      })
      const parserDefaultInjected = buildOptsFromFlags(false, {
        'grok-tts': 'grok-tts',
        'tts-chunk-concurrency': String(DEFAULT_TTS_CHUNK_CONCURRENCY)
      })
      const normalizedGrokProvider = normalizeGenericProviderSelectorFlags({
        provider: 'grok',
        'tts-chunk-concurrency': String(DEFAULT_TTS_CHUNK_CONCURRENCY)
      }, new Set(['provider']), 'provider', STANDALONE_TTS_PROVIDER_TARGETS, {
        allProvidersTarget: 'all-tts',
        allLocalTarget: 'all-local-tts'
      })
      const genericProviderGrok = buildOptsFromFlags(
        false,
        normalizedGrokProvider.flags,
        [],
        { defaultTtsEngine: 'kitten' },
        normalizedGrokProvider.explicitFlags
      )
      const explicitThirty = buildOptsFromFlags(false, {
        'grok-tts': 'grok-tts',
        'tts-chunk-concurrency': String(DEFAULT_TTS_CHUNK_CONCURRENCY)
      }, [], {}, new Set(['tts-chunk-concurrency']))
      const configuredThirty = buildOptsFromFlags(false, {
        'grok-tts': 'grok-tts',
        'tts-chunk-concurrency': String(DEFAULT_TTS_CHUNK_CONCURRENCY),
        __autoshowConfigInjectedFlags: ['tts-chunk-concurrency']
      })
      const configuredCustom = buildOptsFromFlags(false, {
        'grok-tts': 'grok-tts',
        'tts-chunk-concurrency': '44',
        __autoshowConfigInjectedFlags: ['tts-chunk-concurrency']
      })
      const openaiOnly = buildOptsFromFlags(false, {
        'openai-tts': 'gpt-4o-mini-tts-2025-12-15'
      })
      const grokAndOpenai = buildOptsFromFlags(false, {
        'grok-tts': 'grok-tts',
        'openai-tts': 'gpt-4o-mini-tts-2025-12-15'
      })
      const allTts = buildOptsFromFlags(false, { 'all-tts': true })

      expect(grokOnly.ttsChunkConcurrency).toBe(DEFAULT_GROK_TTS_CHUNK_CONCURRENCY)
      expect(parserDefaultInjected.ttsChunkConcurrency).toBe(DEFAULT_GROK_TTS_CHUNK_CONCURRENCY)
      expect(genericProviderGrok.ttsChunkConcurrency).toBe(DEFAULT_GROK_TTS_CHUNK_CONCURRENCY)
      expect(explicitThirty.ttsChunkConcurrency).toBe(DEFAULT_TTS_CHUNK_CONCURRENCY)
      expect(configuredThirty.ttsChunkConcurrency).toBe(DEFAULT_TTS_CHUNK_CONCURRENCY)
      expect(configuredCustom.ttsChunkConcurrency).toBe(44)
      expect(openaiOnly.ttsChunkConcurrency).toBe(DEFAULT_TTS_CHUNK_CONCURRENCY)
      expect(grokAndOpenai.ttsChunkConcurrency).toBe(DEFAULT_TTS_CHUNK_CONCURRENCY)
      expect(allTts.ttsChunkConcurrency).toBe(DEFAULT_TTS_CHUNK_CONCURRENCY)
    })

  test('bare provider flags resolve to their default models', () => {
      const openaiDefault = resolveCheapestModelForFlag('openai')
      const grokDefault = resolveCheapestModelForFlag('grok')
      const glmDefault = resolveCheapestModelForFlag('glm')
      const kimiDefault = resolveCheapestModelForFlag('kimi')
      const togetherDefault = resolveCheapestModelForFlag('together')
      const cerebrasDefault = resolveCheapestModelForFlag('cerebras')
      const deepgramDefault = resolveCheapestModelForFlag('deepgram-stt')
      const assemblyaiDefault = resolveCheapestModelForFlag('assemblyai-stt')
      const gladiaDefault = resolveCheapestModelForFlag('gladia-stt')
      const geminiSttDefault = resolveCheapestModelForFlag('gemini-stt')
      const sonioxDefault = resolveCheapestModelForFlag('soniox-stt')
      const speechmaticsDefault = resolveCheapestModelForFlag('speechmatics-stt')
      const togetherSttDefault = resolveCheapestModelForFlag('together-stt')
      const scrapeCreatorsDefault = resolveCheapestModelForFlag('scrapecreators-stt')
      const openaiOcrDefault = resolveCheapestModelForFlag('openai-ocr')
      const grokOcrDefault = resolveCheapestModelForFlag('grok-ocr')
      const deepinfraOcrDefault = resolveCheapestModelForFlag('deepinfra-ocr')
      const kimiOcrDefault = resolveCheapestModelForFlag('kimi-ocr')
      const speechifyTtsDefault = resolveCheapestModelForFlag('speechify-tts')
      const elevenlabsTtsDefault = resolveCheapestModelForFlag('elevenlabs-tts')
      const groqTtsDefault = resolveCheapestModelForFlag('groq-tts')
      const openaiTtsDefault = resolveCheapestModelForFlag('openai-tts')
      const deepgramTtsDefault = resolveCheapestModelForFlag('deepgram-tts')
      const humeTtsDefault = resolveCheapestModelForFlag('hume-tts')
      const cartesiaTtsDefault = resolveCheapestModelForFlag('cartesia-tts')
      const opts = buildOptsFromFlags(false, {
        openai: true,
        grok: true,
        glm: true,
        kimi: true,
        together: true,
        cerebras: true,
        'deepgram-stt': true,
        'assemblyai-stt': true,
        'gladia-stt': true,
        'gemini-stt': true,
        'soniox-stt': true,
        'speechmatics-stt': true,
        'scrapecreators-stt': true,
        'openai-ocr': true,
        'grok-ocr': true,
        'deepinfra-ocr': true,
        'kimi-ocr': true,
        'speechify-tts': true,
        'elevenlabs-tts': true,
        'groq-tts': true,
        'openai-tts': true,
        'deepgram-tts': true,
        'hume-tts': true,
        'cartesia-tts': true
      })

      expect(openaiDefault).toBeDefined()
      expect(grokDefault).toBe('grok-4.3')
      expect(glmDefault).toBeDefined()
      expect(kimiDefault).toBe('kimi-k2.6')
      expect(togetherDefault).toBe('glm-5.1')
      expect(cerebrasDefault).toBe('gpt-oss-120b')
      expect(deepgramDefault).toBeDefined()
      expect(assemblyaiDefault).toBe('universal-2')
      expect(gladiaDefault).toBe('solaria-1')
      expect(geminiSttDefault).toBe('gemini-3.6-flash')
      expect(sonioxDefault).toBe('stt-async-v5')
      expect(speechmaticsDefault).toBe('melia-1')
      expect(togetherSttDefault).toBe('nvidia/parakeet-tdt-0.6b-v3')
      expect(scrapeCreatorsDefault).toBe('youtube-transcript')
      expect(openaiOcrDefault).toBe('gpt-5.4-nano')
      expect(grokOcrDefault).toBe('grok-4.3')
      expect(deepinfraOcrDefault).toBe('Qwen/Qwen3-VL-30B-A3B-Instruct')
      expect(kimiOcrDefault).toBe('kimi-k2.6')
      expect(speechifyTtsDefault).toBe('simba-3.2')
      expect(elevenlabsTtsDefault).toBe('eleven_v3')
      expect(groqTtsDefault).toBe('canopylabs/orpheus-v1-english')
      expect(openaiTtsDefault).toBe('gpt-4o-mini-tts-2025-12-15')
      expect(deepgramTtsDefault).toBe('aura-2-thalia-en')
      expect(humeTtsDefault).toBe('octave-2')
      expect(cartesiaTtsDefault).toBe('sonic-3.5-2026-05-04')
      expect(opts.openaiModel).toBe(openaiDefault)
      expect(opts.grokModel).toBe(grokDefault)
      expect(opts.glmModel).toBe(glmDefault)
      expect(opts.kimiModel).toBe(kimiDefault)
      expect(opts.togetherModel).toBe(togetherDefault)
      expect(opts.cerebrasModel).toBe(cerebrasDefault)
      expect(opts.deepgramSttModel).toBe(deepgramDefault)
      expect(opts.assemblyaiSttModel).toBe(assemblyaiDefault)
      expect(opts.gladiaSttModel).toBe(gladiaDefault)
      expect(opts.geminiSttModel).toBe(geminiSttDefault)
      expect(opts.sonioxSttModel).toBe(sonioxDefault)
      expect(opts.speechmaticsSttModel).toBe(speechmaticsDefault)
      expect(opts.scrapecreatorsSttModel).toBe(scrapeCreatorsDefault)
      expect(opts.openaiOcrModel).toBe(openaiOcrDefault)
      expect(opts.grokOcrModel).toBe(grokOcrDefault)
      expect(opts.deepinfraOcrModel).toBe(deepinfraOcrDefault)
      expect(opts.kimiOcrModel).toBe(kimiOcrDefault)
      expect(opts.speechifyTtsModel).toBe(speechifyTtsDefault)
      expect(opts.elevenlabsTtsModel).toBe(elevenlabsTtsDefault)
      expect(opts.groqTtsModel).toBe(groqTtsDefault)
      expect(opts.openaiTtsModel).toBe(openaiTtsDefault)
      expect(opts.deepgramTtsModel).toBe(deepgramTtsDefault)
      expect(opts.humeTtsModel).toBe(humeTtsDefault)
      expect(opts.cartesiaTtsModel).toBe(cartesiaTtsDefault)
    })

  test('--all-llm expands OpenAI, Anthropic, Grok, GLM, Kimi, Together, and Cerebras to their supported models', () => {
      const opts = buildOptsFromFlags(false, { 'all-llm': true })
      const localOpts = buildOptsFromFlags(false, { 'all-local-llm': true })

      expect(opts.llamaModels).toBeUndefined()
      expect(opts.openaiModels).toEqual(['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4-mini', 'gpt-5.4-nano'])
      expect(opts.openaiModels).not.toContain('gpt-5.6')
      expect(opts.anthropicModels).toEqual(['claude-fable-5', 'claude-opus-4-8', 'claude-sonnet-5', 'claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-opus-5'])
      expect(opts.anthropicModels).not.toContain('claude-mythos-5')
      expect(opts.geminiModels).toEqual(['gemini-3.1-pro-preview', 'gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'])
      expect(opts.geminiModels).not.toContain('gemini-3-flash-preview')
      expect(opts.grokModels).toEqual(['grok-4.3', 'grok-4.5'])
      expect(opts.glmModels).toEqual(['glm-5.1'])
      expect(opts.kimiModels).toEqual(['kimi-k2.6', 'kimi-k3'])
      expect(opts.togetherModels).toEqual(['kimi-k2.6', 'glm-5.1'])
      expect(opts.cerebrasModels).toEqual(['gpt-oss-120b', 'zai-glm-4.7'])
      expect(localOpts.llamaModels).toBeDefined()
      expect(localOpts.openaiModels).toBeUndefined()
    })

  test('--all shortcuts use aggressive hosted concurrency only when concurrency is not explicit', () => {
      const ocrOpts = buildOptsFromFlags(false, { 'all-ocr': true })
      const llmOpts = buildOptsFromFlags(false, { 'all-llm': true })
      const ttsOpts = buildOptsFromFlags(false, { 'all-tts': true })
      const imageOpts = buildOptsFromFlags(false, { 'all-image': true })
      const videoOpts = buildOptsFromFlags(false, { 'all-video': true })
      const musicOpts = buildOptsFromFlags(false, { 'all-music': true })
      const explicitVideoOpts = buildOptsFromFlags(false, {
        'all-video': true,
        'video-provider-concurrency': '3'
      }, [], {}, new Set(['video-provider-concurrency']))

      expect(ocrOpts.ocrProviderConcurrency).toBe(DEFAULT_OCR_CONCURRENCY)
      expect(llmOpts.llmProviderConcurrency).toBe(DEFAULT_ALL_PROVIDER_CONCURRENCY)
      expect(ttsOpts.ttsProviderConcurrency).toBe(DEFAULT_ALL_PROVIDER_CONCURRENCY)
      expect(imageOpts.imageProviderConcurrency).toBe(DEFAULT_ALL_PROVIDER_CONCURRENCY)
      expect(videoOpts.videoProviderConcurrency).toBe(DEFAULT_ALL_PROVIDER_CONCURRENCY)
      expect(musicOpts.musicProviderConcurrency).toBe(DEFAULT_ALL_PROVIDER_CONCURRENCY)
      expect(explicitVideoOpts.videoProviderConcurrency).toBe(3)
      expect(ocrOpts.ocrLocalConcurrency).toBe(DEFAULT_OCR_CONCURRENCY)
      expect(ttsOpts.ttsLocalConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
    })

  test('--all-stt/--all-ocr expand hosted providers and local shortcuts expand local engines', () => {
      const expansions = getStep2AllShortcutModelExpansions()
      const sttOpts = buildOptsFromFlags(false, { 'all-stt': true })
      const ocrOpts = buildOptsFromFlags(false, { 'all-ocr': true })
      const localSttOpts = buildOptsFromFlags(false, { 'all-local-stt': true })
      const localOcrOpts = buildOptsFromFlags(false, { 'all-local-ocr': true })

      expect(expansions['deepgram-stt']?.shortcut).toBe('all-stt')
      expect(expansions['deepgram-stt']?.supported).toEqual(['nova-3'])
      expect(expansions['grok-stt']?.shortcut).toBe('all-stt')
      expect(expansions['mistral-stt']?.shortcut).toBe('all-stt')
      expect(expansions['assemblyai-stt']?.supported).toEqual(['universal-3-5-pro', 'universal-2'])
      expect(expansions['gladia-stt']?.supported).toEqual(['solaria-1', 'solaria-3'])
      expect(expansions['gemini-stt']?.supported).toEqual(['gemini-3.6-flash'])
      expect(expansions['soniox-stt']?.supported).toEqual(['stt-async-v5'])
      expect(expansions['speechmatics-stt']?.supported).toEqual(['enhanced', 'melia-1'])
      expect(expansions['together-stt']?.supported).toEqual(['openai/whisper-large-v3', 'nvidia/parakeet-tdt-0.6b-v3'])
      expect(expansions['whisper-stt']?.shortcut).toBe('all-local-stt')
      expect(expansions['scrapecreators-stt']).toBeUndefined()
      expect(expansions['openai-ocr']?.shortcut).toBe('all-ocr')
      expect(expansions['grok-ocr']?.shortcut).toBe('all-ocr')
      expect(expansions['kimi-ocr']?.shortcut).toBe('all-ocr')
      expect(expansions['deepinfra-ocr']?.shortcut).toBe('all-ocr')
      expect(ocrOpts.mistralOcrModels).toEqual(['mistral-ocr-2512', 'mistral-ocr-4-0', 'mistral-ocr-latest'])
      expect(ocrOpts.openaiOcrModels).toEqual(['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4-mini', 'gpt-5.4-nano'])
      expect(ocrOpts.openaiOcrModels).not.toContain('gpt-5.6')
      expect(ocrOpts.grokOcrModels).toEqual(['grok-4.3', 'grok-4.20-0309-non-reasoning', 'grok-4.5'])
      expect(ocrOpts.kimiOcrModels).toEqual(['kimi-k2.6', 'kimi-k3'])
      expect(ocrOpts.anthropicOcrModels).toEqual(['claude-fable-5', 'claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5', 'claude-opus-5'])
      expect(ocrOpts.anthropicOcrModels).not.toContain('claude-mythos-5')
      expect(ocrOpts.geminiOcrModels).toEqual(['gemini-3.1-pro-preview', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'])
      expect(ocrOpts.deepinfraOcrModels).toEqual(['Qwen/Qwen3-VL-235B-A22B-Instruct', 'Qwen/Qwen3-VL-30B-A3B-Instruct'])
      expect(collectSttTargets(sttOpts).map((target) => target.service)).toContain('deepgram')
      expect(collectSttTargets(sttOpts).map((target) => target.service)).toContain('grok')
      expect(collectSttTargets(sttOpts).map((target) => target.service)).toContain('mistral')
      expect(collectSttTargets(sttOpts).map((target) => target.service)).not.toContain('scrapecreators')
      expect(collectSttTargets(sttOpts).map((target) => target.service)).not.toContain('whisper')
      expect(collectSttTargets(sttOpts).map((target) => target.service)).not.toContain('reverb')
      const ocrTargets = collectExplicitOcrTargets(ocrOpts)
      expect(ocrTargets.map((target) => target.service)).not.toContain('tesseract')
      expect(ocrTargets.map((target) => target.service)).toContain('openai')
      expect(ocrTargets.map((target) => target.service)).toContain('grok')
      expect(ocrTargets.map((target) => target.service)).toContain('kimi')
      expect(ocrTargets.map((target) => target.service)).toContain('deepinfra')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('openai:gpt-5.5')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('openai:gpt-5.6-sol')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).not.toContain('openai:gpt-5.6')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('grok:grok-4.3')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('grok:grok-4.20-0309-non-reasoning')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('grok:grok-4.5')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('anthropic:claude-fable-5')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('anthropic:claude-opus-4-8')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('anthropic:claude-sonnet-5')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('anthropic:claude-haiku-4-5')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('anthropic:claude-opus-5')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('gemini:gemini-3.6-flash')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('gemini:gemini-3.5-flash-lite')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('kimi:kimi-k3')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).not.toContain('anthropic:claude-sonnet-4-6')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).not.toContain('anthropic:claude-mythos-5')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).not.toContain('deepinfra:PaddlePaddle/PaddleOCR-VL-0.9B')
      expect(collectSttTargets(localSttOpts).map((target) => target.service)).toContain('reverb')
      expect(collectSttTargets(localSttOpts).map((target) => target.service)).toContain('whisper')
      expect(collectExplicitOcrTargets(localOcrOpts).map((target) => target.service)).toEqual([
        'tesseract'
      ])
    })

  test('priority OCR model additions are available without changing provider defaults', () => {
      const openaiWriteOpts = buildOptsFromFlags(false, { openai: 'gpt-5.4-mini' })
      const openaiSolWriteOpts = buildOptsFromFlags(false, { openai: 'gpt-5.6-sol' })
      const openaiGpt55WriteOpts = buildOptsFromFlags(false, { openai: 'gpt-5.5' })
      const mistralOcr4Opts = buildOptsFromFlags(false, { 'mistral-ocr': 'mistral-ocr-4-0' })
      const mistralLatestOcrOpts = buildOptsFromFlags(false, { 'mistral-ocr': 'mistral-ocr-latest' })
      const openaiSolOcrOpts = buildOptsFromFlags(false, { 'openai-ocr': 'gpt-5.6-sol' })
      const openaiOcrOpts = buildOptsFromFlags(false, { 'openai-ocr': 'gpt-5.4-nano' })
      const openaiMiniOcrOpts = buildOptsFromFlags(false, { 'openai-ocr': 'gpt-5.4-mini' })
      const openaiGpt55OcrOpts = buildOptsFromFlags(false, { 'openai-ocr': 'gpt-5.5' })
      const grokWriteOpts = buildOptsFromFlags(false, { grok: 'grok-4.3' })
      const grokOcrOpts = buildOptsFromFlags(false, { 'grok-ocr': 'grok-4.3' })
      const grok420OcrOpts = buildOptsFromFlags(false, { 'grok-ocr': 'grok-4.20-0309-non-reasoning' })
      const grok45OcrOpts = buildOptsFromFlags(false, { 'grok-ocr': 'grok-4.5' })
      const gemini35OcrOpts = buildOptsFromFlags(false, { 'gemini-ocr': 'gemini-3.5-flash' })
      const writeOpts = buildOptsFromFlags(false, { anthropic: 'claude-sonnet-4-6' })
      const anthropicFableWriteOpts = buildOptsFromFlags(false, { anthropic: 'claude-fable-5' })
      const anthropicSonnet5WriteOpts = buildOptsFromFlags(false, { anthropic: 'claude-sonnet-5' })
      const anthropicFableOcrOpts = buildOptsFromFlags(false, { 'anthropic-ocr': 'claude-fable-5' })
      const anthropicOpusOcrOpts = buildOptsFromFlags(false, { 'anthropic-ocr': 'claude-opus-4-8' })
      const anthropicSonnet5OcrOpts = buildOptsFromFlags(false, { 'anthropic-ocr': 'claude-sonnet-5' })
      const anthropicHaikuOcrOpts = buildOptsFromFlags(false, { 'anthropic-ocr': 'claude-haiku-4-5' })

      expect(openaiWriteOpts.openaiModel).toBe('gpt-5.4-mini')
      expect(openaiSolWriteOpts.openaiModel).toBe('gpt-5.6-sol')
      expect(openaiGpt55WriteOpts.openaiModel).toBe('gpt-5.5')
      expect(mistralOcr4Opts.mistralOcrModel).toBe('mistral-ocr-4-0')
      expect(mistralLatestOcrOpts.mistralOcrModel).toBe('mistral-ocr-latest')
      expect(openaiSolOcrOpts.openaiOcrModel).toBe('gpt-5.6-sol')
      expect(openaiOcrOpts.openaiOcrModel).toBe('gpt-5.4-nano')
      expect(openaiOcrOpts.openaiOcrModels).toEqual(['gpt-5.4-nano'])
      expect(openaiMiniOcrOpts.openaiOcrModel).toBe('gpt-5.4-mini')
      expect(openaiGpt55OcrOpts.openaiOcrModel).toBe('gpt-5.5')
      expect(grokWriteOpts.grokModel).toBe('grok-4.3')
      expect(grokOcrOpts.grokOcrModel).toBe('grok-4.3')
      expect(grokOcrOpts.grokOcrModels).toEqual(['grok-4.3'])
      expect(grok420OcrOpts.grokOcrModel).toBe('grok-4.20-0309-non-reasoning')
      expect(grok45OcrOpts.grokOcrModel).toBe('grok-4.5')
      expect(gemini35OcrOpts.geminiOcrModel).toBe('gemini-3.5-flash')
      expect(writeOpts.anthropicModel).toBe('claude-sonnet-4-6')
      expect(anthropicFableWriteOpts.anthropicModel).toBe('claude-fable-5')
      expect(anthropicSonnet5WriteOpts.anthropicModel).toBe('claude-sonnet-5')
      expect(anthropicFableOcrOpts.anthropicOcrModel).toBe('claude-fable-5')
      expect(anthropicOpusOcrOpts.anthropicOcrModel).toBe('claude-opus-4-8')
      expect(anthropicOpusOcrOpts.anthropicOcrModels).toEqual(['claude-opus-4-8'])
      expect(anthropicSonnet5OcrOpts.anthropicOcrModel).toBe('claude-sonnet-5')
      expect(anthropicHaikuOcrOpts.anthropicOcrModel).toBe('claude-haiku-4-5')
      expect(() => buildOptsFromFlags(false, { 'anthropic-ocr': 'claude-sonnet-4-6' })).toThrow()
      expect(() => buildOptsFromFlags(false, { openai: 'gpt-5.6' })).toThrow()
      expect(() => buildOptsFromFlags(false, { anthropic: 'claude-mythos-5' })).toThrow()
    })
})
