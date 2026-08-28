import { describe,expect,test } from 'bun:test'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import { getStep2AllShortcutModelExpansions } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import {
DEFAULT_ALL_PROVIDER_CONCURRENCY,
DEFAULT_OCR_CONCURRENCY
} from '~/utils/concurrency-defaults'

describe('option resolution contracts', () => {

  test('--all shortcuts use aggressive hosted concurrency only when concurrency is not explicit', () => {
      const ocrOpts = buildOptsFromFlags({ 'all-ocr': true })
      const llmOpts = buildOptsFromFlags({ 'all-llm': true })
      const ttsOpts = buildOptsFromFlags({ 'all-tts': true })
      const imageOpts = buildOptsFromFlags({ 'all-image': true })
      const videoOpts = buildOptsFromFlags({ 'all-video': true })
      const musicOpts = buildOptsFromFlags({ 'all-music': true })
      const explicitVideoOpts = buildOptsFromFlags({
        'all-video': true,
        'video-provider-concurrency': '3'
      }, {}, new Set(['video-provider-concurrency']))

      expect(ocrOpts.ocrProviderConcurrency).toBe(DEFAULT_OCR_CONCURRENCY)
      expect(llmOpts.llmProviderConcurrency).toBe(DEFAULT_ALL_PROVIDER_CONCURRENCY)
      expect(ttsOpts.ttsProviderConcurrency).toBe(DEFAULT_ALL_PROVIDER_CONCURRENCY)
      expect(imageOpts.imageProviderConcurrency).toBe(DEFAULT_ALL_PROVIDER_CONCURRENCY)
      expect(videoOpts.videoProviderConcurrency).toBe(DEFAULT_ALL_PROVIDER_CONCURRENCY)
      expect(musicOpts.musicProviderConcurrency).toBe(DEFAULT_ALL_PROVIDER_CONCURRENCY)
      expect(explicitVideoOpts.videoProviderConcurrency).toBe(3)
      expect(ocrOpts.ocrLocalConcurrency).toBe(DEFAULT_OCR_CONCURRENCY)
    })

  test('--all-stt/--all-ocr expand hosted providers and local shortcuts expand local engines', () => {
      const expansions = getStep2AllShortcutModelExpansions()
      const sttOpts = buildOptsFromFlags({ 'all-stt': true })
      const ocrOpts = buildOptsFromFlags({ 'all-ocr': true })
      const localSttOpts = buildOptsFromFlags({ 'all-local-stt': true })
      const localOcrOpts = buildOptsFromFlags({ 'all-local-ocr': true })

      expect(expansions['deepgram-stt']?.shortcut).toBe('all-stt')
      expect(expansions['deepgram-stt']?.supported).toEqual(['nova-3'])
      expect(expansions['grok-stt']?.shortcut).toBe('all-stt')
      expect(expansions['mistral-stt']?.shortcut).toBe('all-stt')
      expect(expansions['assemblyai-stt']?.supported).toEqual(['universal-3-5-pro'])
      expect(expansions['gladia-stt']?.supported).toEqual(['solaria-3'])
      expect(expansions['gemini-stt']?.supported).toEqual(['gemini-3.6-flash'])
      expect(expansions['soniox-stt']?.supported).toEqual(['stt-async-v5'])
      expect(expansions['speechmatics-stt']?.supported).toEqual(['melia-1'])
      expect(expansions['together-stt']?.supported).toEqual(['openai/whisper-large-v3', 'nvidia/parakeet-tdt-0.6b-v3'])
      expect(expansions['whisper-stt']?.shortcut).toBe('all-local-stt')
      expect(expansions['scrapecreators-stt']).toBeUndefined()
      expect(expansions['openai-ocr']?.shortcut).toBe('all-ocr')
      expect(expansions['grok-ocr']?.shortcut).toBe('all-ocr')
      expect(expansions['kimi-ocr']?.shortcut).toBe('all-ocr')
      expect(expansions['deepinfra-ocr']?.shortcut).toBe('all-ocr')
      expect(expansions['replicate-ocr']).toBeUndefined()
      expect(expansions['fal-ocr']).toBeUndefined()
      expect(ocrOpts.mistralOcrModels).toEqual(['mistral-ocr-2512', 'mistral-ocr-4-0'])
      expect(ocrOpts.openaiOcrModels).toEqual(['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4-mini', 'gpt-5.4-nano'])
      expect(ocrOpts.openaiOcrModels).not.toContain('gpt-5.6')
      expect(ocrOpts.grokOcrModels).toEqual(['grok-4.3', 'grok-4.20-0309-non-reasoning', 'grok-4.5', 'grok-4.6'])
      expect(ocrOpts.kimiOcrModels).toEqual(['kimi-k2.6', 'kimi-k3'])
      expect(ocrOpts.anthropicOcrModels).toEqual(['claude-fable-5', 'claude-opus-4-8', 'claude-sonnet-5', 'claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-opus-5'])
      expect(ocrOpts.anthropicOcrModels).not.toContain('claude-mythos-5')
      expect(ocrOpts.geminiOcrModels).toEqual(['gemini-3.1-pro-preview', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'])
      expect(ocrOpts.geminiOcrModels).not.toContain('gemini-3.1-flash-lite')
      expect(ocrOpts.deepinfraOcrModels).toEqual(['google/gemma-3-27b-it', 'meta-llama/Llama-4-Scout-17B-16E-Instruct', 'mistralai/Mistral-Small-3.2-24B-Instruct-2506', 'Qwen/Qwen3-VL-235B-A22B-Instruct', 'Qwen/Qwen3-VL-30B-A3B-Instruct'])
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
      expect(ocrTargets.map((target) => target.service)).not.toContain('replicate')
      expect(ocrTargets.map((target) => target.service)).not.toContain('fal')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('openai:gpt-5.5')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('openai:gpt-5.6-sol')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).not.toContain('openai:gpt-5.6')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('grok:grok-4.3')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('grok:grok-4.20-0309-non-reasoning')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('grok:grok-4.5')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('grok:grok-4.6')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('anthropic:claude-fable-5')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('anthropic:claude-opus-4-8')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('anthropic:claude-sonnet-5')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('anthropic:claude-sonnet-4-6')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('anthropic:claude-haiku-4-5')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('anthropic:claude-opus-5')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('gemini:gemini-3.7-flash')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('gemini:gemini-3.6-flash')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('gemini:gemini-3.5-flash-lite')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).not.toContain('gemini:gemini-3.1-flash-lite')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).toContain('kimi:kimi-k3')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).not.toContain('anthropic:claude-mythos-5')
      expect(ocrTargets.map((target) => `${target.service}:${target.model}`)).not.toContain('deepinfra:PaddlePaddle/PaddleOCR-VL-0.9B')
      expect(collectSttTargets(localSttOpts).map((target) => target.service)).not.toContain('reverb')
      expect(collectSttTargets(localSttOpts).map((target) => target.service)).toContain('whisper')
      expect(collectExplicitOcrTargets(localOcrOpts).map((target) => target.service)).toEqual([
        'tesseract'
      ])
    })
})
