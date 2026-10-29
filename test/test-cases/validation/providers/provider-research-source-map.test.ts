import { describe, expect, test } from 'bun:test'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { MODEL_SELECTOR_FREE_SERVICES } from '~/cli/commands/setup-and-utilities/models/supported-model-sources'
import { getStep2ProviderEntries, collectStep2ProviderSelections, collectUrlArticleTargets } from '~/cli/commands/command-shared/extract-routing/provider-registry'
import { HOSTED_OCR_ADAPTERS, hostedOcrAdapterForService } from '~/cli/commands/text/ocr/hosted-ocr-adapters'
import { buildExtractionOptionsForTarget, collectExplicitOcrTargets } from '~/cli/commands/text/ocr/ocr-targets'
import { getUrlArticleProviderAdapter } from '~/cli/commands/text/url/url-provider-registry'
import { isHtmlArticleBackend } from '~/cli/commands/text/url/url-targets'
import { collectSttTargets } from '~/cli/commands/stt/stt-targets'
import { readStoredYoutubeCaptionSuccess } from '~/cli/commands/text/url/url-services/youtube-captions/youtube-captions'
import { normalizeExtractGenericSelectorFlags } from '~/cli/flags/service-selector-normalization/extract-selectors'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { ocrRegistry } from '../../../test-runner/price-commands/registry/ocr'
import { sttRegistry } from '../../../test-runner/price-commands/registry/stt'
import { urlRegistry } from '../../../test-runner/price-commands/registry/url'
import { writeMultiProviderManifestFixture } from '../../../test-utils/manifest-helpers'
import { withLocalTestDir } from '../../../test-utils/temp-dirs'
import type { ExtractionOptions, ExtractSelectorInputRoutes, Step2Command } from '~/types'

const providerOptions = (provider: string, workflow: Step2Command) => {
  const routes: ExtractSelectorInputRoutes = {
    media: workflow === 'stt', document: workflow === 'ocr', article: workflow === 'url'
  }
  const normalized = normalizeExtractGenericSelectorFlags({ provider: [provider] }, new Set(['provider']), [
    { name: 'provider', raw: '--provider', value: provider, known: true }
  ], routes)
  return buildOptsFromFlags(normalized.flags, {}, normalized.explicitFlags)
}

describe('provider research source map: executing behavior without provider calls', () => {
  test('bare-provider resolution follows current costs and eligibility rather than a stored description or first ID', () => {
    const service = getModelRegistry().extract['openai']!
    const original = service.models
    const [first, second] = Object.entries(original)
    expect(first).toBeDefined()
    expect(second).toBeDefined()
    const [firstId, firstModel] = first!
    const [secondId, secondModel] = second!
    try {
      service.models = {
        [firstId]: { ...firstModel, costPerMInputTokensCents: 1, costPerMOutputTokensCents: 1,
          lifecycle: { status: 'active', defaultEligible: false, allExpansionEligible: true } },
        [secondId]: { ...secondModel, costPerMInputTokensCents: 1000, costPerMOutputTokensCents: 1000,
          lifecycle: { status: 'active', defaultEligible: true, allExpansionEligible: true } }
      }
      expect(resolveCheapestModelForFlag('openai-ocr')).toBe(secondId)
      expect(collectExplicitOcrTargets(providerOptions('openai', 'ocr'))).toEqual([{ service: 'openai', model: secondId }])
      service.models[firstId]!.lifecycle = { status: 'active', defaultEligible: true, allExpansionEligible: true }
      expect(resolveCheapestModelForFlag('openai-ocr')).toBe(firstId)
      expect(collectExplicitOcrTargets(providerOptions('openai', 'ocr'))).toEqual([{ service: 'openai', model: firstId }])
    } finally {
      service.models = original
    }
  })

  test('hosted OCR selections bind to the actual dispatch descriptors, while Tesseract is a local registry exception', () => {
    const registry = getModelRegistry()
    const hosted = getStep2ProviderEntries('ocr').filter(entry => entry.selection.type === 'models')
    expect(hosted.map(entry => entry.targetService).sort()).toEqual(HOSTED_OCR_ADAPTERS.map(adapter => adapter.service).sort())
    for (const entry of hosted) {
      const options = buildOptsFromFlags({ [entry.flagName]: true })
      const [target] = collectExplicitOcrTargets(options)
      expect(target).toBeDefined()
      if (!target || target.service === 'tesseract') throw new Error('Expected a hosted selection')
      const adapter = hostedOcrAdapterForService(target.service)
      // These selectors inspect model fields only; neither building options nor selecting a descriptor invokes it.
      const selected = buildExtractionOptionsForTarget({ dpi: 300 } as ExtractionOptions, target)
      expect(adapter.selectModel(selected)).toBe(target.model)
      expect(registry.extract[target.service]?.models[target.model]).toBeDefined()
      expect(typeof adapter.request).toBe('function')
    }
    expect(collectExplicitOcrTargets(providerOptions('tesseract', 'ocr'))).toEqual([{ service: 'tesseract', model: 'tesseract' }])
    expect(registry.extract['tesseract']).toBeUndefined()
    expect(() => providerOptions('tesseract=tesseract', 'ocr')).toThrow('does not accept a model')
  })

  test('selector-free URL services execute fixed operation identities and are not hosted OCR models', () => {
    const services = getStep2ProviderEntries('url').map(entry => entry.targetService)
    expect([...MODEL_SELECTOR_FREE_SERVICES.extract].sort()).toEqual([...services].sort())
    for (const service of services) {
      if (!isHtmlArticleBackend(service)) throw new Error('Expected an active URL backend')
      const [target] = collectUrlArticleTargets(providerOptions(service, 'url'))
      expect(target).toEqual({ service, model: service })
      expect(getModelRegistry().extract[service]?.models[service]).toBeDefined()
      expect(HOSTED_OCR_ADAPTERS.map(adapter => adapter.service)).not.toContain(service)
      expect(getUrlArticleProviderAdapter(service)).toBeDefined()
      expect(() => providerOptions(`${service}=research-fixture-invalid-model`, 'url')).toThrow('does not accept a model')
    }
    expect(collectUrlArticleTargets(buildOptsFromFlags({ 'all-local-url': true }))).toEqual([{ service: 'defuddle', model: 'defuddle' }])
  })

  test('public STT provider aliases and caption retrieval retain their actual workflow identities', async () => {
    for (const [provider, service] of [['gemini', 'gemini-stt'], ['openai', 'openai-stt']] as const) {
      const [target] = collectSttTargets(providerOptions(provider, 'stt'))
      expect(target?.service).toBe(service)
      expect(getModelRegistry().stt[service]?.models[target!.model]).toBeDefined()
      expect(getModelRegistry().stt[provider]).toBeUndefined()
    }
    const captionOptions = buildOptsFromFlags({ 'youtube-captions': true })
    expect(captionOptions.youtubeCaptions).toBe(true)
    // Caption reuse is resolved before ordinary STT dispatch; its fallback targets are still normal STT engines.
    expect(collectSttTargets(captionOptions).some(target => target.service === 'youtube-captions')).toBe(false)
    await withLocalTestDir('provider-research-caption', async directory => {
      await writeMultiProviderManifestFixture(directory, {
        command: 'extract', extractRoute: 'media',
        providerMetadata: { transcriptionService: 'youtube-captions', transcriptionModel: 'subtitle-track', tokenCount: 0 },
        providers: [{
          dir: 'youtube-captions-subtitle-track', provider: 'youtube-captions', model: 'subtitle-track',
          processingTime: 0,
          result: { text: 'fixture caption', segments: [{ start: '00:00:00.000', end: '00:00:01.000', text: 'fixture caption' }] }
        }]
      })
      const caption = await readStoredYoutubeCaptionSuccess(directory)
      expect(caption?.target.service).toBe('youtube-captions')
      expect(caption?.target.model).toBe('subtitle-track')
    })
    expect(MODEL_SELECTOR_FREE_SERVICES.stt).toContain('youtube-captions')
    expect(() => providerOptions('youtube-captions', 'stt')).toThrow('does not apply')
    expect(collectSttTargets(providerOptions('scrapecreators=youtube-transcript', 'stt'))[0]?.service).toBe('scrapecreators')
  })

  test('mapped extract price commands route through current selectors even when their test directory names another workflow', () => {
    const groups = [
      ...ocrRegistry.map(entry => ({ entry, workflow: 'ocr' as const })),
      ...sttRegistry.filter(entry => entry.args[1] === 'extract').map(entry => ({ entry, workflow: 'stt' as const })),
      ...urlRegistry.map(entry => ({ entry, workflow: entry.args.includes('scrapecreators=youtube-transcript') ? 'stt' as const : 'url' as const }))
    ]
    const exercised = new Set<Step2Command>()
    for (const { entry, workflow } of groups) {
      expect(entry.args).toContain('--price')
      const index = entry.args.indexOf('--provider')
      if (index < 0) continue // The local omitted-provider/default route is distinct from explicit hosted mappings.
      const selector = entry.args[index + 1]!
      const options = providerOptions(selector, workflow)
      const selections = collectStep2ProviderSelections(workflow, options)
      expect(selections).toHaveLength(1)
      const selected = selections[0]!
      expect(selected.step).toBe(workflow)
      const separator = selector.indexOf('=')
      if (separator >= 0) expect(selected.model).toBe(selector.slice(separator + 1))
      const registry = getModelRegistry()[workflow === 'ocr' || workflow === 'url' ? 'extract' : 'stt']
      expect(registry[selected.targetService]?.models[selected.model]).toBeDefined()
      exercised.add(workflow)
    }
    expect([...exercised].sort()).toEqual(['ocr', 'stt', 'url'])
    const retrieval = urlRegistry.find(entry => entry.args.includes('scrapecreators=youtube-transcript'))!
    expect(retrieval.selector).toContain('/text/url/')
    expect(collectStep2ProviderSelections('stt', providerOptions('scrapecreators=youtube-transcript', 'stt'))[0]?.step).toBe('stt')
  })
})
