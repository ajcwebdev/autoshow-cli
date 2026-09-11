import { describe, expect, test } from 'bun:test'
import { collectSttTargets } from '~/cli/commands/stt/stt-targets'
import { collectExplicitOcrTargets } from '~/cli/commands/text/ocr/ocr-targets'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { normalizeExtractGenericSelectorArgs, normalizeExtractGenericSelectorFlags } from './generic-selector-test-adapters'



describe('provider selection contracts', () => {
  test('extract rejects the retired Rev STT provider', () => {
    expect(() => normalizeExtractGenericSelectorFlags(
      { provider: ['rev=low_cost'] },
      new Set(['provider']),
      { media: true, document: false, article: false }
    )).toThrow('--provider rev does not apply to media extract inputs.')
  })

  test('extract generic provider selectors route to STT or OCR internal keys', () => {
    const mediaNormalized = normalizeExtractGenericSelectorFlags({
      provider: ['mistral=voxtral-mini-2602']
    }, new Set(['provider']), { media: true, document: false })
    const documentNormalized = normalizeExtractGenericSelectorFlags({
      provider: ['glm=glm-ocr']
    }, new Set(['provider']), { media: false, document: true })
    const grokDocumentNormalized = normalizeExtractGenericSelectorFlags({
      provider: ['grok=grok-4.3']
    }, new Set(['provider']), { media: false, document: true })
    const mixedDefaultNormalized = normalizeExtractGenericSelectorFlags({
      provider: ['mistral']
    }, new Set(['provider']), { media: true, document: true })
    const grokMixedDefaultNormalized = normalizeExtractGenericSelectorFlags({
      provider: ['grok']
    }, new Set(['provider']), { media: true, document: true })
    const localMixedNormalized = normalizeExtractGenericSelectorFlags({
      'all-local': true
    }, new Set(['all-local']), { media: true, document: true, article: true })

    expect(buildOptsFromFlags(mediaNormalized.flags, {}, mediaNormalized.explicitFlags).mistralSttModels).toEqual(['voxtral-mini-2602'])
    expect(buildOptsFromFlags(documentNormalized.flags, {}, documentNormalized.explicitFlags).glmOcrModels).toEqual(['glm-ocr'])
    expect(buildOptsFromFlags(grokDocumentNormalized.flags, {}, grokDocumentNormalized.explicitFlags).grokOcrModels).toEqual(['grok-4.3'])
    const mixedDefaultOpts = buildOptsFromFlags(mixedDefaultNormalized.flags, {}, mixedDefaultNormalized.explicitFlags)
    expect(mixedDefaultOpts.mistralSttModels).toEqual(['voxtral-mini-2602'])
    expect(mixedDefaultOpts.mistralOcrModels).toEqual(['mistral-ocr-2512'])
    const grokMixedDefaultOpts = buildOptsFromFlags(grokMixedDefaultNormalized.flags, {}, grokMixedDefaultNormalized.explicitFlags)
    expect(grokMixedDefaultOpts.grokSttModels).toEqual(['speech-to-text'])
    expect(grokMixedDefaultOpts.grokOcrModels).toEqual(['grok-4.3'])
    expect(localMixedNormalized.flags).toMatchObject({
      'all-local-stt': true,
      'all-local-ocr': true,
      'all-local-url': true
    })
    const localMixedOpts = buildOptsFromFlags(localMixedNormalized.flags, {}, localMixedNormalized.explicitFlags)
    expect(collectSttTargets(localMixedOpts).map((target) => target.service)).toContain('whisper')
    expect(collectExplicitOcrTargets(localMixedOpts).map((target) => target.service)).toEqual([
      'tesseract'
    ])
    expect(localMixedOpts.urlBackends).toEqual(['defuddle'])

    const articleNormalized = normalizeExtractGenericSelectorFlags({
      provider: ['firecrawl']
    }, new Set(['provider']), { media: false, document: false, article: true })
    expect(articleNormalized.flags['url-provider']).toBe('firecrawl')
    expect(articleNormalized.explicitFlags.has('url-provider')).toBe(true)
    expect(buildOptsFromFlags(articleNormalized.flags, {}, articleNormalized.explicitFlags).urlBackend).toBe('firecrawl')
    expect(() => normalizeExtractGenericSelectorFlags({
      provider: ['firecrawl=reader-v1']
    }, new Set(['provider']), { media: false, document: false, article: true })).toThrow('does not accept a model')

    const routeAwareDocumentArgs = normalizeExtractGenericSelectorArgs([
      'extract',
      'input/examples/document/1-document.pdf',
      '--provider',
      'glm=glm-ocr',
      '--price'
    ], { media: false, document: true })
    expect(routeAwareDocumentArgs).toEqual([
      '--glm-ocr',
      'glm-ocr',
      '--price'
    ])
    expect(normalizeExtractGenericSelectorArgs([
      'extract',
      'input/examples/document/1-document.pdf',
      '--provider',
      'grok=grok-4.3',
      '--price'
    ], { media: false, document: true })).toEqual([
      '--grok-ocr',
      'grok-4.3',
      '--price'
    ])
    expect(normalizeExtractGenericSelectorArgs([
      'extract',
      'https://ajc.pics/autoshow/examples/0-audio-short.mp3',
      '--provider=mistral=voxtral-mini-2602',
      '--price'
    ], { media: true, document: false })).toEqual([
      '--mistral-stt',
      'voxtral-mini-2602',
      '--price'
    ])
    expect(normalizeExtractGenericSelectorArgs([
      'extract',
      'input/examples/batch/2-urls.md',
      '--provider',
      'mistral'
    ], { media: true, document: true })).toEqual([
      '--mistral-stt',
      '--mistral-ocr'
    ])
    expect(normalizeExtractGenericSelectorArgs([
      'extract',
      'input/examples/batch/2-urls.md',
      '--provider',
      'grok'
    ], { media: true, document: true })).toEqual([
      '--grok-stt',
      '--grok-ocr'
    ])
    expect(normalizeExtractGenericSelectorArgs([
      'extract',
      'input/examples/batch/2-urls.md',
      '--all-local'
    ], { media: true, document: true, article: true })).toEqual([
      '--all-local-stt',
      '--all-local-ocr',
      '--all-local-url'
    ])
    expect(normalizeExtractGenericSelectorArgs([
      'extract',
      'https://article.test/story.html',
      '--provider',
      'firecrawl'
    ], { media: false, document: false, article: true })).toEqual([
      '--url-provider',
      'firecrawl'
    ])

    const routeAwareDocumentOpts = buildOptsFromFlags(documentNormalized.flags, {}, documentNormalized.explicitFlags, { flagOccurrences: documentNormalized.flagOccurrences })
    expect(routeAwareDocumentOpts.glmOcrModels).toEqual(['glm-ocr'])
    expect(routeAwareDocumentOpts.glmModels).toBeUndefined()

    expect(() => normalizeExtractGenericSelectorFlags({
      provider: ['mistral=mistral-ocr-2512']
    }, new Set(['provider']), { media: true, document: true })).toThrow('--provider mistral=<model> is ambiguous')
  })
})
