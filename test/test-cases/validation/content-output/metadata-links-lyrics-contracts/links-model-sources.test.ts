import { expect, test } from 'bun:test'
import type { FetchFn, FetchUrlResult, LinksModelSource, LinksRefreshMetadata, LinksSelection, ModelRegistry } from '~/types'
import {
  collectLinks,
  getLinksRefreshMetadataPath,
  runLinksWithArgv
} from '~/cli/commands/setup-and-utilities/links/define-links-command'
import {
  collectModelDocumentationFindings,
  collectModelSources,
  getSiteDomain,
  getSourceCoverageKey,
  selectModelSourceLinks,
  UNDOCUMENTED_MODEL_IDS
} from '~/cli/commands/setup-and-utilities/links/links-model-sources'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { linksTestOutputPath } from './shared'

const selection = (overrides: Partial<LinksSelection> = {}): LinksSelection => ({
  serviceSelections: new Map(),
  globalSections: [],
  refresh: true,
  ...overrides
})

const registry = {
  tts: {
    acme: {
      type: 'api',
      catalogSourceUrl: 'https://docs.acme.test/tts/models',
      models: {
        'acme-voice-2': { pricingSourceUrl: 'https://www.acme.test/pricing/#tts' },
        'acme-voice-1': { pricingSourceUrl: 'https://acme.test/pricing' }
      }
    },
    keyed: { type: 'api', models: { 'keyed-1': { pricingSourceUrl: 'https://api.keyed.test/v1/pricing?model=keyed-1' } } },
    local: { type: 'local', models: { 'local-1': { pricingSourceUrl: 'https://local.test/pricing' } } },
    unpriced: { type: 'api', models: { 'unpriced-1': {} } }
  }
} as unknown as ModelRegistry

const fetched = (sourceUrl: string, markdownContent: string, status: FetchUrlResult['status'] = 'success'): FetchUrlResult => ({
  sourceUrl,
  fetchUrl: sourceUrl,
  finalUrl: sourceUrl,
  status,
  content: `<!-- Source: ${sourceUrl} -->\n\n${markdownContent}`,
  markdownContent
})

test('coverage key ignores www, trailing slash, markdown suffix, query, and fragment, and site domain spans subdomains', () => {
  const variants = [
    'https://ai.acme.test/docs/pricing',
    'https://www.ai.acme.test/docs/pricing/',
    'https://ai.acme.test/docs/pricing.md',
    'https://ai.acme.test/docs/pricing.md.txt',
    'https://ai.acme.test/docs/pricing?hsLang=en#tts',
    'blob:https://ai.acme.test/docs/pricing'
  ]

  expect(new Set(variants.map(getSourceCoverageKey))).toEqual(new Set(['ai.acme.test/docs/pricing']))
  expect(getSourceCoverageKey('https://docs.acme.test/pricing.html')).toBe('docs.acme.test/pricing.html')
  expect([getSiteDomain('https://docs.acme.test/a'), getSiteDomain('https://acme.test/b')]).toEqual(['acme.test', 'acme.test'])
})

test('model sources merge one page named by several models and skip provider APIs, local services, and models without a source', () => {
  expect(collectModelSources(registry)).toEqual([
    {
      url: 'https://www.acme.test/pricing/',
      kinds: ['pricing'],
      models: [{ step: 'tts', service: 'acme', model: 'acme-voice-2' }, { step: 'tts', service: 'acme', model: 'acme-voice-1' }]
    },
    {
      url: 'https://docs.acme.test/tts/models',
      kinds: ['catalog'],
      models: [{ step: 'tts', service: 'acme', model: 'acme-voice-2' }, { step: 'tts', service: 'acme', model: 'acme-voice-1' }]
    }
  ])
})

test('model sources join only a run that selects whole providers, skip covered pages, and follow the selected sites', () => {
  const sources: LinksModelSource[] = [
    { url: 'https://acme.test/pricing', kinds: ['pricing'], models: [] },
    { url: 'https://docs.acme.test/tts/models', kinds: ['catalog'], models: [] },
    { url: 'https://other.test/pricing', kinds: ['pricing'], models: [] }
  ]
  const links = ['https://docs.acme.test/llms.txt', 'https://docs.acme.test/tts/models.md']

  expect(selectModelSourceLinks(selection(), links, sources)).toEqual(['https://acme.test/pricing', 'https://other.test/pricing'])
  expect(selectModelSourceLinks(selection({ serviceSelections: new Map([['acme', []]]) }), links, sources)).toEqual(['https://acme.test/pricing'])
  expect(selectModelSourceLinks(selection({ serviceSelections: new Map([['acme', ['tts']]]) }), links, sources)).toEqual([])
  expect(selectModelSourceLinks(selection({ globalSections: ['tts'] }), links, sources)).toEqual([])
  expect(selectModelSourceLinks(selection({ directUrl: 'https://docs.acme.test/llms.txt' }), links, sources)).toEqual([])
  expect(selectModelSourceLinks(selection({ inputFilePath: 'urls.md' }), links, sources)).toEqual([])
})

test('a model ID is looked for on every fetched page of its sites, and only a whole-provider run reports it missing', () => {
  const sources = collectModelSources(registry)
  const results = [
    fetched('https://www.acme.test/pricing/', 'Acme Voice 2 costs $1'),
    fetched('https://docs.acme.test/guide.md', 'Set `model` to ACME-VOICE-2.'),
    fetched('https://docs.acme.test/broken.md', 'acme-voice-1', 'failed')
  ]

  expect(collectModelDocumentationFindings(selection(), results, sources)).toEqual([{
    sourceUrl: 'https://www.acme.test/pricing/',
    provider: 'acme',
    section: 'tts',
    status: 'model-undocumented',
    detail: 'acme-voice-1 appears on no acme.test page fetched this run'
  }])
  expect(collectModelDocumentationFindings(selection({ globalSections: ['tts'] }), results, sources)).toEqual([])
  // Nothing from the model's site was fetched, so there is nothing to conclude.
  expect(collectModelDocumentationFindings(selection(), [fetched('https://elsewhere.test/a.md', 'x')], sources)).toEqual([])
})

test('every recorded undocumented model still exists in the registry and gives its reason', () => {
  const known = new Set(collectModelSources().flatMap(source => source.models.map(model => `${model.step}/${model.service}/${model.model}`)))

  for (const [key, reason] of UNDOCUMENTED_MODEL_IDS) {
    expect(known.has(key), `${key} is no longer a registry model with a documentation source`).toBe(true)
    expect(reason.length).toBeGreaterThan(20)
  }
})

test('the registry names documentation pages only, each reachable as an http URL', () => {
  const sources = collectModelSources(getModelRegistry())

  expect(sources.length).toBeGreaterThan(20)
  for (const source of sources) {
    const parsed = new URL(source.url)
    expect(parsed.protocol).toMatch(/^https?:$/)
    expect(parsed.host.startsWith('api.')).toBe(false)
    expect(parsed.hash).toBe('')
    expect(source.models.length).toBeGreaterThan(0)
  }
})

test('links --refresh of a whole provider fetches its model sources, labels them, and reports a dead one', async () => {
  const outputPath = linksTestOutputPath('refresh-model-sources')
  const sidecarPath = getLinksRefreshMetadataPath(outputPath)
  const zyteLinks = collectLinks(new Map([['zyte', []]]), [])
  const zyteSite = getSiteDomain(zyteLinks[0]!)
  const livePricing = `https://pricing-docs.${zyteSite}/model-source-live`
  const deadPricing = `https://pricing-docs.${zyteSite}/model-source-dead`
  const modelSources: LinksModelSource[] = [
    { url: livePricing, kinds: ['pricing'], models: [{ step: 'extract', service: 'zyte', model: 'zyte-model-x' }] },
    { url: deadPricing, kinds: ['pricing', 'catalog'], models: [{ step: 'extract', service: 'zyte', model: 'zyte-model-y' }] },
    { url: 'https://unrelated-site.test/pricing', kinds: ['pricing'], models: [{ step: 'tts', service: 'other', model: 'other-1' }] },
    { url: zyteLinks[0]!, kinds: ['catalog'], models: [{ step: 'extract', service: 'zyte', model: 'zyte-model-x' }] }
  ]
  const requested: string[] = []
  const fetchImpl: FetchFn = async (input) => {
    const url = String(input)
    requested.push(url)
    if (url === deadPricing) return new Response('missing', { status: 404, statusText: 'Not Found' })
    return new Response(url === livePricing ? 'Pricing for zyte-model-x' : `# Page ${url}`, { headers: { 'content-type': 'text/markdown' } })
  }

  await runLinksWithArgv(
    ['bun', 'src/cli/create-cli.ts', 'links', '--refresh', '--provider', 'zyte'],
    { outputPath, fetchImpl, modelSources }
  )
  const metadata = JSON.parse(await Bun.file(sidecarPath).text()) as LinksRefreshMetadata

  expect(requested).toEqual([...zyteLinks, livePricing, deadPricing])
  expect(metadata.selection.urls).toEqual([...zyteLinks, livePricing, deadPricing])
  expect(metadata.selection.modelSourceUrls).toEqual([livePricing, deadPricing])
  expect(metadata.links.find(link => link.sourceUrl === livePricing)?.modelSource).toEqual(['pricing'])
  expect(metadata.links.find(link => link.sourceUrl === zyteLinks[0])?.modelSource).toEqual(['catalog'])
  expect(metadata.links.find(link => link.sourceUrl === zyteLinks[1])?.modelSource).toBeUndefined()
  expect(metadata.findings).toEqual([
    { sourceUrl: deadPricing, provider: 'Model registry', section: 'SOURCES', status: 'http-error', detail: 'HTTP 404 Not Found' },
    { sourceUrl: deadPricing, provider: 'zyte', section: 'extract', status: 'model-undocumented', detail: `zyte-model-y appears on no ${zyteSite} page fetched this run` }
  ])
})

test('a section-scoped refresh and a plain links run fetch no model sources', async () => {
  const modelSources: LinksModelSource[] = [{ url: 'https://docs.zyte.com/model-source', kinds: ['pricing'], models: [] }]
  const fetchImpl: FetchFn = async (input) => new Response(`# ${String(input)}`, { headers: { 'content-type': 'text/markdown' } })
  const scopedPath = linksTestOutputPath('refresh-model-sources-scoped')
  const plainPath = linksTestOutputPath('model-sources-plain')

  await runLinksWithArgv(['bun', 'src/cli/create-cli.ts', 'links', '--refresh', '--provider', 'zyte', 'url'], { outputPath: scopedPath, fetchImpl, modelSources })
  const plain = await runLinksWithArgv(['bun', 'src/cli/create-cli.ts', 'links', '--provider', 'zyte'], { outputPath: plainPath, fetchImpl, modelSources })
  const scoped = JSON.parse(await Bun.file(getLinksRefreshMetadataPath(scopedPath)).text()) as LinksRefreshMetadata

  expect(scoped.selection.modelSourceUrls).toEqual([])
  expect(plain.urlCount).toBe(collectLinks(new Map([['zyte', []]]), []).length)
})
