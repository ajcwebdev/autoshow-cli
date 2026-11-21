import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { buildMediaDashboard, discoverMediaRuns } from '../../../../.codex/skills/consensus/scripts/shared/build_media_dashboard'
import { buildSupportedDashboardModel } from '../../../../.codex/skills/consensus/scripts/shared/dashboard_supported_view'
import { supportedDashboardProviderKeys } from '../../../../.codex/skills/consensus/scripts/shared/dashboard_model_support'
import { renderTabPanel } from '../../../../.codex/skills/consensus/scripts/shared/dashboard_client.js'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'
import { withTempDir } from '../../../test-utils/temp-dirs'

type Provider = {
  key: string
  ms: number | null
  cents: number | null
  source?: string
  file?: string
  files?: string[]
  qualityScore?: number
  humanQualityScore?: number
}

// Fixture rows mirror the consensus `provider-comparison-report.json` provider groups and canonical manifest metadata.
const writeImageRun = async (root: string, runName: string, prompt: string, providers: Provider[], options: { evaluation?: boolean } = {}): Promise<void> => {
  const runDir = join(root, runName)
  await writeSingleManifestFixture(runDir, 'image', {
    input: prompt,
    completionStatus: 'full',
    image: providers.map(provider => {
      const [service, model] = provider.key.split('/') as [string, string]
      const files = provider.files ?? (provider.file ? [provider.file] : [])
      return { imageService: service, imageModel: model, processingTime: provider.ms ?? undefined, imageCount: files.length, imageFileNames: files, imageFileSize: 1, imageWidth: undefined, imageHeight: undefined, requestMode: 'generation' }
    }),
    cost: { actual: { totalCost: 0, steps: providers.filter(provider => provider.source).map(provider => {
      const [service, model] = provider.key.split('/') as [string, string]
      return { step: 'image', provider: service, model, cost: provider.cents, costSource: provider.source }
    }) } }
  })
  await Bun.write(join(runDir, 'provider-comparison-report.json'), JSON.stringify({
    schemaVersion: 1,
    category: 'image',
    providerGroups: { service: { count: providers.length, providers: providers.map(provider => ({
      providerKey: provider.key, provider: provider.key, group: 'service', processingTimeMs: provider.ms, costCents: provider.cents,
      metrics: { qualityScore: provider.qualityScore, humanQualityScore: provider.humanQualityScore },
    })) } }
  }))
  await Bun.write(join(runDir, 'provider-comparison-report.md'), '# Report\n')
  if (options.evaluation !== false) await Bun.write(join(runDir, 'consensus-evaluation.txt'), 'Evaluation\n')
}

const groupRows = (model: ReturnType<typeof buildMediaDashboard>['dashboardModel']) => model.groups.flatMap(group => group.providers)

describe('generation-media benchmark dashboard tabs', () => {
  test('aggregates per-model means, coverage, totals and cost basis across retained runs without inventing quality', async () => {
    await withTempDir('autoshow-media-dashboard-', async dir => {
      const root = join(dir, 'benchmarks', 'image')
      await writeImageRun(root, '2026-11-19_a_image-gen', 'first prompt', [
        { key: 'gemini/nano', ms: 10_000, cents: 3, source: 'registry_fallback', file: 'generated-image-gemini-nano.jpg' },
        { key: 'openai/flare', ms: 20_000, cents: 7, source: 'provider_usage', file: 'generated-image-openai-flare.png' },
        { key: 'grok/image', ms: 10_000, cents: 4, source: 'provider_usage', file: 'generated-image-grok-image.jpg' },
      ])
      await writeImageRun(root, '2026-11-19_b_image-gen', 'x'.repeat(200), [
        { key: 'gemini/nano', ms: 14_000, cents: 3, source: 'registry_fallback', file: 'generated-image-gemini-nano.jpg' },
        { key: 'openai/flare', ms: 30_000, cents: 9, source: 'provider_usage', file: 'generated-image-openai-flare.png' },
      ], { evaluation: false })
      await Bun.write(join(root, '2026-11-19_combined-provider-comparison-report.md'), '# Combined\n')
      // A directory without both evidence files is not a retained run.
      await Bun.write(join(root, 'incomplete-run', 'manifest.json'), '{}')

      expect(discoverMediaRuns(root)).toEqual(['2026-11-19_a_image-gen', '2026-11-19_b_image-gen'])
      const { dashboardModel: model, samples } = buildMediaDashboard('image', root, 'fixed-time')
      expect(samples).toHaveLength(5)
      expect(model).toMatchObject({ title: 'Image benchmark results', category: 'image', generatedAt: 'fixed-time' })
      expect(model.groups.map(group => group.key)).toEqual(['service'])
      expect(model.groups[0]).toMatchObject({ showPerRun: false, evidenceColumns: ['Cost basis', 'Total cost'], metricDirections: { quality: 'higher', speed: 'lower', cost: 'lower' } })

      const rows = Object.fromEntries(groupRows(model).map(row => [row.providerKey, row]))
      expect(rows['gemini/nano']).toMatchObject({ model: 'nano', coverage: '2/2', speed: { display: '12.00s', value: 12, rank: 2 }, cost: { display: '$0.0300', value: 0.03, rank: 1 }, evidence: ['registry rate', '$0.0600'] })
      expect(rows['openai/flare']).toMatchObject({ coverage: '2/2', speed: { display: '25.00s', value: 25, rank: 3 }, cost: { display: '$0.0800', rank: 3 }, evidence: ['provider usage', '$0.1600'] })
      // Grok appears in one of two runs; its single observation is its mean and coverage records the gap.
      expect(rows['grok/image']).toMatchObject({ coverage: '1/2', speed: { display: '10.00s', rank: 1 }, cost: { display: '$0.0400', rank: 2 } })
      for (const row of groupRows(model)) expect(row.quality).toEqual({ display: 'n/a', rank: null, value: null })

      expect(model.summaryStats).toEqual([
        { label: 'Runs', value: '2' }, { label: 'Providers', value: '3' }, { label: 'Provider rows', value: '5' },
        { label: 'Recorded cost', value: '$0.2600' }, { label: 'Quality scores', value: 'Unavailable' },
      ])
      expect(model.runs.map(run => [run.shortLabel, run.detail])).toEqual([['I1', '0 local / 3 service'], ['I2', '0 local / 2 service']])
      expect(model.runs[0]!.inventory).toMatchObject({
        prompt: { display: 'first prompt' },
        servicePrice: { display: 'gemini/nano ($0.0300)' },
        serviceSpeed: { display: 'gemini/nano (10.00s)' },
        report: { display: 'Report', artifactHref: 'image/2026-11-19_a_image-gen/provider-comparison-report.md' },
        evaluation: { display: 'Evaluation', artifactHref: 'image/2026-11-19_a_image-gen/consensus-evaluation.txt' },
      })
      expect(model.runs[1]!.inventory!['prompt']!.display).toHaveLength(120)
      expect(model.runs[1]!.inventory!['evaluation']).toEqual({ display: 'n/a' })
      expect(model.notes).toContain('Dated combined reports: `image/2026-11-19_combined-provider-comparison-report.md`.')
      expect(model.methodParagraphs.join(' ')).toContain('Artifact properties (dimensions, file size) have no effect on quality rankings')

      const evidence = model.sampleTables![0]!
      expect(evidence).toMatchObject({ title: 'Per-run evidence', providerKeyColumn: 1 })
      expect(evidence.rows[1]!.map(cell => cell.display)).toEqual(['I1', 'openai/flare', '20.00s', '$0.0700', 'provider usage', 'Artifact'])
      expect(evidence.rows[1]![5]!.artifactHref).toBe('image/2026-11-19_a_image-gen/generated-image-openai-flare.png')
      expect(JSON.stringify(model)).not.toContain(dir)
    })
  })

  test('omits preflight-only costs and times even when the comparison report copied them, and preserves recorded zeroes', async () => {
    await withTempDir('autoshow-media-dashboard-', async root => {
      await writeImageRun(root, 'run', 'prompt', [
        { key: 'a/estimated', ms: 1200, cents: 10 },
        { key: 'b/actual', ms: 800, cents: 25 },
        { key: 'c/receipt', ms: 500, cents: 8 },
      ])
      const path = join(root, 'run/manifest.json')
      const manifest = await Bun.file(path).json()
      const metadata = manifest.items[0].metadata
      delete metadata.image[0].processingTime
      metadata.cost = {
        estimated: { steps: [{ step: 'image', provider: 'a', model: 'estimated', cost: 10 }] },
        actual: { steps: [
          { step: 'video', provider: 'a', model: 'estimated', cost: 120, costSource: 'registry_fallback' },
          { step: 'image', provider: 'b', model: 'actual', cost: 0, costSource: 'provider_usage' },
        ] },
      }
      metadata.timing = {
        estimated: { steps: [{ step: 'image', provider: 'a', model: 'estimated', processingTimeMs: 1200 }] },
        actual: { steps: [{ step: 'image', provider: 'b', model: 'actual', processingTimeMs: 0 }] },
      }
      Object.assign(metadata.image[2], { providerCostCents: 6, providerCostSource: 'provider_quote' })
      await Bun.write(path, JSON.stringify(manifest))
      const { dashboardModel: model, samples } = buildMediaDashboard('image', root)
      const [estimated, actual, receipt] = groupRows(model)
      expect(estimated).toMatchObject({ cost: { rank: null, value: null }, speed: { rank: null, value: null } })
      expect(actual).toMatchObject({ cost: { rank: 1, value: 0 }, speed: { rank: 1, value: 0 } })
      expect(receipt).toMatchObject({ cost: { rank: 2, value: 0.06 }, speed: { rank: 2, value: 0.5 } })
      expect(samples.map(sample => sample.costBasis)).toEqual(['unrecorded', 'provider usage', 'provider quote'])
      expect(model.summaryStats).toContainEqual({ label: 'Recorded cost', value: 'Incomplete' })
      expect(model.runs[0]!.inventory).toMatchObject({ serviceSpeed: { display: 'b/actual (0.00s)' }, servicePrice: { display: 'b/actual ($0.0000)' } })
    })
  })

  test('keeps judge and human scores separate across runs and renders every generated artifact', async () => {
    await withTempDir('autoshow-media-dashboard-', async dir => {
      const root = join(dir, 'image')
      await writeImageRun(root, 'first', 'first prompt', [
        { key: 'a/both', ms: 100, cents: null, qualityScore: 90, humanQualityScore: 60, files: ['one.png', 'two.png', 'three.png'] },
        { key: 'b/judge', ms: 100, cents: null, qualityScore: 80 },
        { key: 'c/human', ms: 100, cents: null, humanQualityScore: 100 },
      ])
      await writeImageRun(root, 'second', 'second prompt', [
        { key: 'a/both', ms: 100, cents: null, qualityScore: 80, humanQualityScore: 0 },
      ])
      const { dashboardModel: model } = buildMediaDashboard('image', root)
      expect(model.groups[0]).toMatchObject({ metricColumns: { quality: 'Mean automated quality' }, evidenceColumns: ['Cost basis', 'Total cost', 'Mean human quality'] })
      expect(groupRows(model).map(row => [row.quality.value, row.quality.rank, row.evidence.at(-1)])).toEqual([
        [85, 1, '30.00'], [80, 2, 'n/a'], [null, null, '100.00'],
      ])
      expect(model.summaryStats).toContainEqual({ label: 'Quality scores', value: '3 automated / 3 human' })
      const evidence = model.sampleTables![0]!
      expect(evidence.columns.slice(-3)).toEqual(['Automated quality / 100', 'Human quality / 100', 'Artifact'])
      expect(evidence.rows[0]!.slice(-3, -1)).toEqual([{ display: '90.00' }, { display: '60.00' }])
      const render = renderTabPanel({ key: 'image', label: 'Image', rootLabel: 'image', model })
      for (const [index, name] of ['one', 'two', 'three'].entries()) {
        expect(render).toContain(`href="image/first/${name}.png" rel="noreferrer">Artifact ${index + 1}</a>`)
      }
    })
  })

  test('ranks human-only evidence under its own label, keeping ties and zero scores', async () => {
    await withTempDir('autoshow-media-dashboard-', async root => {
      await writeImageRun(root, 'run', 'prompt', [
        { key: 'a/one', ms: 1, cents: null, humanQualityScore: 85 },
        { key: 'b/two', ms: 1, cents: null, humanQualityScore: 85 },
        { key: 'c/three', ms: 1, cents: null, humanQualityScore: 0 },
        { key: 'd/four', ms: 1, cents: null, qualityScore: 101, humanQualityScore: -1 },
      ])
      const { dashboardModel: model } = buildMediaDashboard('image', root)
      expect(model.groups[0]!.metricColumns.quality).toBe('Mean human quality')
      expect(groupRows(model).map(row => [row.quality.value, row.quality.rank])).toEqual([[85, 1], [85, 1], [0, 3], [null, null]])
      expect(model.sampleTables![0]!.columns).toContain('Human quality / 100')
      expect(model.sampleTables![0]!.columns).not.toContain('Automated quality / 100')
    })
  })

  test('missing cost or timing stays unranked, shares no tie rank with real values, and marks recorded cost incomplete', async () => {
    await withTempDir('autoshow-media-dashboard-', async dir => {
      const root = join(dir, 'benchmarks', 'image')
      await writeImageRun(root, 'run', 'prompt', [
        { key: 'a/one', ms: 5_000, cents: 2, source: 'provider_usage' },
        { key: 'b/two', ms: 5_000, cents: 2, source: 'provider_usage' },
        { key: 'c/three', ms: null, cents: null },
      ])
      const model = buildMediaDashboard('image', root, 'fixed-time').dashboardModel
      const rows = Object.fromEntries(groupRows(model).map(row => [row.providerKey, row]))
      expect([rows['a/one']!.cost.rank, rows['b/two']!.cost.rank, rows['c/three']!.cost.rank]).toEqual([1, 1, null])
      expect([rows['a/one']!.speed.rank, rows['b/two']!.speed.rank, rows['c/three']!.speed.rank]).toEqual([1, 1, null])
      expect(rows['c/three']).toMatchObject({ speed: { display: 'n/a', value: null }, cost: { display: 'n/a', value: null }, evidence: ['unrecorded', 'n/a'] })
      expect(model.summaryStats.find(stat => stat.label === 'Recorded cost')!.value).toBe('Incomplete')
      expect(model.sampleTables![0]!.rows[2]![5]).toEqual({ display: 'n/a' })
    })
  })

  test('an absent or empty archive renders an empty service group instead of failing the dashboard build', async () => {
    await withTempDir('autoshow-media-dashboard-', async dir => {
      for (const category of ['image', 'video', 'music'] as const) {
        const model = buildMediaDashboard(category, join(dir, 'benchmarks', category), 'fixed-time').dashboardModel
        expect(model.runs).toEqual([])
        expect(model.groups.map(group => [group.key, group.providers.length])).toEqual([['service', 0]])
        expect(model.summaryStats.find(stat => stat.label === 'Runs')!.value).toBe('0')
        expect(renderTabPanel({ key: category, label: category, rootLabel: `docs/benchmarks/${category}`, model })).toContain('No providers in this group.')
      }
    })
  })

  test('the CLI-only view drops retired models, recomputes ranks and keeps archive scope labels', async () => {
    await withTempDir('autoshow-media-dashboard-', async dir => {
      const root = join(dir, 'benchmarks', 'image')
      await writeImageRun(root, 'run', 'prompt', [
        { key: 'gemini/gemini-3.1-flash-lite-image', ms: 3_000, cents: 3.36, source: 'registry_fallback' },
        { key: 'openai/gpt-image-2.5-flare', ms: 9_000, cents: 1.317, source: 'provider_usage' },
        { key: 'openai/gpt-image-2.6-flare', ms: 15_000, cents: 7.4485, source: 'provider_usage' },
        { key: 'gemini/gemini-nano-banana-2.1', ms: 13_000, cents: 3.36, source: 'registry_fallback' },
      ])
      const model = buildMediaDashboard('image', root, 'fixed-time').dashboardModel
      const supported = supportedDashboardProviderKeys('image', model)
      expect(supported).toEqual(['gemini/gemini-nano-banana-2.1', 'openai/gpt-image-2.6-flare'])
      const view = buildSupportedDashboardModel(model, supported)
      expect(view.groups[0]!.providers.map(row => [row.providerKey, row.speed.rank, row.cost.rank])).toEqual([
        ['gemini/gemini-nano-banana-2.1', 1, 1],
        ['openai/gpt-image-2.6-flare', 2, 2],
      ])
      expect(view.sampleTables![0]!.rows.map(row => row[1]!.display)).toEqual(['openai/gpt-image-2.6-flare', 'gemini/gemini-nano-banana-2.1'])
      expect(view.runs[0]!.inventory!['servicePrice']).toEqual({ display: 'Archive leader unavailable in CLI' })
      expect(view.summaryStats.find(stat => stat.label === 'Providers')!.value).toBe('2')
      expect(view.summaryStats.map(stat => stat.label)).toContain('Archive runs')
      expect(groupRows(model)).toHaveLength(4)
    })
  })
})
