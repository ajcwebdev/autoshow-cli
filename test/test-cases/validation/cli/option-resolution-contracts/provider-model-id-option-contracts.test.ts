import { describe,expect,test } from 'bun:test'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import {
validateAnthropicOcrModel,
validateCerebrasModel,
validateGeminiOcrModel,
validateGrokModel,
validateGrokOcrModel,
validateKimiOcrModel,
validateMinimaxModel,
validateMistralOcrModel,
validateOpenAIOcrModel,
validateTogetherModel
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'

describe('option resolution contracts', () => {

  test('MiniMax write model validator accepts M3', () => {
      expect(validateMinimaxModel('MiniMax-M3')).toBe('MiniMax-M3')
    })

  test('Cerebras write model validator accepts public selectors and rejects raw dedicated IDs', () => {
      const expectedAllowed = 'Allowed values: gpt-oss-120b, zai-glm-4.7'

      expect(validateCerebrasModel('gpt-oss-120b')).toBe('gpt-oss-120b')
      expect(validateCerebrasModel('zai-glm-4.7')).toBe('zai-glm-4.7')
      expect(() => validateCerebrasModel('kimi-k2.6')).toThrow(`Invalid model "kimi-k2.6" for --llm cerebras[=model]. ${expectedAllowed}`)
      expect(() => validateCerebrasModel('glm-5.1')).toThrow(`Invalid model "glm-5.1" for --llm cerebras[=model]. ${expectedAllowed}`)
      expect(() => validateCerebrasModel('moonshotai/Kimi-K2.6')).toThrow(`Invalid model "moonshotai/Kimi-K2.6" for --llm cerebras[=model]. ${expectedAllowed}`)
      expect(() => validateCerebrasModel('zai-org/GLM-5.1')).toThrow(`Invalid model "zai-org/GLM-5.1" for --llm cerebras[=model]. ${expectedAllowed}`)
    })

  test('Together write model validator accepts public selectors and rejects raw provider IDs', () => {
      const expectedAllowed = 'Allowed values: kimi-k2.6, glm-5.1'

      expect(validateTogetherModel('kimi-k2.6')).toBe('kimi-k2.6')
      expect(validateTogetherModel('glm-5.1')).toBe('glm-5.1')
      expect(() => validateTogetherModel('moonshotai/Kimi-K2.6')).toThrow(`Invalid model "moonshotai/Kimi-K2.6" for --llm together[=model]. ${expectedAllowed}`)
      expect(() => validateTogetherModel('zai-org/GLM-5.1')).toThrow(`Invalid model "zai-org/GLM-5.1" for --llm together[=model]. ${expectedAllowed}`)
    })

  test('Grok write model validator accepts Grok 4.5 and 4.6 and rejects aliases', () => {
      const expectedAllowed = 'Allowed values: grok-4.3, grok-4.5, grok-4.6'

      expect(validateGrokModel('grok-4.3')).toBe('grok-4.3')
      expect(validateGrokModel('grok-4.5')).toBe('grok-4.5')
      expect(validateGrokModel('grok-4.6')).toBe('grok-4.6')
      expect(() => validateGrokModel('grok-4.5-latest')).toThrow(`Invalid model "grok-4.5-latest" for --llm grok[=model]. ${expectedAllowed}`)
      expect(() => validateGrokModel('grok-build-latest')).toThrow(`Invalid model "grok-build-latest" for --llm grok[=model]. ${expectedAllowed}`)
    })

  test('OCR model validators accept new priority vision selectors and reject invalid IDs', () => {
      expect(validateMistralOcrModel('mistral-ocr-4-0')).toBe('mistral-ocr-4-0')
      expect(validateAnthropicOcrModel('claude-fable-5')).toBe('claude-fable-5')
      expect(validateAnthropicOcrModel('claude-sonnet-5')).toBe('claude-sonnet-5')
      expect(validateAnthropicOcrModel('claude-sonnet-4-6')).toBe('claude-sonnet-4-6')
      expect(validateAnthropicOcrModel('claude-haiku-4-5')).toBe('claude-haiku-4-5')
      expect(validateAnthropicOcrModel('claude-opus-5')).toBe('claude-opus-5')
      expect(validateGeminiOcrModel('gemini-3.7-flash')).toBe('gemini-3.7-flash')
      expect(validateGeminiOcrModel('gemini-3.5-flash')).toBe('gemini-3.5-flash')
      expect(validateGeminiOcrModel('gemini-3.6-flash')).toBe('gemini-3.6-flash')
      expect(validateGeminiOcrModel('gemini-3.5-flash-lite')).toBe('gemini-3.5-flash-lite')
      expect(validateGrokOcrModel('grok-4.20-0309-non-reasoning')).toBe('grok-4.20-0309-non-reasoning')
      expect(validateGrokOcrModel('grok-4.5')).toBe('grok-4.5')
      expect(validateGrokOcrModel('grok-4.6')).toBe('grok-4.6')
      expect(validateOpenAIOcrModel('gpt-5.6-sol')).toBe('gpt-5.6-sol')
      expect(validateOpenAIOcrModel('gpt-5.4-mini')).toBe('gpt-5.4-mini')
      expect(validateKimiOcrModel('kimi-k2.6')).toBe('kimi-k2.6')
      expect(validateKimiOcrModel('kimi-k3')).toBe('kimi-k3')

      expect(() => validateMistralOcrModel('mistral-ocr-2405')).toThrow('Invalid model "mistral-ocr-2405" for --provider/--ocr mistral[=model]')
      expect(() => validateMistralOcrModel('mistral-ocr-latest')).toThrow('Invalid model "mistral-ocr-latest" for --provider/--ocr mistral[=model]. Allowed values: mistral-ocr-2512, mistral-ocr-4-0')
      expect(() => validateAnthropicOcrModel('claude-mythos-5')).toThrow('Invalid model "claude-mythos-5" for --provider/--ocr anthropic[=model]')
      expect(() => validateOpenAIOcrModel('gpt-5.6')).toThrow('Invalid model "gpt-5.6" for --provider/--ocr openai[=model]')
      expect(() => validateGrokOcrModel('grok-4.20-0309-reasoning')).toThrow('Invalid model "grok-4.20-0309-reasoning" for --provider/--ocr grok[=model]')
    })

  test('bare provider flags resolve to their default models', () => {
      const openaiDefault = resolveCheapestModelForFlag('openai')
      const geminiDefault = resolveCheapestModelForFlag('gemini')
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
      const geminiOcrDefault = resolveCheapestModelForFlag('gemini-ocr')
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
      const opts = buildOptsFromFlags({
        openai: true,
        gemini: true,
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
        'gemini-ocr': true,
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
      expect(geminiDefault).toBe('gemini-3.5-flash-lite')
      expect(grokDefault).toBe('grok-4.3')
      expect(glmDefault).toBeDefined()
      expect(kimiDefault).toBe('kimi-k2.6')
      expect(togetherDefault).toBe('glm-5.1')
      expect(cerebrasDefault).toBe('gpt-oss-120b')
      expect(deepgramDefault).toBeDefined()
      expect(assemblyaiDefault).toBe('universal-3-5-pro')
      expect(gladiaDefault).toBe('solaria-3')
      expect(geminiSttDefault).toBe('gemini-3.6-flash')
      expect(sonioxDefault).toBe('stt-async-v5')
      expect(speechmaticsDefault).toBe('melia-1')
      expect(togetherSttDefault).toBe('nvidia/parakeet-tdt-0.6b-v3')
      expect(scrapeCreatorsDefault).toBe('youtube-transcript')
      expect(openaiOcrDefault).toBe('gpt-5.6-luna')
      expect(geminiOcrDefault).toBe('gemini-3.5-flash-lite')
      expect(grokOcrDefault).toBe('grok-4.3')
      expect(deepinfraOcrDefault).toBe('Qwen/Qwen3-VL-30B-A3B-Instruct')
      expect(kimiOcrDefault).toBe('kimi-k2.6')
      expect(speechifyTtsDefault).toBe('simba-3.2')
      expect(elevenlabsTtsDefault).toBe('eleven_v3')
      expect(groqTtsDefault).toBe('canopylabs/orpheus-v1-english')
      expect(openaiTtsDefault).toBe('gpt-4o-mini-tts-2025-12-15')
      expect(deepgramTtsDefault).toBe('aura-2-thalia-en')
      expect(humeTtsDefault).toBe('octave-1')
      expect(cartesiaTtsDefault).toBe('sonic-3.5-2026-05-04')
      expect(opts.openaiModels?.[0]).toBe(openaiDefault)
      expect(geminiDefault).toBe(opts.geminiModels?.[0])
      expect(grokDefault).toBe(opts.grokModels?.[0])
      expect(glmDefault).toBe(opts.glmModels?.[0])
      expect(kimiDefault).toBe(opts.kimiModels?.[0])
      expect(togetherDefault).toBe(opts.togetherModels?.[0])
      expect(cerebrasDefault).toBe(opts.cerebrasModels?.[0])
      expect(opts.deepgramSttModels?.[0]).toBe(deepgramDefault)
      expect(opts.assemblyaiSttModels?.[0]).toBe(assemblyaiDefault)
      expect(opts.gladiaSttModels?.[0]).toBe(gladiaDefault)
      expect(opts.geminiSttModels?.[0]).toBe(geminiSttDefault)
      expect(opts.sonioxSttModels?.[0]).toBe(sonioxDefault)
      expect(opts.speechmaticsSttModels?.[0]).toBe(speechmaticsDefault)
      expect(opts.scrapecreatorsSttModels?.[0]).toBe(scrapeCreatorsDefault)
      expect(opts.openaiOcrModels?.[0]).toBe(openaiOcrDefault)
      expect(opts.geminiOcrModels?.[0]).toBe(geminiOcrDefault)
      expect(opts.grokOcrModels?.[0]).toBe(grokOcrDefault)
      expect(opts.deepinfraOcrModels?.[0]).toBe(deepinfraOcrDefault)
      expect(opts.kimiOcrModels?.[0]).toBe(kimiOcrDefault)
      expect(opts.speechifyTtsModels?.[0]).toBe(speechifyTtsDefault)
      expect(opts.elevenlabsTtsModels?.[0]).toBe(elevenlabsTtsDefault)
      expect(opts.groqTtsModels?.[0]).toBe(groqTtsDefault)
      expect(opts.openaiTtsModels?.[0]).toBe(openaiTtsDefault)
      expect(opts.deepgramTtsModels?.[0]).toBe(deepgramTtsDefault)
      expect(opts.humeTtsModels?.[0]).toBe(humeTtsDefault)
      expect(opts.cartesiaTtsModels?.[0]).toBe(cartesiaTtsDefault)
    })
})
