import { describe, expect, test } from 'bun:test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { buildTextDashboard, collectWriteDashboardSamples, WRITE_BENCHMARK_CASES } from '../../../../.codex/skills/consensus/scripts/text/build_text_dashboard'
import { renderTabPanel } from '../../../../.codex/skills/consensus/scripts/shared/dashboard_client.js'
import { archiveWriteBenchmarkEvidence, buildWriteBenchmarkMarkdown } from '~/tools/write-benchmark-report'
import { withTempDir } from '../../../test-utils/temp-dirs'

const writeJson = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value))
const providers = [
  { provider: 'fixture', model: 'cheap', inputCostPer1MCents: 10, outputCostPer1MCents: 50 },
  { provider: 'fixture', model: 'expensive', inputCostPer1MCents: 200, outputCostPer1MCents: 1000 },
]

function fixture(root: string, index: number, options: {
  invalid?: 'schema' | 'json' | 'empty' | 'missing'
  failedState?: boolean
  extraRequested?: boolean
} = {}) {
  const benchmark = WRITE_BENCHMARK_CASES[index]!, dir = join(root, benchmark.directory)
  mkdirSync(dir, { recursive: true })
  for (const provider of providers) {
    if (provider.model === 'cheap' && options.invalid === 'missing') continue
    const output = provider.model === 'cheap' && options.invalid === 'json' ? '{broken'
      : provider.model === 'cheap' && options.invalid === 'empty' ? '  '
        : JSON.stringify({ summary: 'Independent fixed fixture output' })
    writeFileSync(join(dir, `${provider.model}.json`), output)
  }
  const manifest = {
    command: 'write', scope: 'single', createdAt: '2026-10-18', updatedAt: '2026-10-18',
    items: [{ status: 'full', metadata: {
      step3: providers.map((provider, providerIndex) => ({
        llmService: provider.provider, llmModel: provider.model,
        processingTime: (index + 1) * (providerIndex + 1) * 1000,
        inputTokenCount: 200 + index, outputTokenCount: 100 + index,
        outputFileName: `${provider.model}.json`, outputFormat: 'json',
        validationFailed: provider.model === 'cheap' && options.invalid === 'schema',
      })),
      cost: {
        actual: { steps: providers.map((provider, providerIndex) => ({ step: 'llm', ...provider, cost: (index + 1) * (providerIndex + 1), costSource: 'provider_usage' })) },
        estimated: { steps: providers.map(provider => ({ step: 'llm', ...provider, cost: 999, outputCostPer1MCents: 9999 })) },
      },
      // This normalized metric must never replace seconds/request in this dashboard.
      timing: { actual: { steps: providers.map(provider => ({ step: 'llm', ...provider, msPerUnit: 1, processingTimeMs: 999999 })) } },
      ...(options.extraRequested ? { requestedProviders: [{ service: 'missing', model: 'requested' }] } : {}),
      ...(options.failedState ? { providerStates: [{ service: 'fixture', model: 'cheap', status: 'failed' }] } : {}),
    }, providers: [] }],
  }
  writeJson(join(dir, 'manifest.json'), manifest)
  return manifest
}

describe('Write dashboard cost and wall-clock comparisons', () => {
  test('nested Write outputs link from the shared dashboard and remain readable by the report', async () => {
    await withTempDir('write-dashboard-grouped-', async benchmarks => {
      const root = join(benchmarks, 'text/write')
      fixture(root, 0, { invalid: 'schema' })
      const samples = collectWriteDashboardSamples(root)
      expect(samples[0]!.manifestHref).toBe(`text/write/${WRITE_BENCHMARK_CASES[0].directory}/manifest.json`)
      expect(samples[0]!.outputHref).toBe(`text/write/${WRITE_BENCHMARK_CASES[0].directory}/cheap.json`)
      expect(JSON.stringify(buildTextDashboard(root).dashboardModel)).toContain(`"artifactHref":"text/write/${WRITE_BENCHMARK_CASES[0].directory}/manifest.json"`)
      expect(JSON.stringify(buildTextDashboard(root).dashboardModel)).not.toContain('"artifactHref":"write/')
      expect(buildWriteBenchmarkMarkdown(root)).toContain('schema failed')
    })
  })

  test('selects seven targeted reruns while retaining invalid costs and five unknown original bills', async () => {
    await withTempDir('write-dashboard-seven-reruns-', async root => {
      writeJson(join(root, 'benchmark-plan.json'), { schemaVersion: 1, providers })
      writeJson(join(root, 'rerun-plan.json'), { targets: 7 })
      for (let index = 0; index < WRITE_BENCHMARK_CASES.length; index++) {
        const manifest = fixture(root, index), original = structuredClone(manifest)
        const benchmark = WRITE_BENCHMARK_CASES[index]!, dir = join(root, benchmark.directory)
        const targets = index < 3 ? providers : index === 3 ? providers.slice(0, 1) : []
        if (!targets.length) continue
        if (index === 0) {
          for (const step of manifest.items[0]!.metadata.step3) step.validationFailed = true
        } else {
          const models = targets.map(target => target.model)
          manifest.items[0]!.metadata.step3 = manifest.items[0]!.metadata.step3.filter(step => !models.includes(step.llmModel))
          manifest.items[0]!.metadata.cost.actual.steps = manifest.items[0]!.metadata.cost.actual.steps.filter(step => !models.includes(step.model))
          Object.assign(manifest.items[0]!.metadata, { providerStates: targets.map(target => ({ service: target.provider, model: target.model, status: 'failed' })) })
          for (const target of targets) writeJson(join(dir, `slot-fixture-${target.model}.json`), { ...target, status: 'failed', error: 'Original transport failure' })
        }
        writeJson(join(dir, 'manifest.json'), manifest)
        const rerunDir = join(dir, 'reruns/02')
        mkdirSync(rerunDir, { recursive: true })
        const models = targets.map(target => target.model), metadata = original.items[0]!.metadata
        metadata.step3 = metadata.step3.filter(step => models.includes(step.llmModel)).map(step => ({ ...step, processingTime: 100 }))
        metadata.cost.actual.steps = metadata.cost.actual.steps.filter(step => models.includes(step.model)).map(step => ({ ...step, cost: 0.5 }))
        metadata.cost.estimated.steps = metadata.cost.estimated.steps.filter(step => models.includes(step.model))
        for (const target of targets) writeFileSync(join(rerunDir, `${target.model}.json`), readFileSync(join(dir, `${target.model}.json`)))
        writeJson(join(rerunDir, 'manifest.json'), original)
      }
      const { samples, attempts, dashboardModel: model } = buildTextDashboard(root)
      expect(samples).toHaveLength(10)
      expect(attempts).toHaveLength(17)
      expect(attempts.filter(row => row.attempt === '02')).toHaveLength(7)
      expect(attempts.filter(row => row.selected)).toHaveLength(10)
      expect(samples.every(row => row.status === 'succeeded')).toBe(true)
      expect(attempts.filter(row => row.attempt === '01' && row.schema === 'failed').map(row => row.costDollars)).toEqual([0.01, 0.02])
      expect(model.summaryStats.find(stat => stat.label === 'Usage-based cost')!.value).toBe('$0.295000')
      expect(model.summaryStats.find(stat => stat.label === 'Attempted slots with unknown cost')!.value).toBe('5')
      expect(model.summaryStats.find(stat => stat.label === 'First-pass attempts / valid')!.value).toBe('10 / 3')
      expect(model.summaryStats.find(stat => stat.label === 'Rerun attempts / valid')!.value).toBe('7 / 7')
      expect(model.sampleTables![0]!.rows).toHaveLength(17)
      const cheap = model.groups[0]!.providers.find(row => row.model === 'cheap')!
      expect(cheap.coverage).toBe('5/5')
      expect(cheap.speed.value).toBeCloseTo(1.08, 12)
      expect(cheap.cost.value).toBeCloseTo(0.014, 12)
      const rerun = samples.find(row => row.caseKey === 'short-summary' && row.providerKey === 'fixture/cheap')!
      expect(rerun).toMatchObject({ run: `${WRITE_BENCHMARK_CASES[0].directory}/reruns/02`, attempt: '02', selected: true })
      expect(rerun.outputHref).toEndWith('/reruns/02/cheap.json')
      expect(rerun.manifestHref).toEndWith('/reruns/02/manifest.json')
      const verification = '<!-- verification:start -->\nPrevious verification retained.\n<!-- verification:end -->'
      writeFileSync(join(root, 'benchmark-report.md'), verification)
      const report = buildWriteBenchmarkMarkdown(root)
      expect(report).toContain('17 attempts: 10 first-pass requests (3 valid) and 7 reruns (7 valid)')
      expect(report).toContain('costs total $0.295000; 5 attempted slots have unresolved or unavailable billing')
      expect(report).toContain('0 failed or invalid requests remain in the current comparison')
      expect(report).toContain('Original transport failure')
      expect(report).toContain(verification)
    })
  })

  test('selects the latest terminal failure and keeps a later in-flight rerun from replacing it', async () => {
    await withTempDir('write-dashboard-rerun-failure-', async root => {
      writeJson(join(root, 'benchmark-plan.json'), { providers })
      const manifest = fixture(root, 0), dir = join(root, WRITE_BENCHMARK_CASES[0].directory)
      for (const [attempt, status] of [['02', 'failed'], ['03', 'running']] as const) {
        const rerunDir = join(dir, 'reruns', attempt)
        mkdirSync(rerunDir, { recursive: true })
        writeJson(join(rerunDir, 'manifest.json'), { ...manifest, items: [{ status: 'failed', providers: [], metadata: {
          requestedProviders: [providers[0]], providerStates: [{ service: 'fixture', model: 'cheap', status }],
        } }] })
      }
      const { samples, attempts, dashboardModel: model } = buildTextDashboard(root)
      expect(samples.find(row => row.providerKey === 'fixture/cheap')).toMatchObject({ attempt: '02', status: 'failed', selected: true, costDollars: null })
      expect(attempts.find(row => row.attempt === '03')).toMatchObject({ status: 'running', selected: false })
      expect(model.groups[1]!.providers.find(row => row.model === 'cheap')!.speed.rank).toBeNull()
      expect(model.summaryStats.find(stat => stat.label === 'Usage-based cost')!.value).toBe('$0.030000')
      expect(collectWriteDashboardSamples(root)).toEqual(samples)
    })
  })

  test('archives original and nested rerun bytes with both plans and refuses in-flight evidence', async () => {
    await withTempDir('write-dashboard-rerun-archive-', async root => {
      writeJson(join(root, 'benchmark-plan.json'), { providers })
      const manifest = fixture(root, 0), dir = join(root, WRITE_BENCHMARK_CASES[0].directory)
      const originalRaw = '{ "original": true }\n'
      writeFileSync(join(dir, 'raw-response-fixture-cheap-attempt-1.json'), originalRaw)
      await archiveWriteBenchmarkEvidence(root)
      writeJson(join(root, 'rerun-plan.json'), { targets: 1 })
      const rerunDir = join(dir, 'reruns/02')
      mkdirSync(rerunDir, { recursive: true })
      writeJson(join(rerunDir, 'manifest.json'), manifest)
      writeFileSync(join(rerunDir, 'source.txt'), 'Saved fixed source\n')
      writeFileSync(join(rerunDir, 'prompt.md'), 'Saved fixed prompt\n')
      writeJson(join(rerunDir, 'raw-response-fixture-cheap-attempt-1.json'), { rerun: true })
      writeJson(join(rerunDir, 'slot-fixture-cheap.json'), { status: 'completed' })
      await archiveWriteBenchmarkEvidence(root)
      const archive = join(root, '2026-10-18-write.evidence.zip')
      const readEntry = async (name: string) => {
        const child = Bun.spawn(['unzip', '-p', archive, name], { stdout: 'pipe', stderr: 'pipe' })
        const output = await new Response(child.stdout).text()
        expect(await child.exited).toBe(0)
        return output
      }
      const checksums = await readEntry('SHA256SUMS')
      expect(checksums).toContain(`${createHash('sha256').update(originalRaw).digest('hex')}  ${WRITE_BENCHMARK_CASES[0].directory}/raw-response-fixture-cheap-attempt-1.json`)
      for (const name of ['rerun-plan.json', 'manifest.json', 'source.txt', 'prompt.md', 'raw-response-fixture-cheap-attempt-1.json', 'slot-fixture-cheap.json']) {
        expect(checksums).toContain(name === 'rerun-plan.json' ? name : `${WRITE_BENCHMARK_CASES[0].directory}/reruns/02/${name}`)
      }
      expect(await readEntry(`${WRITE_BENCHMARK_CASES[0].directory}/raw-response-fixture-cheap-attempt-1.json`)).toBe(originalRaw)
      expect(readFileSync(join(dir, 'raw-response-fixture-cheap-attempt-1.json'), 'utf8')).toBe(originalRaw)
      writeJson(join(rerunDir, 'slot-fixture-cheap.json'), { status: 'dispatch-started' })
      await expect(archiveWriteBenchmarkEvidence(root)).rejects.toThrow('Cannot archive an in-flight slot')
      expect(await readEntry(`${WRITE_BENCHMARK_CASES[0].directory}/raw-response-fixture-cheap-attempt-1.json`)).toBe(originalRaw)
    })
  })

  test('uses all-five equal prompt means, recorded cents converted to dollars, and the explicit frozen price proxy', async () => {
    await withTempDir('write-dashboard-metrics-', async root => {
      writeJson(join(root, 'benchmark-plan.json'), { schemaVersion: 1, providers })
      WRITE_BENCHMARK_CASES.forEach((_, index) => fixture(root, index))
      // Preserved historical runs must not alter the selected five-prompt corpus.
      mkdirSync(join(root, 'historical'), { recursive: true })
      writeJson(join(root, 'historical/manifest.json'), { command: 'unrelated' })
      const { dashboardModel: model, samples } = buildTextDashboard(root, 'fixed-time')
      expect(samples).toHaveLength(10)
      expect(model.groups).toHaveLength(6)
      expect(model.runs).toHaveLength(5)
      const aggregate = model.groups[0]!, cheap = aggregate.providers.find(row => row.model === 'cheap')!
      const expensive = aggregate.providers.find(row => row.model === 'expensive')!
      expect(cheap.coverage).toBe('5/5')
      expect(cheap.speed).toMatchObject({ value: 3, rank: 1, display: '3.000s' })
      expect(cheap.cost).toMatchObject({ rank: 1, display: '$0.030000' })
      expect(cheap.cost.value).toBeCloseTo(0.03, 12)
      expect(cheap.quality).toMatchObject({ value: 0.5, rank: 2, display: '$0.50' })
      expect(expensive.quality).toMatchObject({ value: 10, rank: 1 })
      expect(expensive.speed.value).toBe(6)
      expect(cheap.evidence).toEqual(['passed', '102.0', '$0.150000'])
      expect(aggregate.metricColumns.quality).toBe('Price proxy ($ / 1M output tokens)')
      expect(aggregate.metricDirections).toEqual({ quality: 'higher', speed: 'lower', cost: 'lower' })
      expect(model.methodParagraphs.join(' ')).toContain('not measured text quality')
      expect(model.notes.join(' ')).toContain('single-run measurements')
      const html = renderTabPanel({ key: 'write', label: 'Write', rootLabel: 'docs/benchmarks/text/write', model })
      expect(html).toContain('Price proxy ($ / 1M output tokens)')
      expect(html).toContain('Sorted by price proxy.')
      expect(html).toContain('>Price proxy</label>')
      expect(html).toContain('Seconds / request')
      expect(html).not.toContain('>Quality</label>')
      expect(samples[0]!.outputHref).toEndWith('/2026-10-18_01-short-summary/cheap.json')
      expect(html).toContain(`href="${samples[0]!.outputHref}"`)
    })
  })

  for (const invalid of ['schema', 'json', 'empty', 'missing'] as const) test(`keeps ${invalid} output failure and its incurred cost visible without passing ranks`, async () => {
    await withTempDir(`write-dashboard-invalid-${invalid}-`, async root => {
      writeJson(join(root, 'benchmark-plan.json'), { schemaVersion: 1, providers })
      WRITE_BENCHMARK_CASES.forEach((_, index) => fixture(root, index, index === 0 ? { invalid, extraRequested: true } : {}))
      const { dashboardModel: model, samples } = buildTextDashboard(root)
      const cheapSample = samples.find(row => row.caseKey === 'short-summary' && row.providerKey === 'fixture/cheap')!
      expect(cheapSample.status).toBe(({ schema: 'schema failed', json: 'invalid JSON output', empty: 'empty output', missing: 'missing output' })[invalid])
      expect(cheapSample.costDollars).toBe(0.01)
      const aggregate = model.groups[0]!.providers.find(row => row.model === 'cheap')!
      expect(aggregate.coverage).toBe('4/5')
      for (const metric of ['quality', 'speed', 'cost'] as const) expect(aggregate[metric]).toMatchObject({ value: null, rank: null })
      expect(aggregate.evidence[2]).toBe('$0.150000')
      const individual = model.groups[1]!.providers.find(row => row.model === 'cheap')!
      expect(individual.coverage).toBe('0/1')
      expect(individual.speed.rank).toBeNull()
      expect(model.groups[2]!.providers.find(row => row.model === 'cheap')!.speed.rank).toBe(1)
      expect(samples.find(row => row.providerKey === 'missing/requested')!.status).toBe('missing')
      expect(model.summaryStats.find(stat => stat.label === 'Usage-based cost')!.value).toBe('$0.450000')
    })
  })

  test('keeps provider failures authoritative, planned missing routes visible, and unknown cost unranked', async () => {
    await withTempDir('write-dashboard-status-', async root => {
      writeJson(join(root, 'benchmark-plan.json'), { schemaVersion: 1, providers: [...providers, { provider: 'planned', model: 'not-run', outputCostPer1MCents: 200 }] })
      const manifest = fixture(root, 0, { failedState: true })
      manifest.items[0]!.metadata.cost.actual.steps = []
      writeJson(join(root, WRITE_BENCHMARK_CASES[0].directory, 'manifest.json'), manifest)
      const { dashboardModel: model, samples } = buildTextDashboard(root)
      expect(samples).toHaveLength(15)
      expect(samples.find(row => row.providerKey === 'fixture/cheap')!.status).toBe('failed')
      expect(samples.find(row => row.providerKey === 'planned/not-run')!.status).toBe('missing')
      expect(samples.filter(row => row.caseKey === 'blog').every(row => row.status === 'missing')).toBe(true)
      const expensive = model.groups[1]!.providers.find(row => row.model === 'expensive')!
      expect(expensive.speed.value).toBe(2)
      expect(expensive.cost).toMatchObject({ value: null, rank: null })
      expect(samples.find(row => row.caseKey === 'blog')!.manifestHref).toBeNull()
      expect(model.runs[3]!.inventory!['manifest']!.display).toBe('Not run')
      expect(model.summaryStats.find(stat => stat.label === 'Attempted slots with unknown cost')!.value).toBe('2')
    })
  })

  test('binds passing output to the saved slot hash and rejects a valid JSON substitution', async () => {
    await withTempDir('write-dashboard-output-binding-', async root => {
      fixture(root, 0)
      const dir = join(root, WRITE_BENCHMARK_CASES[0].directory), path = join(dir, 'cheap.json')
      const bytes = readFileSync(path)
      writeJson(join(dir, 'slot-fixture-cheap.json'), {
        provider: 'fixture', model: 'cheap', status: 'completed',
        artifactHashes: { 'cheap.json': createHash('sha256').update(bytes).digest('hex') },
      })
      expect(collectWriteDashboardSamples(root).find(row => row.providerKey === 'fixture/cheap')!.status).toBe('succeeded')
      writeJson(path, { summary: 'A substituted but parseable structured object.' })
      const result = buildTextDashboard(root)
      expect(result.samples.find(row => row.providerKey === 'fixture/cheap')!.status).toBe('artifact hash mismatch')
      expect(result.dashboardModel.groups[1]!.providers.find(row => row.model === 'cheap')!.speed.rank).toBeNull()
      expect(result.samples.find(row => row.providerKey === 'fixture/cheap')!.costDollars).toBe(0.01)
    })
  })

  test('retains observed failed-request duration without ranking a missing response or inventing its billing', async () => {
    await withTempDir('write-dashboard-failed-duration-', async root => {
      const manifest = fixture(root, 0, { failedState: true }), dir = join(root, WRITE_BENCHMARK_CASES[0].directory)
      manifest.items[0]!.metadata.step3 = manifest.items[0]!.metadata.step3.filter(entry => entry.llmModel !== 'cheap')
      manifest.items[0]!.metadata.cost.actual.steps = []
      writeJson(join(dir, 'manifest.json'), manifest)
      writeJson(join(dir, 'slot-fixture-cheap.json'), { provider: 'fixture', model: 'cheap', status: 'failed', wallTimeMs: 143805 })
      const result = buildTextDashboard(root), sample = result.samples.find(row => row.providerKey === 'fixture/cheap')!
      expect(sample).toMatchObject({ status: 'failed', processingMs: 143805, costDollars: null })
      expect(result.dashboardModel.groups[1]!.providers.find(row => row.model === 'cheap')!.speed).toMatchObject({ value: null, rank: null })
    })
  })

  test('requires recorded schema success and rejects failure envelopes and empty objects even without a slot receipt', async () => {
    await withTempDir('write-dashboard-validation-evidence-', async root => {
      const manifest = fixture(root, 0), dir = join(root, WRITE_BENCHMARK_CASES[0].directory)
      Reflect.deleteProperty(manifest.items[0]!.metadata.step3[0]!, 'validationFailed')
      writeJson(join(dir, 'manifest.json'), manifest)
      expect(collectWriteDashboardSamples(root).find(row => row.providerKey === 'fixture/cheap')!.status).toBe('validation unrecorded')
      manifest.items[0]!.metadata.step3[0]!.validationFailed = false
      writeJson(join(dir, 'manifest.json'), manifest)
      writeJson(join(dir, 'cheap.json'), { _raw: 'Original invalid response', _validationError: 'Known schema violation' })
      expect(collectWriteDashboardSamples(root).find(row => row.providerKey === 'fixture/cheap')!.status).toBe('validation failure envelope')
      writeJson(join(dir, 'cheap.json'), {})
      expect(collectWriteDashboardSamples(root).find(row => row.providerKey === 'fixture/cheap')!.status).toBe('invalid structured output')
      expect(buildTextDashboard(root).dashboardModel.groups[1]!.providers.find(row => row.model === 'cheap')!.cost.rank).toBeNull()
    })
  })

  test('renders an empty archive and falls back to manifest rate snapshots without claiming measured quality', async () => {
    await withTempDir('write-dashboard-empty-', async root => {
      expect(collectWriteDashboardSamples(root)).toEqual([])
      expect(buildTextDashboard(root).dashboardModel.groups.every(group => group.providers.length === 0)).toBe(true)
      fixture(root, 0)
      const result = buildTextDashboard(root)
      expect(result.samples[0]!.outputPricePerMillion).toBe(99.99)
      expect(result.dashboardModel.groups[1]!.providers[0]!.quality.value).toBe(99.99)
    })
  })
})
