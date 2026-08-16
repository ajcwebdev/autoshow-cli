import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import { collectSttTargets, collectSttTargetsForSource } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import {
  collectStep2ProviderSelections,
  collectStep2ProviderSpecs,
  collectUrlArticleTargets,
  HOSTED_URL_ARTICLE_BACKENDS,
  LOCAL_URL_ARTICLE_BACKENDS,
  URL_ARTICLE_BACKENDS,
  getStep2ProviderSelectionFlagNames
} from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import { resolveOcrStep2ExecutionFromFormat } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/resolved-step2'
import { isLocalUrlBackend } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-targets'
import { formatModelSelector } from '~/cli/commands/setup-and-utilities/models/model-validation'

describe('provider selection contracts', () => {
  test('retired model flag values are rejected', () => {
    const cases: Array<[string, string]> = [
      ['anthropic', 'claude-opus-4-' + '6'],
      ['anthropic', 'claude-opus-4-' + '7'],
      ['anthropic', 'claude-mythos-5'],
      ['anthropic-ocr', 'claude-opus-4-' + '6'],
      ['anthropic-ocr', 'claude-opus-4-' + '7'],
      ['anthropic-ocr', 'claude-mythos-5'],
      ['openai', 'gpt-5.6'],
      ['openai-ocr', 'gpt-5.6'],
      ['minimax-music', 'music-2' + '.5'],
      ['minimax-video', 'MiniMax-Hailuo-' + '02'],
      ['glm-video', 'viduq1-' + 'image'],
      ['glm-video', 'viduq1-' + 'start-end'],
      ['gemini-image', 'imagen-4.0-generate-001'],
      ['gemini-image', 'gemini-3.1-flash-image-preview'],
      ['bfl-image', 'flux-2-pro-preview'],
      ['assemblyai-stt', 'universal-3-pro'],
      ['gemini-stt', 'gemini-3-flash-preview'],
      ['gladia-stt', 'default'],
      ['soniox-stt', 'stt-async-v4'],
      ['deepgram-stt', 'nova-3-general'],
      ['deepgram-stt', 'nova-3-medical'],
      ['together-stt', 'nvidia/parakeet-tdt-0.6b-v3-realtime'],
      ['together-stt', 'nvidia/nemotron-3-asr-streaming-0.6b']
    ]

    // Cases are keyed by internal target flag, which is not a spelling a user can type;
    // formatModelSelector maps it to the public selector the error must name.
    for (const [flag, model] of cases) {
      expect(() => buildOptsFromFlags(false, { [flag]: model }))
        .toThrow(`Invalid model "${model}" for ${formatModelSelector(flag)}`)
    }
  })

  test('STT provider canonical ordering is stable', () => {
    expect(getStep2ProviderSelectionFlagNames('stt')).toEqual([
      'deepinfra-stt',
      'deepgram-stt',
      'soniox-stt',
      'speechmatics-stt',
      'rev-stt',
      'groq-stt',
      'grok-stt',
      'mistral-stt',
      'assemblyai-stt',
      'gladia-stt',
      'happyscribe-stt',
      'supadata-stt',
      'scrapecreators-stt',
      'gemini-stt',
      'together-stt',
      'whisper-stt',
      'whisperfile-stt'
    ])
  })

  test('OCR provider canonical ordering is stable', () => {
    expect(getStep2ProviderSelectionFlagNames('ocr')).toEqual([
      'tesseract-ocr',
      'mistral-ocr',
      'glm-ocr',
      'kimi-ocr',
      'openai-ocr',
      'grok-ocr',
      'anthropic-ocr',
      'gemini-ocr',
      'deepinfra-ocr',
      'replicate-ocr',
      'fal-ocr'
    ])
  })

  test('URL article provider ordering and selection helpers are registry-backed', () => {
    expect(URL_ARTICLE_BACKENDS).toEqual([
      'defuddle',
      'firecrawl',
      'glm-reader',
      'spider',
      'supadata',
      'zyte'
    ])
    expect(HOSTED_URL_ARTICLE_BACKENDS).toEqual([
      'firecrawl',
      'glm-reader',
      'spider',
      'supadata',
      'zyte'
    ])
    expect(LOCAL_URL_ARTICLE_BACKENDS).toEqual(['defuddle'])
    // isLocalUrlBackend derives from the registry's all-local-url label, so local and hosted
    // must stay a partition: an entry whose allShortcut drifts would silently move a backend
    // between the local and hosted concurrency pools without failing anywhere else.
    for (const backend of URL_ARTICLE_BACKENDS) {
      expect(isLocalUrlBackend(backend)).toBe(
        !(HOSTED_URL_ARTICLE_BACKENDS as readonly string[]).includes(backend)
      )
    }
    expect(getStep2ProviderSelectionFlagNames('url')).toEqual(['url-provider'])

    const explicitOpts = buildOptsFromFlags(false, {
      'url-provider': 'spider'
    }, {}, new Set(['url-provider']))
    expect(collectStep2ProviderSelections('url', explicitOpts).map((selection) => ({
      service: selection.targetService,
      model: selection.model,
      origin: selection.origin
    }))).toEqual([{
      service: 'spider',
      model: 'spider',
      origin: 'explicit'
    }])
    expect(collectUrlArticleTargets(explicitOpts)).toEqual([{
      service: 'spider',
      model: 'spider'
    }])

    const allUrlOpts = buildOptsFromFlags(false, {
      'all-url': true
    }, {}, new Set(['all-url']))
    expect(collectUrlArticleTargets(allUrlOpts)).toEqual(
      HOSTED_URL_ARTICLE_BACKENDS.map((backend) => ({ service: backend, model: backend }))
    )
    expect(collectStep2ProviderSelections('url', allUrlOpts).map((selection) => selection.origin)).toEqual([
      'all-shortcut',
      'all-shortcut',
      'all-shortcut',
      'all-shortcut',
      'all-shortcut'
    ])

    const allLocalUrlOpts = buildOptsFromFlags(false, {
      'all-local-url': true
    }, {}, new Set(['all-local-url']))
    expect(collectUrlArticleTargets(allLocalUrlOpts)).toEqual([{
      service: 'defuddle',
      model: 'defuddle'
    }])
  })

  test('article planned routing includes standardized URL providers', () => {
    const allUrlOpts = buildOptsFromFlags(false, {
      'all-url': true
    }, {}, new Set(['all-url']))
    expect(resolveOcrStep2ExecutionFromFormat('html', allUrlOpts)).toEqual({
      route: 'article',
      sourceKind: 'article',
      providers: HOSTED_URL_ARTICLE_BACKENDS.map((backend) => ({
        service: backend,
        model: backend,
        origin: 'all-shortcut'
      }))
    })

    const localHtmlHostedOpts = {
      ...buildOptsFromFlags(false, {
        'url-provider': 'firecrawl'
      }, {}, new Set(['url-provider'])),
      localHtmlDocument: true
    }
    expect(resolveOcrStep2ExecutionFromFormat('html', localHtmlHostedOpts)).toEqual({
      route: 'article',
      sourceKind: 'article',
      providers: [{
        service: 'defuddle',
        model: 'defuddle',
        origin: 'default'
      }]
    })
  })

  test('target collection preserves provider ordering and deduplicates repeated models', () => {
    const sttOpts = buildOptsFromFlags(false, {
      'whisper-stt': ['base', 'base'],
      'assemblyai-stt': ['universal-3-5-pro', 'universal-3-5-pro', 'universal-2']
    })
    const ocrSpecs = collectStep2ProviderSpecs('ocr', {
      useTesseract: true,
      openaiOcrModels: ['gpt-5.4-nano', 'gpt-5.4-nano', 'gpt-5.5'],
      grokOcrModels: ['grok-4.3']
    })
    const ocrOpts = buildOptsFromFlags(false, {
      'tesseract-ocr': true,
      'openai-ocr': ['gpt-5.4-nano', 'gpt-5.4-nano', 'gpt-5.5'],
      'grok-ocr': ['grok-4.3']
    })

    expect(collectSttTargets(sttOpts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'assemblyai:universal-3-5-pro',
      'assemblyai:universal-2',
      'whisper:base'
    ])
    expect(ocrSpecs).toEqual([
      { provider: 'tesseract', model: 'tesseract' },
      { provider: 'openai-ocr', model: 'gpt-5.4-nano' },
      { provider: 'openai-ocr', model: 'gpt-5.5' },
      { provider: 'grok-ocr', model: 'grok-4.3' }
    ])
    expect(collectExplicitOcrTargets(ocrOpts)).toEqual([
      { service: 'tesseract', model: 'tesseract' },
      { service: 'openai', model: 'gpt-5.4-nano' },
      { service: 'openai', model: 'gpt-5.5' },
      { service: 'grok', model: 'grok-4.3' }
    ])
  })

  test('--all-stt registry expansion excludes local providers and leaves ScrapeCreators to source-aware YouTube expansion', () => {
    const opts = buildOptsFromFlags(false, { 'all-stt': true })
    const services = collectSttTargets(opts).map((target) => target.service)
    const supadataTargets = collectSttTargets(opts).filter((target) => target.service === 'supadata')
    const scrapeCreatorsTargets = collectSttTargets(opts).filter((target) => target.service === 'scrapecreators')

    expect(services).toContain('deepgram')
    expect(services).toContain('mistral')
    expect(services).not.toContain('reverb')
    expect(services).not.toContain('whisper')
    expect(supadataTargets).toEqual([{
      service: 'supadata',
      model: 'auto',
      local: false
    }])
    expect(scrapeCreatorsTargets).toEqual([])
    expect(collectSttTargets(opts).filter((target) => target.service === 'deepgram').map((target) => target.model)).toEqual(['nova-3'])
    expect(collectSttTargets(opts).filter((target) => target.service === 'assemblyai').map((target) => target.model)).toEqual([
      'universal-3-5-pro',
      'universal-2'
    ])
    expect(collectSttTargets(opts).filter((target) => target.service === 'together').map((target) => target.model)).toEqual([
      'openai/whisper-large-v3',
      'nvidia/parakeet-tdt-0.6b-v3'
    ])

    const explicitOpts = buildOptsFromFlags(false, {
      'scrapecreators-stt': 'youtube-transcript'
    })
    expect(collectSttTargets(explicitOpts).filter((target) => target.service === 'scrapecreators')).toEqual([{
      service: 'scrapecreators',
      model: 'youtube-transcript',
      local: false
    }])

    const localOpts = buildOptsFromFlags(false, { 'all-local-stt': true })
    const localServices = collectSttTargets(localOpts).map((target) => target.service)
    expect(localServices).not.toContain('reverb')
    expect(localServices).toContain('whisper')
    expect(localServices).not.toContain('deepgram')
    expect(localServices).not.toContain('mistral')
  })

  test('source-aware --all-stt filters URL-only STT providers per media input', () => {
    const opts = buildOptsFromFlags(false, { 'all-stt': true })
    const localTargets = collectSttTargetsForSource(opts, { filePath: 'input/examples/video/local.mp4' })
    const youtubeTargets = collectSttTargetsForSource(opts, { url: 'https://www.youtube.com/watch?v=u1-WHqATSQU' })
    const directMediaTargets = collectSttTargetsForSource(opts, { url: 'https://example.com/media/interview.mp3' })
    const unsupportedStreamingTargets = collectSttTargetsForSource(opts, { url: 'https://vimeo.com/123456' })

    expect(localTargets.map((target) => target.service)).toContain('deepgram')
    expect(localTargets.map((target) => target.service)).toContain('mistral')
    expect(localTargets.map((target) => target.service)).not.toContain('supadata')
    expect(localTargets.map((target) => target.service)).not.toContain('scrapecreators')

    expect(youtubeTargets.map((target) => `${target.service}:${target.model}`)).toContain('supadata:auto')
    expect(youtubeTargets.map((target) => `${target.service}:${target.model}`)).toContain('scrapecreators:youtube-transcript')

    expect(directMediaTargets.map((target) => `${target.service}:${target.model}`)).toContain('supadata:auto')
    expect(directMediaTargets.map((target) => target.service)).not.toContain('scrapecreators')

    expect(unsupportedStreamingTargets.map((target) => target.service)).toContain('deepgram')
    expect(unsupportedStreamingTargets.map((target) => target.service)).not.toContain('supadata')
    expect(unsupportedStreamingTargets.map((target) => target.service)).not.toContain('scrapecreators')
  })

  test('explicit URL-only STT providers are not silently filtered for local media', () => {
    const opts = buildOptsFromFlags(false, {
      'supadata-stt': 'auto',
      'scrapecreators-stt': 'youtube-transcript'
    }, {}, new Set(['supadata-stt', 'scrapecreators-stt']))
    const combinedAllAndExplicit = buildOptsFromFlags(false, {
      'all-stt': true,
      'supadata-stt': 'auto'
    }, {}, new Set(['all-stt', 'supadata-stt']))

    expect(collectSttTargetsForSource(opts, { filePath: 'input/examples/video/local.mp4' })).toEqual([
      {
        service: 'supadata',
        model: 'auto',
        local: false
      },
      {
        service: 'scrapecreators',
        model: 'youtube-transcript',
        local: false
      }
    ])
    expect(collectSttTargetsForSource(combinedAllAndExplicit, { filePath: 'input/examples/video/local.mp4' }).map((target) => `${target.service}:${target.model}`)).toContain('supadata:auto')
  })

  test('mixed media batch items resolve different --all-stt target sets by source', () => {
    const opts = buildOptsFromFlags(false, { 'all-stt': true })
    const mixedBatchTargets = [
      collectSttTargetsForSource(opts, { filePath: 'input/examples/video/local.mp4' }),
      collectSttTargetsForSource(opts, { url: 'https://youtu.be/u1-WHqATSQU' })
    ]

    expect(mixedBatchTargets[0]?.map((target) => target.service)).not.toContain('scrapecreators')
    expect(mixedBatchTargets[1]?.map((target) => target.service)).toContain('scrapecreators')
  })
})
