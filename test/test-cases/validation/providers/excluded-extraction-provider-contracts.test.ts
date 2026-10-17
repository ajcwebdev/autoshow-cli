import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import type { HtmlArticleBackend, ResumeTarget, SttTarget } from '~/types'
import { getModelRegistry, getExtractPricing, getSttCost } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { HOSTED_PROVIDER_ENV_CHECKS } from '~/cli/commands/setup-and-utilities/setup/hosted-provider-config'
import { URL_ARTICLE_BACKENDS } from '~/cli/commands/command-shared/extract-routing/provider-registry'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectSttTargets } from '~/cli/commands/stt/stt-targets'
import { normalizeExtractGenericSelectorFlags } from '~/cli/flags/service-selector-normalization/extract-selectors'
import { loadConfig } from '~/cli/commands/setup-and-utilities/config-command/config-loader'
import { URL_ARTICLE_PROVIDER_ADAPTERS, runUrlArticleProvider } from '~/cli/commands/text/url/url-provider-registry'
import { resolveUrlArticleBackendPlan } from '~/cli/commands/text/url/url-targets'
import { runUrlArticleBackendPlan, parseStoredProviderStates } from '~/cli/commands/text/url/url-run-state'
import { resolveUrlArticleResumePlan } from '~/cli/commands/setup-and-utilities/resume/extract/url-resume'
import { dispatchStt } from '~/cli/commands/stt/run-stt/dispatch'
import { ensureSttTargetSetup } from '~/cli/commands/stt/bootstrap'
import { buildSttEstimatesForTargets } from '~/cli/commands/pricing-orchestration/aggregate-pricing/stt-estimates'
import { priceSttTarget } from '~/cli/commands/setup-and-utilities/resume/extract/stt-resume'
import { prepareHtmlArticle } from '~/cli/commands/sources/download/document/prepare-html-article'
import { writePipelineItemRecords, PIPELINE_MANIFEST_FILE } from '~/cli/commands/command-shared/pipeline-manifest'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { expectUnknownFlag } from '../../../test-utils/cli-assertions'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const dirs = setupContractSuiteLifecycle({ envKeys: [], tempPrefix: 'autoshow-excluded-extract-' })
const excludedUrls: HtmlArticleBackend[] = ['firecrawl', 'supadata', 'glm-reader']
const excludedStt = ['happyscribe', 'supadata'] as const
const opts = () => buildOptsFromFlags({})
const sttTarget = (service: typeof excludedStt[number]): SttTarget => ({ service, model: 'auto', local: false })
const urlState = (service: HtmlArticleBackend, status: 'succeeded' | 'missing' | 'failed' | 'running') => ({ service, model: service, status, attempts: 1, artifactDir: `providers/${service}`, metadata: { originalReceipt: 'retained' } })

test('five excluded tuples stay outside the active 128-model inventory, credentials and expansion', () => {
  const registry = getModelRegistry()
  expect(Object.fromEntries(Object.entries(registry).map(([category, services]) => [category, Object.values(services).reduce((n, service) => n + Object.keys(service.models).length, 0)]))).toEqual({ stt: 31, extract: 33, llm: 23, tts: 7, image: 13, music: 4, video: 17 })
  expect(URL_ARTICLE_BACKENDS).toEqual(['defuddle', 'spider', 'zyte'])
  expect(Object.keys(URL_ARTICLE_PROVIDER_ADAPTERS)).toEqual(['defuddle', 'spider', 'zyte'])
  for (const provider of excludedStt) expect(registry.stt[provider]).toBeUndefined()
  for (const provider of excludedUrls) expect(registry.extract[provider]).toBeUndefined()
  for (const provider of ['firecrawl', ...excludedStt]) expect(HOSTED_PROVIDER_ENV_CHECKS.some(row => row.providerId === provider)).toBe(false)
  expect(HOSTED_PROVIDER_ENV_CHECKS.find(row => row.providerId === 'glm')?.stages).toEqual(['write', 'ocr'])
  expect(Object.keys(registry.llm['glm']!.models)).not.toHaveLength(0)
  expect(Object.keys(registry.extract['glm']!.models)).not.toHaveLength(0)
  const all = collectSttTargets(buildOptsFromFlags({ 'all-stt': true }))
  expect(all.some(target => excludedStt.includes(target.service as typeof excludedStt[number]))).toBe(false)
  const decision = readFileSync('docs/adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md', 'utf8')
  const section = decision.split('<!-- excluded-extraction-providers:start -->')[1]!.split('<!-- excluded-extraction-providers:end -->')[0]!
  expect([...section.matchAll(/`(?:extract|stt)\//g)]).toHaveLength(5)
})

test('generic selectors, obsolete flags and direct old runtime settings fail locally without substitution', async () => {
  const calls = installMockFetch(() => { throw new Error('Unexpected provider call') })
  for (const provider of [...excludedStt, ...excludedUrls]) {
    expect(() => normalizeExtractGenericSelectorFlags({ provider }, new Set(['provider']), [{ name: 'provider', raw: '--provider', value: provider, known: true }], { media: true, article: true, document: true })).toThrow(/provider|unsupported/i)
  }
  for (const provider of excludedStt) {
    expectUnknownFlag(['extract', 'missing.wav', `--${provider}-stt`, 'auto'], `--${provider}-stt`)
    expect(() => buildOptsFromFlags({ [`${provider}-stt`]: 'auto' })).toThrow(/excluded|unsupported/i)
    expect(() => collectSttTargets({ [`${provider}SttModels`]: ['auto'] } as never)).toThrow(/excluded/i)
  }
  for (const flag of ['stt-organization-id', 'stt-chunk-size']) expectUnknownFlag(['extract', 'missing.wav', `--${flag}`, '1'], `--${flag}`)
  for (const provider of excludedUrls) {
    expect(() => buildOptsFromFlags({ 'url-provider': provider })).toThrow(/provider|invalid/i)
    expect(() => resolveUrlArticleBackendPlan('input.html', { urlBackend: provider, urlBackendExplicit: true, urlBackends: undefined })).toThrow(/excluded/i)
    await expect(runUrlArticleProvider(provider, 'https://example.test/article', undefined)).rejects.toThrow(/excluded/i)
    await expect(prepareHtmlArticle('input.html', await dirs.make(), provider)).rejects.toThrow(/excluded/i)
  }
  expect(calls).toHaveLength(0)
})

test('obsolete saved config rejects locally while GLM write and OCR configuration remain valid', async () => {
  const calls = installMockFetch(() => { throw new Error('Unexpected provider call') })
  const path = join(await dirs.make(), 'config.json')
  for (const stt of [{ happyscribeStt: ['auto'] }, { supadataStt: ['auto'] }, { organizationId: 'old-org' }, { chunkSize: 100 }, { supadataLang: 'en' }]) {
    await Bun.write(path, JSON.stringify({ defaults: { extract: { stt } } }))
    await expect(loadConfig(path)).rejects.toThrow(/excluded/i)
  }
  for (const provider of excludedUrls) {
    await Bun.write(path, JSON.stringify({ defaults: { extract: { url: { provider } } } }))
    await expect(loadConfig(path)).rejects.toThrow()
  }
  await Bun.write(path, JSON.stringify({ defaults: { llm: { glm: [Object.keys(getModelRegistry().llm['glm']!.models)[0]] }, extract: { ocr: { glmOcr: [Object.keys(getModelRegistry().extract['glm']!.models)[0]] } } } }))
  expect((await loadConfig(path)).defaults?.llm?.glm).toHaveLength(1)
  expect(calls).toHaveLength(0)
})

test('retained excluded STT cannot reach setup, pricing duration lookup or provider dispatch', async () => {
  const calls = installMockFetch(() => { throw new Error('Unexpected provider call') })
  for (const provider of excludedStt) {
    const target = sttTarget(provider)
    await expect(ensureSttTargetSetup(target)).rejects.toThrow(/excluded/i)
    await expect(buildSttEstimatesForTargets('https://example.test/recording.mp3', {}, [target])).rejects.toThrow(/excluded/i)
    await expect(dispatchStt(target, 'missing.wav', await dirs.make(), 0, {})).rejects.toThrow(/excluded/i)
  }
  expect(calls).toHaveLength(0)
})

test('stored URL identities and successful receipts remain readable; incomplete excluded resume stops locally', () => {
  const calls = installMockFetch(() => { throw new Error('Unexpected provider call') })
  for (const provider of excludedUrls) {
    const completed = urlState(provider, 'succeeded')
    const metadata = { providerStates: [completed] }
    expect(parseStoredProviderStates(metadata)).toEqual([completed])
    expect(resolveUrlArticleResumePlan(metadata)).toMatchObject({ requestedBackends: [provider], backendsToRun: [] })
    expect(resolveUrlArticleResumePlan(metadata, [{ service: 'spider', model: 'spider' }])).toMatchObject({ requestedBackends: [provider, 'spider'], backendsToRun: ['spider'] })
    for (const status of ['missing', 'failed', 'running'] as const) {
      expect(() => resolveUrlArticleResumePlan({ providerStates: [urlState(provider, status)] })).toThrow(/incomplete.*excluded/)
      expect(() => resolveUrlArticleResumePlan({ providerStates: [urlState(provider, status)] }, [{ service: 'zyte', model: 'zyte' }])).toThrow(/will not substitute/)
    }
    expect(metadata.providerStates).toEqual([completed])
  }
  expect(calls).toHaveLength(0)
})

test('stored excluded STT price resume preserves completed manifests and rejects pending work before network', async () => {
  const calls = installMockFetch(() => { throw new Error('Unexpected provider call') })
  for (const service of excludedStt) {
    for (const status of ['succeeded', 'missing'] as const) {
      const dir = await dirs.make()
      await writePipelineItemRecords(dir, 'extract', 'single', [{ outputDir: dir, step1: { url: 'https://example.test/recording.mp3', title: 'Retained source', duration: 60 }, requestedProviders: [sttTarget(service)], providerStates: [{ ...sttTarget(service), status, attempts: 1 }], completionStatus: status === 'succeeded' ? 'full' : 'incomplete', cost: { actual: { totalCost: 7.125, steps: [{ step: 'stt', provider: service, model: 'auto', cost: 7.125, costSource: 'provider_quote' }] } } }], { extractRoute: 'media' })
      const path = join(dir, PIPELINE_MANIFEST_FILE)
      const before = await Bun.file(path).text()
      const target: ResumeTarget = { kind: 'extract', extractRoute: 'media', scope: 'single', dir, manifestPath: path }
      if (status === 'succeeded') expect((await priceSttTarget(target, opts())).steps).toEqual([])
      else await expect(priceSttTarget(target, opts())).rejects.toThrow(/incomplete.*no longer.*active registry/)
      expect(await Bun.file(path).text()).toBe(before)
    }
  }
  expect(calls).toHaveLength(0)
})

test('historical rates and recorded provider charges remain readable without becoming live requests', () => {
  expect(getSttCost('happyscribe', 'auto')).toEqual({ costPerHourCents: 60 })
  expect(getExtractPricing('firecrawl', 'firecrawl')).toEqual({ costPer1kPagesCents: 83 })
  expect(getExtractPricing('supadata', 'supadata')).toEqual({ costPer1kPagesCents: 1000 })
  expect(getExtractPricing('glm-reader', 'glm-reader')).toEqual({ costPer1kPagesCents: 1000 })
  expect(computeActualCosts({ step1: { duration: '00:01:00' } as never, step2: { transcriptionService: 'happyscribe', transcriptionModel: 'auto', processingTime: 1, tokenCount: 1, billing: { totalCost: 7.125, source: 'provider_quote' } } }).steps[0]).toMatchObject({ provider: 'happyscribe', cost: 7.125, costSource: 'provider_quote' })
})

test('a failed Defuddle extraction never invokes an automatic hosted replacement', async () => {
  const calls = installMockFetch(() => { throw new Error('Unexpected provider call') })
  const original = URL_ARTICLE_PROVIDER_ADAPTERS.defuddle.run
  URL_ARTICLE_PROVIDER_ADAPTERS.defuddle.run = async () => { throw new Error('Deliberately invalid extracted article') }
  try {
  const source = 'https://example.test/article'
  const plan = resolveUrlArticleBackendPlan(source, { urlBackend: 'defuddle', urlBackendExplicit: true, urlBackends: undefined })
  expect(await runUrlArticleBackendPlan(source, plan, { urlRequestAttempts: 1, urlRequestTimeoutMs: 100, urlProviderConcurrency: 1 }, { dpi: 300, languages: 'eng', outputFormat: 'text' })).toMatchObject([{ status: 'failed', backend: 'defuddle', message: expect.stringContaining('Deliberately invalid extracted article') }])
  await expect(prepareHtmlArticle(source, await dirs.make(), 'defuddle', undefined, { requestAttempts: 1, timeoutMs: 100 })).rejects.toThrow('Deliberately invalid extracted article')
  expect(calls).toHaveLength(0)
  } finally {
    URL_ARTICLE_PROVIDER_ADAPTERS.defuddle.run = original
  }
})
