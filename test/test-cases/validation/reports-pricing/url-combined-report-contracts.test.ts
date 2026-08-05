import {
  afterEach,
  describe,
  expect,
  test
} from 'bun:test'
import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  buildUrlCombinedReport,
  rankUrlProviderGroup,
  type AggregatedUrlProvider,
  type UrlMetricRankingEntry
} from '../../../../.codex/skills/consensus/scripts/url/build_combined_report'
import {
  LONG_SEQUENCE_DISTANCE_METHOD
} from '../../../../.codex/skills/consensus/scripts/url/url_consensus_lib'
import type { UrlCombinedArtifact, UrlCombinedFixtureProvider } from '~/types'

const tempRoots: string[] = []

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

const providerRow = (provider: UrlCombinedFixtureProvider, group: 'local' | 'service') => ({
  providerKey: provider.providerKey,
  provider: provider.providerKey,
  model: provider.providerKey,
  group,
  processingTimeMs: provider.processingTimeMs,
  costCents: provider.costCents,
  metrics: {
    wer: provider.wer,
    cer: provider.cer,
    contentCoverage: provider.contentCoverage,
    automatedQualityScore: provider.misleadingProviderQuality
  }
})

const surfaceRows = (providers: UrlCombinedFixtureProvider[], metric: 'price' | 'speed' | 'automatedQuality' | 'humanQuality') =>
  providers
    .filter((provider) => {
      if (metric === 'price') return provider.costCents !== null
      if (metric === 'speed') return provider.processingTimeMs !== null
      if (metric === 'automatedQuality') return provider.sourceQuality !== null
      return provider.humanQuality !== null && provider.humanQuality !== undefined
    })
    .map((provider, index) => ({
      rank: index + 1,
      providerKey: provider.providerKey,
      provider: provider.providerKey,
      model: provider.providerKey,
      group: 'service',
      metric,
      value: metric === 'price'
        ? provider.costCents
        : metric === 'speed'
          ? provider.processingTimeMs
          : metric === 'automatedQuality'
            ? provider.sourceQuality
            : provider.humanQuality,
      label: provider.providerKey
    }))

function writeFixtureRun(
  root: string,
  runName: string,
  local: UrlCombinedFixtureProvider[],
  service: UrlCombinedFixtureProvider[],
  metadata?: { title: string; sourceUrl: string }
): void {
  const runDir = join(root, runName)
  mkdirSync(runDir, { recursive: true })
  const localSurfaces = {
    price: surfaceRows(local, 'price'),
    speed: surfaceRows(local, 'speed'),
    automatedQuality: surfaceRows(local, 'automatedQuality'),
    humanQuality: surfaceRows(local, 'humanQuality')
  }
  const serviceSurfaces = {
    price: surfaceRows(service, 'price'),
    speed: surfaceRows(service, 'speed'),
    automatedQuality: surfaceRows(service, 'automatedQuality'),
    humanQuality: surfaceRows(service, 'humanQuality')
  }
  writeFileSync(join(runDir, 'provider-comparison-report.json'), JSON.stringify({
    schemaVersion: 2,
    kind: 'url-provider-comparison',
    runName,
    runDir,
    providerCount: local.length + service.length,
    providerGroups: {
      local: { count: local.length, providers: local.map((provider) => providerRow(provider, 'local')) },
      service: { count: service.length, providers: service.map((provider) => providerRow(provider, 'service')) }
    },
    rankingSurfaces: { local: localSurfaces, service: serviceSurfaces },
    normalization: {
      exactLevenshteinElementLimit: 10_000,
      longSequenceDistance: LONG_SEQUENCE_DISTANCE_METHOD
    }
  }))
  if (metadata) {
    writeFileSync(join(runDir, 'run.json'), JSON.stringify({
      metadata: {
        step1: { title: metadata.title },
        web: { title: metadata.title, sourceUrl: metadata.sourceUrl, finalUrl: metadata.sourceUrl },
        source: { url: metadata.sourceUrl }
      }
    }))
  }
}

const sampleAggregate = (
  providerKey: string,
  quality: number | null,
  speed: number | null,
  cost: number | null
): AggregatedUrlProvider => ({
  providerKey,
  provider: providerKey,
  model: providerKey,
  group: 'service',
  runsCovered: 1,
  meanAutomatedQuality: quality,
  meanWER: null,
  meanCER: null,
  meanContentCoverage: null,
  meanProcessingTimeMs: speed,
  meanCostCents: cost === null ? null : cost * 100,
  meanCostUSD: cost,
  perRun: {}
})

describe('URL combined-report aggregation', () => {
  test('exposes URL combined reports through unified help', () => {
    const runner = resolve(import.meta.dir, '../../../../.codex/skills/consensus/scripts/run.ts')
    const result = spawnSync('bun', [runner, 'url', '--help'], { encoding: 'utf8' })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('bun scripts/run.ts url build-combined-report <root_dir>')
  })

  test('uses source automated quality, present-value means, USD conversion, metadata, and isolated groups', () => {
    const root = mkdtempSync(join(tmpdir(), 'autoshow-url-combined-'))
    tempRoots.push(root)
    const localShared: UrlCombinedFixtureProvider = {
      providerKey: 'shared', processingTimeMs: 100, costCents: 999,
      wer: 0.1, cer: 0.2, contentCoverage: 0.8, sourceQuality: 40,
      misleadingProviderQuality: 999
    }
    const firstService: UrlCombinedFixtureProvider[] = [
      { providerKey: 'shared', processingTimeMs: 500, costCents: 200, wer: 0.2, cer: 0.3, contentCoverage: 0.8, sourceQuality: 90, misleadingProviderQuality: 1 },
      { providerKey: 'alpha', processingTimeMs: 1000, costCents: 100, wer: 0.4, cer: 0.5, contentCoverage: 0.7, sourceQuality: 60 },
      { providerKey: 'beta', processingTimeMs: 500, costCents: 100, wer: 0.3, cer: 0.4, contentCoverage: 0.9, sourceQuality: 60 },
      { providerKey: 'missing', processingTimeMs: null, costCents: null, wer: null, cer: null, contentCoverage: null, sourceQuality: null }
    ]
    const secondService: UrlCombinedFixtureProvider[] = [
      { ...firstService[0]!, costCents: 400, sourceQuality: 70, wer: null, contentCoverage: 1 },
      ...firstService.slice(1)
    ]

    writeFixtureRun(root, 'run-a', [localShared], firstService, {
      title: 'Article <A>',
      sourceUrl: 'https://example.com/article?x=1&y=2'
    })
    writeFixtureRun(root, 'run-b', [], secondService)

    const result = buildUrlCombinedReport(root, '2026-07-18T00:00:00.000Z')
    const report = result.report as unknown as UrlCombinedArtifact<AggregatedUrlProvider, UrlMetricRankingEntry>
    const local = report.providers.find((provider) => provider.group === 'local' && provider.providerKey === 'shared')
    const service = report.providers.find((provider) => provider.group === 'service' && provider.providerKey === 'shared')

    expect(report.schemaVersion).toBe(1)
    expect(report.runCount).toBe(2)
    expect(report.providerCount).toBe(5)
    expect(report.providerRowCount).toBe(9)
    expect(report.automatedQualityRowCount).toBe(7)
    expect(report.humanQualityRowCount).toBe(0)
    expect(report.notes).toContain('No human-quality ranking is emitted because explicit human-quality rows are absent from the current source reports.')
    expect(result.markdown).toContain('explicit human-quality rows are absent')
    expect(result.html).toContain('explicit human-quality rows are absent')
    expect(local?.meanCostUSD).toBe(0)
    expect(local?.meanAutomatedQuality).toBe(40)
    expect(service?.meanAutomatedQuality).toBe(80)
    expect(service?.meanWER).toBe(0.2)
    expect(service?.meanContentCoverage).toBeCloseTo(0.9, 10)
    expect(service?.meanCostCents).toBe(300)
    expect(service?.meanCostUSD).toBe(3)
    expect(report.runs[0]?.articleTitle).toBe('Article <A>')
    expect(report.runs[0]?.sourceUrl).toBe('https://example.com/article?x=1&y=2')
    expect(report.runs[0]?.leaders.service.automatedQuality?.providerKey).toBe('shared')
    expect(report.runs[1]?.articleTitle).toBe('run-b')
    expect(report.runs[1]?.sourceUrl).toBeNull()
    expect(result.markdown).toContain('source `rankingSurfaces.*.automatedQuality.value` values')
    expect(result.markdown).toContain('[Article &lt;A&gt;](<https://example.com/article?x=1&y=2>)')
    expect(result.html).toContain('href="https://example.com/article?x=1&amp;y=2"')
  })

  test('applies all pure-ranking tie-breaks and sorts missing values last', () => {
    const rankings = rankUrlProviderGroup([
      sampleAggregate('z-slow', 80, 2000, 1),
      sampleAggregate('a-fast', 80, 1000, 1),
      sampleAggregate('better-at-speed-tie', 90, 500, 2),
      sampleAggregate('lower-at-speed-tie', 70, 500, 3),
      sampleAggregate('missing', null, null, null)
    ])

    expect(rankings.automatedQuality.map((entry) => entry.providerKey)).toEqual([
      'better-at-speed-tie', 'a-fast', 'z-slow', 'lower-at-speed-tie', 'missing'
    ])
    expect(rankings.speed.map((entry) => entry.providerKey)).toEqual([
      'better-at-speed-tie', 'lower-at-speed-tie', 'a-fast', 'z-slow', 'missing'
    ])
    expect(rankings.price.map((entry) => entry.providerKey)).toEqual([
      'a-fast', 'z-slow', 'better-at-speed-tie', 'lower-at-speed-tie', 'missing'
    ])
  })

  test('omits per-run leaders when a ranking surface contains only null values', () => {
    const root = mkdtempSync(join(tmpdir(), 'autoshow-url-combined-'))
    tempRoots.push(root)
    writeFixtureRun(root, 'all-null-leaders', [], [{
      providerKey: 'missing', processingTimeMs: null, costCents: null,
      wer: null, cer: null, contentCoverage: null, sourceQuality: 75
    }])

    const reportPath = join(root, 'all-null-leaders', 'provider-comparison-report.json')
    const sourceReport = JSON.parse(readFileSync(reportPath, 'utf8')) as {
      rankingSurfaces: {
        service: {
          price: Array<Record<string, unknown>>
          speed: Array<Record<string, unknown>>
        }
      }
    }
    const nullEntry = {
      rank: 1,
      providerKey: 'missing',
      provider: 'missing',
      model: 'missing',
      group: 'service',
      value: null,
      label: 'n/a'
    }
    sourceReport.rankingSurfaces.service.price = [{ ...nullEntry, metric: 'price' }]
    sourceReport.rankingSurfaces.service.speed = [{ ...nullEntry, metric: 'speed' }]
    writeFileSync(reportPath, JSON.stringify(sourceReport))

    const result = buildUrlCombinedReport(root, '2026-07-18T00:00:00.000Z')
    const report = result.report as unknown as UrlCombinedArtifact<AggregatedUrlProvider, UrlMetricRankingEntry>

    expect(report.runs[0]?.leaders.service.price).toBeNull()
    expect(report.runs[0]?.leaders.service.speed).toBeNull()
    expect(report.runs[0]?.leaders.service.automatedQuality?.providerKey).toBe('missing')
  })

  test('preserves fallback distance provenance alongside recomputed provider scores', () => {
    const root = mkdtempSync(join(tmpdir(), 'autoshow-url-provenance-'))
    tempRoots.push(root)
    const providerDir = join(root, 'providers', 'current')
    mkdirSync(providerDir, { recursive: true })
    const longText = new Array<string>(10_001).fill('same').join(' ')
    writeFileSync(join(root, 'consensus-extraction.txt'), longText)
    writeFileSync(join(providerDir, 'result.json'), JSON.stringify({
      provider: 'current',
      model: 'current',
      metadata: { processingTime: 10, tokenEstimate: 10_001 },
      result: { text: longText }
    }))
    writeFileSync(join(root, 'provider-comparison-report.json'), JSON.stringify({
      schemaVersion: 2,
      kind: 'url-provider-comparison',
      runDir: root,
      normalization: {
        exactLevenshteinElementLimit: 10_000,
        longSequenceDistance: 'rolling-shingle-approximation'
      },
      providerGroups: {
        local: { count: 0, providers: [] },
        service: {
          count: 1,
          providers: [{
            providerKey: 'legacy',
            provider: 'legacy',
            model: 'legacy',
            group: 'service',
            processingTimeMs: 20,
            costCents: 1,
            metrics: { wer: 0.2, cer: 0.1, contentCoverage: 0.8 }
          }]
        }
      }
    }))

    const runner = resolve(import.meta.dir, '../../../../.codex/skills/consensus/scripts/run.ts')
    const result = spawnSync('bun', [runner, 'url', 'build-report', root], { encoding: 'utf8' })
    expect(result.status).toBe(0)

    const report = JSON.parse(
      readFileSync(join(root, 'provider-comparison-report.json'), 'utf8')
    ) as {
      normalization: {
        longSequenceDistance: string
        longSequenceDistanceMethods: string[]
        providerLongSequenceDistance: Record<string, string>
      }
      providerGroups: {
        service: {
          providers: Array<{
            providerKey: string
            distanceMethod: string
            distanceSource: string
          }>
        }
      }
      notes: string[]
    }
    const providers = Object.fromEntries(
      report.providerGroups.service.providers.map((provider) => [provider.providerKey, provider])
    )

    expect(report.normalization.longSequenceDistance).toBe('mixed-by-provider')
    expect(report.normalization.longSequenceDistanceMethods).toEqual([
      LONG_SEQUENCE_DISTANCE_METHOD,
      'rolling-shingle-approximation'
    ])
    expect(report.normalization.providerLongSequenceDistance).toEqual({
      current: LONG_SEQUENCE_DISTANCE_METHOD,
      legacy: 'rolling-shingle-approximation'
    })
    expect(providers['current']?.distanceMethod).toBe(LONG_SEQUENCE_DISTANCE_METHOD)
    expect(providers['current']?.distanceSource).toBe('recomputed')
    expect(providers['legacy']?.distanceMethod).toBe('rolling-shingle-approximation')
    expect(providers['legacy']?.distanceSource).toBe('fallback')
    expect(report.notes).toContain(
      'Fallback provider rows retain their source distance method: rolling-shingle-approximation.'
    )
  })

  test('rejects unsafe inventory hyperlink protocols while retaining readable text', () => {
    const root = mkdtempSync(join(tmpdir(), 'autoshow-url-combined-'))
    tempRoots.push(root)
    writeFixtureRun(root, 'unsafe-run', [], [{
      providerKey: 'service', processingTimeMs: 100, costCents: 1,
      wer: 0, cer: 0, contentCoverage: 1, sourceQuality: 100
    }], {
      title: '<Unsafe & Article>',
      sourceUrl: 'javascript:alert(1)'
    })

    const result = buildUrlCombinedReport(root, '2026-07-18T00:00:00.000Z')
    expect(result.html).not.toContain('href="javascript:')
    expect(result.html).toContain('&lt;Unsafe &amp; Article&gt;')
    expect(result.html).toContain('javascript:alert(1)')
  })

  test('escapes remote HTML and Markdown syntax in inventory link labels', () => {
    const root = mkdtempSync(join(tmpdir(), 'autoshow-url-combined-'))
    tempRoots.push(root)
    writeFixtureRun(root, 'hostile-title-run', [], [{
      providerKey: 'service', processingTimeMs: 100, costCents: 1,
      wer: 0, cer: 0, contentCoverage: 1, sourceQuality: 100
    }], {
      title: '[Trusted](https://spoof.test) <script>alert(1)</script> **bold** | cell',
      sourceUrl: 'https://example.com/article'
    })

    const result = buildUrlCombinedReport(root, '2026-07-18T00:00:00.000Z')

    expect(result.markdown).not.toContain('[Trusted](https://spoof.test)')
    expect(result.markdown).not.toContain('<script>')
    expect(result.markdown).not.toContain('**bold**')
    expect(result.markdown).toContain(
      '[&#91;Trusted&#93;&#40;https://spoof.test&#41; &lt;script&gt;alert&#40;1&#41;&lt;/script&gt; &#42;&#42;bold&#42;&#42; &#124; cell](<https://example.com/article>)'
    )
  })

  test('percent-encodes Markdown table delimiters in inventory URLs', () => {
    const root = mkdtempSync(join(tmpdir(), 'autoshow-url-combined-'))
    tempRoots.push(root)
    writeFixtureRun(root, 'pipe-url-run', [], [{
      providerKey: 'service', processingTimeMs: 100, costCents: 1,
      wer: 0, cer: 0, contentCoverage: 1, sourceQuality: 100
    }], {
      title: 'Pipe URL',
      sourceUrl: 'https://example.com/article|section?q=left|right'
    })

    const result = buildUrlCombinedReport(root, '2026-07-18T00:00:00.000Z')

    expect(result.markdown).toContain(
      '[Pipe URL](<https://example.com/article%7Csection?q=left%7Cright>)'
    )
    expect(result.markdown).toContain(
      '<https://example.com/article%7Csection?q=left%7Cright>'
    )
    expect(result.markdown).not.toContain('https://example.com/article|section')
  })

  test('reports explicit human-quality evidence without an absence note', () => {
    const root = mkdtempSync(join(tmpdir(), 'autoshow-url-combined-'))
    tempRoots.push(root)
    writeFixtureRun(root, 'human-quality-run', [], [{
      providerKey: 'service', processingTimeMs: 100, costCents: 1,
      wer: 0, cer: 0, contentCoverage: 1, sourceQuality: 100, humanQuality: 88
    }])

    const result = buildUrlCombinedReport(root, '2026-07-18T00:00:00.000Z')
    const report = result.report as unknown as UrlCombinedArtifact<AggregatedUrlProvider, UrlMetricRankingEntry>
    const presenceNote = '1 explicit human-quality row is present; URL combined schema v1 does not mix it into automated-quality rankings.'

    expect(report.humanQualityRowCount).toBe(1)
    expect(report.notes).toContain(presenceNote)
    expect(report.notes.some((note) => note.includes('rows are absent'))).toBe(false)
    expect(result.markdown).toContain(presenceNote)
    expect(result.markdown).not.toContain('rows are absent')
    expect(result.html).toContain(presenceNote)
    expect(result.html).not.toContain('rows are absent')
  })
})

describe('committed URL combined dashboard', () => {
  test('captures the seven-run URL schema v1 inventory', () => {
    const artifactRoot = resolve(import.meta.dir, '../../../../docs/benchmarks/url')
    const report = JSON.parse(readFileSync(join(artifactRoot, 'combined-comparison-report.json'), 'utf8')) as UrlCombinedArtifact<AggregatedUrlProvider, UrlMetricRankingEntry>

    expect(report.schemaVersion).toBe(1)
    expect(report.runCount).toBe(7)
    expect(report.providerCount).toBe(6)
    expect(report.providerRowCount).toBe(37)
    expect(report.automatedQualityRowCount).toBe(37)
    expect(report.humanQualityRowCount).toBe(0)
    expect(report.runs).toHaveLength(7)
    expect(report.runs.every((run) => run.articleTitle.length > 0)).toBe(true)
    expect(report.runs.every((run) => run.sourceUrl?.startsWith('https://'))).toBe(true)
    expect(Object.keys(report.weightedRankings['service'] ?? {}).sort()).toEqual([
      'costSpeed',
      'moderateCost',
      'moderateQuality',
      'moderateSpeed',
      'qualityCost',
      'strongCost',
      'strongQuality',
      'strongSpeed'
    ])
    expect(report.tiering['service']?.tiers.map((tier) => tier.count)).toEqual([2, 2, 1])
  })

  test('keeps the retained benchmark summary synchronized with URL aggregates', () => {
    const benchmarkRoot = resolve(import.meta.dir, '../../../../docs/benchmarks')
    const report = JSON.parse(readFileSync(join(benchmarkRoot, 'url', 'combined-comparison-report.json'), 'utf8')) as UrlCombinedArtifact<AggregatedUrlProvider, UrlMetricRankingEntry>
    const summary = readFileSync(join(benchmarkRoot, 'summary.md'), 'utf8')
    const urlSection = summary.split('## URL\n')[1]?.split('\n## Video')[0] ?? ''

    expect(summary).toContain(`| url | ${report.runCount} | ${report.providerRowCount} | local, service |`)
    expect(summary).toContain('| **Total** | **36** | **568** | **5 groups** |')
    expect(urlSection).not.toContain('2/2 runs')

    for (const group of ['local', 'service'] as const) {
      for (const metric of ['price', 'speed', 'automatedQuality'] as const) {
        for (const entry of report.metricRankings[group][metric]) {
          if (entry.value === null) continue
          const average = metric === 'price'
            ? entry.value === 0 ? '$0.00' : `$${entry.value.toFixed(4)}`
            : metric === 'speed'
              ? `${(entry.value / 1000).toFixed(2)}s`
              : `${entry.value.toFixed(2)}/100`
          expect(urlSection).toContain(
            `| ${entry.rank} | ${entry.providerKey} | ${entry.runsCovered}/${report.runCount} runs | ${average} |`
          )
        }
      }
    }
  })

  test('is self-contained, precomputed, and readable without JavaScript', () => {
    const artifactRoot = resolve(import.meta.dir, '../../../../docs/benchmarks/url')
    const html = readFileSync(join(artifactRoot, 'combined-comparison-report.html'), 'utf8')
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? ''

    expect(html).toContain('<style>')
    expect(html).not.toMatch(/<link\b/i)
    expect(html).not.toMatch(/<script[^>]+src=/i)
    expect(html).not.toContain('fetch(')
    expect(html).not.toContain('XMLHttpRequest')
    expect(script).not.toContain('weights.quality')
    expect(script).not.toContain('subscores')
    expect(script).toContain('row.getAttribute("data-c-" + set)')
    expect(html).toContain('<table class="providers">')
    expect(html).toContain('All weighted rankings (rank and composite per weight set)')
    expect(html).toContain('<h3>Per-run automated quality</h3>')
    expect(html).toContain('rel="noreferrer"')
  })
})
