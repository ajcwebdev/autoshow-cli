import type { FetchUrlResult, LinksModelSource, LinksModelSourceKind, LinksRefreshFinding, LinksSelection, ModelRegistry } from '~/types'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { getFetchableDocumentationUrl } from './links-fetcher'

type RegistryService = {
  type: 'local' | 'api'
  catalogSourceUrl?: string | undefined
  models: Record<string, { pricingSourceUrl?: string | undefined }>
}

// A model whose ID no page on its provider's site spells out, with the reason. Without an entry here the refresh
// would report it on every run. Keys are `<step>/<service>/<model>`.
export const UNDOCUMENTED_MODEL_IDS: ReadonlyMap<string, string> = new Map<string, string>([
  ['tts/grok/grok-tts', 'xAI\'s TTS endpoint takes no model parameter; the name appears only in the site\'s embedded catalog JSON.'],
  ['tts/hume/octave-1', 'Hume selects Octave with a version field and its docs write "Octave 1".'],
  ['stt/scrapecreators/youtube-transcript', 'Registry label for the /v1/youtube/video/transcript endpoint, which has no model ID.'],
  ['extract/glm-reader/glm-reader', 'Registry label for Z.ai\'s /reader endpoint, which has no model ID.'],
  ['stt/mistral/voxtral-mini-2602', 'Mistral\'s model card renders the API name in the browser; its guides say voxtral-mini-latest.'],
  ['extract/mistral/mistral-ocr-4-0', 'Mistral\'s model card renders the API name in the browser; its guides say mistral-ocr-latest.'],
  ['extract/mistral/mistral-ocr-4-1', 'Mistral\'s model card renders the API name in the browser; its guides say mistral-ocr-latest.']
])

const parseUrl = (url: string): URL | undefined => {
  try {
    return new URL(getFetchableDocumentationUrl(url))
  } catch {
    return undefined
  }
}

// Two URLs cover the same page when they differ only by `www.`, a trailing slash, a markdown suffix, a query, or a
// fragment. `docs/pricing` is covered by a configured `docs/pricing.md.txt`.
export const getSourceCoverageKey = (url: string): string => {
  const parsed = parseUrl(url)
  if (!parsed) return url
  const path = parsed.pathname.replace(/\/+$/, '').replace(/\.(?:md\.txt|md|txt)$/i, '')
  return `${parsed.host.toLowerCase().replace(/^www\./, '')}${path}`
}

// `docs.mistral.ai` and `mistral.ai` are one provider's site. The last two labels are enough for every host the
// registry names; none sits under a multi-label public suffix.
export const getSiteDomain = (url: string): string | undefined =>
  parseUrl(url)?.host.toLowerCase().split('.').slice(-2).join('.')

// An `api.` host is a provider API that wants a key, and a links run only ever talks to documentation hosts.
const isDocumentationHost = (url: string): boolean => {
  const parsed = parseUrl(url)
  return parsed !== undefined && /^https?:$/.test(parsed.protocol) && !parsed.host.toLowerCase().startsWith('api.')
}

// The model registry already names, per model, the page its price came from and, per TTS service, the page its
// catalog came from. Those pages are what a price or model refresh has to re-read, so a links run fetches them
// without anyone copying them into a link config, where they had drifted apart from the registry.
export const collectModelSources = (registry: ModelRegistry = getModelRegistry()): LinksModelSource[] => {
  const sources = new Map<string, LinksModelSource>()
  const add = (rawUrl: string | undefined, kind: LinksModelSourceKind, model: LinksModelSource['models'][number]): void => {
    if (!rawUrl || !isDocumentationHost(rawUrl)) return
    const key = getSourceCoverageKey(rawUrl)
    const source = sources.get(key) ?? { url: rawUrl.replace(/#.*$/, ''), kinds: [], models: [] }
    if (!source.kinds.includes(kind)) source.kinds.push(kind)
    if (!source.models.some(entry => entry.step === model.step && entry.service === model.service && entry.model === model.model)) {
      source.models.push(model)
    }
    sources.set(key, source)
  }

  for (const [step, services] of Object.entries(registry as Record<string, Record<string, RegistryService>>)) {
    for (const [service, config] of Object.entries(services)) {
      if (config.type !== 'api') continue
      for (const [model, entry] of Object.entries(config.models)) {
        add(entry.pricingSourceUrl, 'pricing', { step, service, model })
        add(config.catalogSourceUrl, 'catalog', { step, service, model })
      }
    }
  }
  return [...sources.values()]
}

// Sources join a run that selects whole providers: every provider, or each `--provider` named without sections.
// A section-scoped, direct-URL, or input-file run fetches exactly what was asked for.
export const coversWholeProviders = (selection: LinksSelection): boolean =>
  !selection.directUrl && !selection.inputFilePath && selection.globalSections.length === 0 &&
  [...selection.serviceSelections.values()].every(sections => sections.length === 0)

export const selectModelSourceLinks = (
  selection: LinksSelection,
  links: readonly string[],
  sources: readonly LinksModelSource[]
): string[] => {
  if (!coversWholeProviders(selection)) return []
  const covered = new Set(links.map(getSourceCoverageKey))
  const selectedDomains = new Set(links.map(getSiteDomain))
  return sources
    .filter(source => !covered.has(getSourceCoverageKey(source.url)))
    .filter(source => selection.serviceSelections.size === 0 || selectedDomains.has(getSiteDomain(source.url)))
    .map(source => source.url)
}

// A pricing page names a model by its marketing name about a third of the time, so the ID is looked for on every
// page fetched from the same site as the model's declared sources, not on the source page alone.
export const collectModelDocumentationFindings = (
  selection: LinksSelection,
  fetchResults: readonly FetchUrlResult[],
  sources: readonly LinksModelSource[]
): LinksRefreshFinding[] => {
  if (!coversWholeProviders(selection)) return []
  const textByDomain = new Map<string, string[]>()
  for (const result of fetchResults) {
    const domain = getSiteDomain(result.sourceUrl)
    if (result.status !== 'success' || domain === undefined) continue
    textByDomain.set(domain, [...(textByDomain.get(domain) ?? []), result.markdownContent.replace(/\\_/g, '_').toLowerCase()])
  }

  const domainsByModel = new Map<string, { model: LinksModelSource['models'][number], sourceUrl: string, domains: Set<string> }>()
  for (const source of sources) {
    const domain = getSiteDomain(source.url)
    if (domain === undefined) continue
    for (const model of source.models) {
      const key = `${model.step}/${model.service}/${model.model}`
      const entry = domainsByModel.get(key) ?? { model, sourceUrl: source.url, domains: new Set<string>() }
      entry.domains.add(domain)
      domainsByModel.set(key, entry)
    }
  }

  const findings: LinksRefreshFinding[] = []
  for (const [key, { model, sourceUrl, domains }] of domainsByModel) {
    if (UNDOCUMENTED_MODEL_IDS.has(key)) continue
    const fetchedDomains = [...domains].filter(domain => textByDomain.has(domain))
    if (fetchedDomains.length === 0) continue
    const id = model.model.toLowerCase()
    if (fetchedDomains.some(domain => textByDomain.get(domain)!.some(text => text.includes(id)))) continue
    findings.push({
      sourceUrl,
      provider: model.service,
      section: model.step,
      status: 'model-undocumented',
      detail: `${model.model} appears on no ${fetchedDomains.join(' or ')} page fetched this run`
    })
  }
  return findings
}
