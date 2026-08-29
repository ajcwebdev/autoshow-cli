import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { buildExtractionCallOpts } from '~/cli/commands/process-steps/step-1-download/download-targets/single/document-write'
import { buildExpectedFilesList } from '~/cli/commands/process-steps/step-1-download/download-targets/expected-output'
import {
  AUTO_PDF_CHAPTER_EXPORT_MIN_PAGES,
  resolvePdfChapterDetectionMode,
  shouldAttemptPdfChapterExport,
  shouldExportEpubChapters
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/chapter-export-defaults'
import {
  DEFAULT_ALL_PROVIDER_CONCURRENCY,
  DEFAULT_CLI_CONCURRENCY
} from '~/utils/concurrency-defaults'
import {
  HOSTED_URL_ARTICLE_BACKENDS,
  URL_ARTICLE_BACKENDS
} from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import {
  DEFAULT_URL_REQUEST_ATTEMPTS,
  DEFAULT_URL_REQUEST_TIMEOUT_MS
} from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-utils'

describe('option resolution contracts', () => {
  test('buildOptsFromFlags maps representative CLI flags to runtime options', () => {
      const opts = buildOptsFromFlags({
        openai: 'gpt-5.4-mini',
        grok: 'grok-4.3',
        glm: 'glm-5.1',
        kimi: 'kimi-k2.6',
        together: 'glm-5.1',
        cerebras: 'gpt-oss-120b',
        'mistral-stt': 'voxtral-mini-2602',
        'grok-stt': 'speech-to-text',
        'together-stt': 'openai/whisper-large-v3',
        'deepgram-stt': 'nova-3',
        'scrapecreators-stt': 'youtube-transcript',
        'stt-scrapecreators-lang': 'fr',
        'grok-tts': 'grok-tts',
        'mistral-tts': 'voxtral-mini-tts-2603',
        'speechify-tts': 'simba-3.2',
        'hume-tts': 'octave-2',
        'cartesia-tts': 'sonic-3.5-2026-05-04',
        'elevenlabs-tts': 'eleven_v3',
        'openai-tts': 'gpt-4o-mini-tts-2025-12-15',
        'tts-voice': [
          'grok=EVE',
          'mistral=voice_abc123',
          'speechify=narrator_voice',
          'hume=Studio Voice',
          'cartesia=cartesia-voice-id',
          'openai=alloy'
        ],
        'tts-speed': ['openai=1.1', 'elevenlabs=1.1'],
        'tts-language': ['speechify=en-US', 'cartesia=en', 'elevenlabs=en'],
        'tts-text-normalization': 'elevenlabs=ON',
        'elevenlabs-tts-stability': '0.4',
        'elevenlabs-tts-similarity-boost': '0.8',
        'elevenlabs-tts-style': '0.2',
        'elevenlabs-tts-use-speaker-boost': true,
        'elevenlabs-tts-seed': '12345',
        'elevenlabs-tts-pronunciation-dictionary-locator': ['dict_1:version_2', 'dict_3'],
        'openai-ocr': 'gpt-5.5',
        'grok-ocr': 'grok-4.3',
        'deepinfra-ocr': 'Qwen/Qwen3-VL-30B-A3B-Instruct',
        'kimi-ocr': 'kimi-k2.6',
        'tesseract-ocr': true,
        'youtube-captions': true,
        'best-quality': true,
        'batch-limit': '9',
        'stt-provider-concurrency': '3',
        'ocr-provider-concurrency': '4',
        'ocr-local-concurrency': '2',
        'llm-provider-concurrency': '5',
        'llm-local-concurrency': '3'
      })

      expect(opts.openaiModels?.[0]).toBe('gpt-5.4-mini')
      expect(opts.grokModels?.[0]).toBe('grok-4.3')
      expect(opts.glmModels?.[0]).toBe('glm-5.1')
      expect(opts.kimiModels?.[0]).toBe('kimi-k2.6')
      expect(opts.togetherModels?.[0]).toBe('glm-5.1')
      expect(opts.cerebrasModels?.[0]).toBe('gpt-oss-120b')
      expect(opts.mistralSttModels?.[0]).toBe('voxtral-mini-2602')
      expect(opts.grokSttModels?.[0]).toBe('speech-to-text')
      expect(opts.togetherSttModels?.[0]).toBe('openai/whisper-large-v3')
      expect(opts.deepgramSttModels?.[0]).toBe('nova-3')
      expect(opts.scrapecreatorsSttModels?.[0]).toBe('youtube-transcript')
      expect(opts.scrapecreatorsLang).toBe('fr')
      expect(opts.grokTtsModels?.[0]).toBe('grok-tts')
      expect(opts.grokTtsVoice).toBe('eve')
      expect(opts.mistralTtsModels?.[0]).toBe('voxtral-mini-tts-2603')
      expect(opts.mistralTtsVoice).toBe('voice_abc123')
      expect(opts.speechifyTtsModels?.[0]).toBe('simba-3.2')
      expect(opts.speechifyVoice).toBe('narrator_voice')
      expect(opts.speechifyTtsLanguage).toBe('en-US')
      expect(opts.humeTtsModels?.[0]).toBe('octave-2')
      expect(opts.humeTtsVoice).toBe('Studio Voice')
      expect(opts.cartesiaTtsModels?.[0]).toBe('sonic-3.5-2026-05-04')
      expect(opts.cartesiaTtsVoice).toBe('cartesia-voice-id')
      expect(opts.cartesiaTtsLanguage).toBe('en')
      expect(opts.elevenlabsTtsModels?.[0]).toBe('eleven_v3')
      expect(opts.elevenlabsTtsLanguageCode).toBe('en')
      expect(opts.elevenlabsTtsStability).toBe(0.4)
      expect(opts.elevenlabsTtsSimilarityBoost).toBe(0.8)
      expect(opts.elevenlabsTtsStyle).toBe(0.2)
      expect(opts.elevenlabsTtsUseSpeakerBoost).toBe(true)
      expect(opts.elevenlabsTtsSpeed).toBe(1.1)
      expect(opts.elevenlabsTtsSeed).toBe(12345)
      expect(opts.elevenlabsTtsTextNormalization).toBe('on')
      expect(opts.elevenlabsTtsPronunciationDictionaryLocators).toEqual(['dict_1:version_2', 'dict_3'])
      expect(opts.openaiOcrModels?.[0]).toBe('gpt-5.5')
      expect(opts.grokOcrModels?.[0]).toBe('grok-4.3')
      expect(opts.deepinfraOcrModels?.[0]).toBe('Qwen/Qwen3-VL-30B-A3B-Instruct')
      expect(opts.kimiOcrModels?.[0]).toBe('kimi-k2.6')
      expect(opts.useTesseract).toBe(true)
      expect(opts.youtubeCaptions).toBe(true)
      expect(opts.bestQuality).toBe(true)
      expect(opts.batchLimit).toBe(9)
      expect(opts.sttProviderConcurrency).toBe(3)
      expect(opts.ocrProviderConcurrency).toBe(4)
      expect(opts.ocrLocalConcurrency).toBe(2)
      expect(opts.llmProviderConcurrency).toBe(5)
      expect(opts.llmLocalConcurrency).toBe(3)
      expect(opts.openaiVoiceId).toBe('alloy')
      expect(opts.openaiTtsSpeed).toBe(1.1)
    })

  test('chapter export defaults to automatic and preserves explicit opt-out', () => {
      const defaults = buildOptsFromFlags({})
      const explicitChapters = buildOptsFromFlags({ chapters: true })
      const disabled = buildOptsFromFlags({ chapters: false })

      expect(defaults.chapterFiles).toBeUndefined()
      expect(explicitChapters.chapterFiles).toBe(true)
      expect(disabled.chapterFiles).toBe(false)
      expect(buildExtractionCallOpts('input.pdf', '/tmp/autoshow-output', disabled).chapterFiles).toBe(false)

      expect(shouldExportEpubChapters(defaults.chapterFiles)).toBe(true)
      expect(shouldExportEpubChapters(disabled.chapterFiles)).toBe(false)
      expect(shouldAttemptPdfChapterExport(undefined, AUTO_PDF_CHAPTER_EXPORT_MIN_PAGES - 1)).toBe(false)
      expect(shouldAttemptPdfChapterExport(undefined, AUTO_PDF_CHAPTER_EXPORT_MIN_PAGES)).toBe(true)
      expect(shouldAttemptPdfChapterExport(false, AUTO_PDF_CHAPTER_EXPORT_MIN_PAGES + 100)).toBe(false)
      expect(shouldAttemptPdfChapterExport(true, 1)).toBe(true)
      expect(resolvePdfChapterDetectionMode(undefined, 'llm')).toBe('local')
      expect(resolvePdfChapterDetectionMode(true, 'llm')).toBe('llm')
    })

  test('EPUB extract expected files include automatic chapters unless chapters are disabled', async () => {
      const automatic = await buildExpectedFilesList(
        'extract',
        buildOptsFromFlags({}),
        'input/examples/document/1-epub.epub'
      )
      const disabled = await buildExpectedFilesList(
        'extract',
        buildOptsFromFlags({ chapters: false }),
        'input/examples/document/1-epub.epub'
      )

      expect(automatic).toContain('chapters/*.txt (EPUB native text runs, or PDF chapter autodetection)')
      expect(disabled).not.toContain('chapters/*.txt (EPUB native text runs, or PDF chapter autodetection)')
    })

  test('pooled OCR expected files describe isolated page attempts instead of fanout results', async () => {
      const opts = buildOptsFromFlags({
        'ocr-provider-mode': 'pool',
        'openai-ocr': 'gpt-5.5',
        'mistral-ocr': 'mistral-ocr-4-0',
        format: 'text'
      })

      await expect(buildExpectedFilesList(
        'extract',
        opts,
        'input/examples/document/3-document.pdf'
      )).resolves.toEqual([
        'extraction.txt',
        'providers/<service>-<model>/attempts/page-<number>/attempt-<number>/result.json',
        'providers/<service>-<model>/attempts/page-<number>/attempt-<number>/usage.json',
        'manifest.json'
      ])
    })

  test('buildOptsFromFlags only accepts canonical flag keys', () => {
      const camelCaseFlags = buildOptsFromFlags({
        mistralStt: 'voxtral-mini-2602',
        deepinfraOcr: 'Qwen/Qwen3-VL-30B-A3B-Instruct'
      })
      const canonicalFlags = buildOptsFromFlags({
        'mistral-stt': 'voxtral-mini-2602',
        'deepinfra-ocr': 'Qwen/Qwen3-VL-30B-A3B-Instruct'
      })

      expect(camelCaseFlags.mistralSttModels?.[0]).toBeUndefined()
      expect(camelCaseFlags.deepinfraOcrModels?.[0]).toBeUndefined()
      expect(canonicalFlags.mistralSttModels?.[0]).toBe('voxtral-mini-2602')
      expect(canonicalFlags.deepinfraOcrModels?.[0]).toBe('Qwen/Qwen3-VL-30B-A3B-Instruct')
    })

  test('buildOptsFromFlags accepts URL article backend names', () => {
      for (const backend of ['defuddle', 'firecrawl', 'glm-reader', 'spider', 'supadata', 'zyte'] as const) {
        const opts = buildOptsFromFlags({ 'url-provider': backend })
        expect(opts.urlBackend).toBe(backend)
        expect(opts.urlBackendExplicit).toBe(true)
      }
    })

  test('--all-url expands hosted URL article backends and --all-local-url expands defuddle', () => {
      const opts = buildOptsFromFlags({ 'all-url': true })
      const localOpts = buildOptsFromFlags({ 'all-local-url': true })
      const combinedOpts = buildOptsFromFlags({
        'all-url': true,
        'all-local-url': true
      })
      const explicitConcurrency = buildOptsFromFlags({
        'all-url': true,
        'provider-concurrency': '3'
      }, {}, new Set(['provider-concurrency']))

      expect(opts.urlBackends).toEqual([...HOSTED_URL_ARTICLE_BACKENDS])
      expect(localOpts.urlBackends).toEqual(['defuddle'])
      expect(combinedOpts.urlBackends).toEqual([...URL_ARTICLE_BACKENDS])
      expect(opts.urlProviderConcurrency).toBe(DEFAULT_ALL_PROVIDER_CONCURRENCY)
      expect(localOpts.urlProviderConcurrency).toBe(DEFAULT_CLI_CONCURRENCY)
      expect(explicitConcurrency.urlBackends).toEqual([...HOSTED_URL_ARTICLE_BACKENDS])
      expect(explicitConcurrency.urlProviderConcurrency).toBe(3)
    })

  test('URL request timeout and attempts resolve defaults and CLI overrides', () => {
      const defaults = buildOptsFromFlags({})
      const cliOverrides = buildOptsFromFlags({
        'url-request-timeout-ms': '45000',
        'url-request-attempts': '4'
      })

      expect(defaults.urlRequestTimeoutMs).toBe(DEFAULT_URL_REQUEST_TIMEOUT_MS)
      expect(defaults.urlRequestAttempts).toBe(DEFAULT_URL_REQUEST_ATTEMPTS)
      expect(cliOverrides.urlRequestTimeoutMs).toBe(45000)
      expect(cliOverrides.urlRequestAttempts).toBe(4)
    })

  test('URL request timeout and attempts reject invalid CLI values', () => {
      expect(() => buildOptsFromFlags({
        'url-request-timeout-ms': '0'
      })).toThrow('Invalid --url-request-timeout-ms value "0". Expected a positive integer.')
      expect(() => buildOptsFromFlags({
        'url-request-attempts': 'nope'
      })).toThrow('Invalid --url-request-attempts value "nope". Expected a positive integer.')
    })

  test('--all-url conflicts with single URL backend selection', () => {
      expect(() => buildOptsFromFlags({
        'all-url': true,
        'url-provider': 'firecrawl'
      })).toThrow('Cannot use --all-providers or --all-local url with --url-provider')
      expect(() => buildOptsFromFlags({
        'all-local-url': true,
        'url-provider': 'defuddle'
      })).toThrow('Cannot use --all-providers or --all-local url with --url-provider')
    })

  test('--all-url article extraction reports provider artifact expectations', async () => {
      const opts = buildOptsFromFlags({ 'all-url': true })

      await expect(buildExpectedFilesList(
        'extract',
        opts,
        'https://example.com/articles/story.html'
      )).resolves.toEqual([
        'providers/<backend>/result.json',
        'providers/<backend>/extraction.txt',
        'manifest.json'
      ])
    })

  test('standalone write reports only write artifact expectations', async () => {
      const opts = buildOptsFromFlags({ 'all-url': true })

      await expect(buildExpectedFilesList(
        'write',
        opts,
        'https://example.com/articles/story.html'
      )).resolves.toEqual([
        'text.json',
        'show-note.md',
        'prompt.md',
        'manifest.json'
      ])
    })

  test('X Space write reports only write artifact expectations', async () => {
      await expect(buildExpectedFilesList(
        'write',
        buildOptsFromFlags({}),
        'https://x.com/i/spaces/1DXxyRYNejbKM'
      )).resolves.toEqual([
        'text.json',
        'show-note.md',
        'prompt.md',
        'manifest.json'
      ])
    })
})
