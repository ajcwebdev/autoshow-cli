import { describe,expect,test } from 'bun:test'
import { buildExtractionCallOpts } from '~/cli/commands/process-steps/step-1-download/download-targets/single/document-write'
import { normalizeGenericProviderSelectorFlags } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import { STANDALONE_TTS_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import {
DEFAULT_ALL_PROVIDER_TTS_CHUNK_CONCURRENCY,
DEFAULT_CLI_CONCURRENCY,
DEFAULT_GROK_TTS_CHUNK_CONCURRENCY,
DEFAULT_OCR_CONCURRENCY,
DEFAULT_TTS_CHUNK_CONCURRENCY
} from '~/utils/concurrency-defaults'
import { flagOccurrencesFromValues } from '../../../../test-utils/flag-occurrences'

describe('option resolution contracts', () => {
  test('hosted concurrency mode defaults to ramp and validates explicit values', () => {
    const defaults = buildOptsFromFlags({})
    const immediate = buildOptsFromFlags({ 'concurrency-mode': 'immediate' })

    expect(defaults.concurrencyMode).toBe('ramp')
    expect(defaults.hostedConcurrencyCoordinator?.mode).toBe('ramp')
    expect(immediate.concurrencyMode).toBe('immediate')
    expect(immediate.hostedConcurrencyCoordinator?.mode).toBe('immediate')
    expect(() => buildOptsFromFlags({ 'concurrency-mode': 'fast' })).toThrow('Expected "ramp" or "immediate"')
  })

  test('OCR provider concurrency defaults, falls back, and clamps like STT concurrency flags', () => {
      const defaults = buildOptsFromFlags({})
      const fallback = buildOptsFromFlags({
        'ocr-provider-concurrency': 'not-a-number',
        'ocr-local-concurrency': 'nope'
      })
      const clamped = buildOptsFromFlags({
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

  test('OCR provider mode defaults to fanout and resolves explicit or configured pool mode', () => {
      const defaults = buildOptsFromFlags({})
      const explicitPool = buildOptsFromFlags({
        'ocr-provider-mode': 'pool'
      }, {}, new Set(['ocr-provider-mode']))
      const configuredPool = buildOptsFromFlags({
        'ocr-provider-mode': 'pool',
        __autoshowConfigInjectedFlags: ['ocr-provider-mode']
      })

      expect(defaults.ocrProviderMode).toBe('fanout')
      expect(defaults.ocrProviderModeExplicit).toBe(false)
      expect(buildExtractionCallOpts('input.pdf', '/tmp/autoshow-output', defaults).ocrProviderMode).toBe('fanout')
      expect(explicitPool.ocrProviderMode).toBe('pool')
      expect(explicitPool.ocrProviderModeExplicit).toBe(true)
      expect(configuredPool.ocrProviderMode).toBe('pool')
      expect(configuredPool.ocrProviderModeExplicit).toBe(true)
      expect(() => buildOptsFromFlags({ 'ocr-provider-mode': 'round-robin' })).toThrow('Expected fanout or pool')
    })

  test('OCR provider concurrency ignores parser-injected shared defaults', () => {
      const parserDefaults = buildOptsFromFlags({
        'provider-concurrency': String(DEFAULT_CLI_CONCURRENCY),
        'local-concurrency': String(DEFAULT_CLI_CONCURRENCY)
      })
      const explicitShared = buildOptsFromFlags({
        'provider-concurrency': String(DEFAULT_CLI_CONCURRENCY),
        'local-concurrency': String(DEFAULT_CLI_CONCURRENCY)
      }, {}, new Set(['provider-concurrency', 'local-concurrency']))
      const configuredSpecific = buildOptsFromFlags({
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
      const defaults = buildOptsFromFlags({})
      const fallback = buildOptsFromFlags({
        'ocr-concurrency': 'not-a-number'
      })
      const clamped = buildOptsFromFlags({
        'ocr-concurrency': '0'
      })
      const explicit = buildOptsFromFlags({
        'ocr-concurrency': '4'
      })
      const configured = buildOptsFromFlags({
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

  test('LLM provider concurrency defaults, falls back, and clamps like STT/OCR concurrency flags', () => {
      const defaults = buildOptsFromFlags({})
      const fallback = buildOptsFromFlags({
        'llm-provider-concurrency': 'not-a-number',
        'llm-local-concurrency': 'nope'
      })
      const clamped = buildOptsFromFlags({
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
      const defaults = buildOptsFromFlags({})
      const fallback = buildOptsFromFlags({
        'tts-provider-concurrency': 'not-a-number',
        'tts-chunk-concurrency': 'bad',
        'image-provider-concurrency': 'bad',
        'video-provider-concurrency': 'bad',
        'music-provider-concurrency': 'bad'
      })
      const clamped = buildOptsFromFlags({
        'tts-provider-concurrency': '0',
        'tts-chunk-concurrency': '0',
        'image-provider-concurrency': '0',
        'video-provider-concurrency': '0',
        'music-provider-concurrency': '0'
      })

      expect(defaults.ttsProviderConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(defaults.ttsChunkConcurrency).toBe(DEFAULT_TTS_CHUNK_CONCURRENCY)
      expect(defaults.imageProviderConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(defaults.videoProviderConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(defaults.musicProviderConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(fallback.ttsProviderConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(fallback.ttsChunkConcurrency).toBe(DEFAULT_TTS_CHUNK_CONCURRENCY)
      expect(fallback.imageProviderConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(fallback.videoProviderConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(fallback.musicProviderConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(clamped.ttsProviderConcurrency).toBe(1)
      expect(clamped.ttsChunkConcurrency).toBe(1)
      expect(clamped.imageProviderConcurrency).toBe(1)
      expect(clamped.videoProviderConcurrency).toBe(1)
      expect(clamped.musicProviderConcurrency).toBe(1)

      const explicit = buildOptsFromFlags({
        'tts-chunk-concurrency': '3'
      })
      expect(explicit.ttsChunkConcurrency).toBe(3)
    })

  test('Grok-only hosted TTS gets a higher implicit chunk concurrency default', () => {
      const grokOnly = buildOptsFromFlags({
        'grok-tts': 'grok-tts'
      })
      const parserDefaultInjected = buildOptsFromFlags({
        'grok-tts': 'grok-tts',
        'tts-chunk-concurrency': String(DEFAULT_TTS_CHUNK_CONCURRENCY)
      })
      const normalizedGrokProvider = normalizeGenericProviderSelectorFlags({
        provider: 'grok',
        'tts-chunk-concurrency': String(DEFAULT_TTS_CHUNK_CONCURRENCY)
      }, new Set(['provider']), flagOccurrencesFromValues({ provider: 'grok' }), 'provider', STANDALONE_TTS_PROVIDER_TARGETS, {
        allProvidersTarget: 'all-tts'
      })
      const genericProviderGrok = buildOptsFromFlags(normalizedGrokProvider.flags, {}, normalizedGrokProvider.explicitFlags)
      const explicitThirty = buildOptsFromFlags({
        'grok-tts': 'grok-tts',
        'tts-chunk-concurrency': String(DEFAULT_TTS_CHUNK_CONCURRENCY)
      }, {}, new Set(['tts-chunk-concurrency']))
      const configuredThirty = buildOptsFromFlags({
        'grok-tts': 'grok-tts',
        'tts-chunk-concurrency': String(DEFAULT_TTS_CHUNK_CONCURRENCY),
        __autoshowConfigInjectedFlags: ['tts-chunk-concurrency']
      })
      const configuredCustom = buildOptsFromFlags({
        'grok-tts': 'grok-tts',
        'tts-chunk-concurrency': '44',
        __autoshowConfigInjectedFlags: ['tts-chunk-concurrency']
      })
      const openaiOnly = buildOptsFromFlags({
        'openai-tts': 'gpt-4o-mini-tts-2025-12-15'
      })
      const grokAndOpenai = buildOptsFromFlags({
        'grok-tts': 'grok-tts',
        'openai-tts': 'gpt-4o-mini-tts-2025-12-15'
      })
      const allTts = buildOptsFromFlags({ 'all-tts': true })
      const explicitAllTts = buildOptsFromFlags({
        'all-tts': true,
        'tts-chunk-concurrency': String(DEFAULT_TTS_CHUNK_CONCURRENCY)
      }, {}, new Set(['tts-chunk-concurrency']))

      expect(grokOnly.ttsChunkConcurrency).toBe(DEFAULT_GROK_TTS_CHUNK_CONCURRENCY)
      expect(parserDefaultInjected.ttsChunkConcurrency).toBe(DEFAULT_GROK_TTS_CHUNK_CONCURRENCY)
      expect(genericProviderGrok.ttsChunkConcurrency).toBe(DEFAULT_GROK_TTS_CHUNK_CONCURRENCY)
      expect(explicitThirty.ttsChunkConcurrency).toBe(DEFAULT_TTS_CHUNK_CONCURRENCY)
      expect(configuredThirty.ttsChunkConcurrency).toBe(DEFAULT_TTS_CHUNK_CONCURRENCY)
      expect(configuredCustom.ttsChunkConcurrency).toBe(44)
      expect(openaiOnly.ttsChunkConcurrency).toBe(DEFAULT_TTS_CHUNK_CONCURRENCY)
      expect(grokAndOpenai.ttsChunkConcurrency).toBe(DEFAULT_TTS_CHUNK_CONCURRENCY)
      expect(allTts.ttsChunkConcurrency).toBe(DEFAULT_ALL_PROVIDER_TTS_CHUNK_CONCURRENCY)
      expect(explicitAllTts.ttsChunkConcurrency).toBe(DEFAULT_TTS_CHUNK_CONCURRENCY)
    })
})
