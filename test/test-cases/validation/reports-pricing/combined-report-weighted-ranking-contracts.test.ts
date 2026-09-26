import {
  describe,
  expect,
  test
} from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  DASHBOARD_CLIENT_SCRIPT,
  DASHBOARD_CLIENT_STYLESHEET,
  renderBenchmarkDashboard,
  type BenchmarkDashboardData,
  type BenchmarkDashboardTab,
  type CombinedDashboardModel
} from '../../../../.codex/skills/consensus/scripts/shared/combined_report_html'
import {
  computeWeightedScores,
  renderDashboard,
  renderTabPanel
} from '../../../../.codex/skills/consensus/scripts/shared/dashboard_client.js'
import { dashboardAssetNames } from '../../../../.codex/skills/consensus/scripts/shared/build_combined_dashboard'
import { buildTtsDashboard } from '../../../../.codex/skills/consensus/scripts/tts/build_tts_dashboard'
import type { ArtifactReport } from '~/types'

const projectRoot = resolve(import.meta.dir, '../../../../')
const benchmarksRoot = join(projectRoot, 'docs', 'benchmarks')
const dashboardPath = join(benchmarksRoot, 'combined-comparison-dashboard.html')
const dataPath = join(benchmarksRoot, 'combined-comparison-dashboard.json')
const stylesheetPath = join(benchmarksRoot, 'combined-comparison-dashboard.css')
const scriptPath = join(benchmarksRoot, 'combined-comparison-dashboard.js')
const STYLESHEET_LINK = '<link rel="stylesheet" href="combined-comparison-dashboard.css">'
const SCRIPT_TAG = '<script src="combined-comparison-dashboard.js"></script>'
const DATA_SOURCE = 'data-source="combined-comparison-dashboard.json"'

const DASHBOARD_TABS = [
  ['ocr', ['local', 'thirdPartyService']],
  ['stt-local', ['local', 'thirdPartyServiceNonDiarization', 'thirdPartyServiceDiarization']],
  ['stt-with-speakers', ['local', 'thirdPartyServiceNonDiarization', 'thirdPartyServiceDiarization']],
  ['stt-without-speakers', ['local', 'thirdPartyServiceNonDiarization', 'thirdPartyServiceDiarization']],
  ['url', ['local', 'service']]
] as const

const panelFor = (html: string, key: string): string => {
  const body = html.split(`<section class="panel" id="panel-${key}">`)[1] ?? ''
  return (body.split('<section class="panel" id="panel-')[0] ?? '').split('</main>')[0] ?? ''
}

const emptyModel = (title = 'x'): CombinedDashboardModel => ({
  title, category: 'stt', generatedAt: 'now', rootDir: '/tmp',
  summaryStats: [], runs: [], groups: [], methodParagraphs: [], notes: []
})

const stubTab = (key: string): BenchmarkDashboardTab => ({ key, label: key, rootLabel: key, model: emptyModel() })

const readCommittedData = (): BenchmarkDashboardData => JSON.parse(readFileSync(dataPath, 'utf8')) as BenchmarkDashboardData

const singleGroupModel = (): CombinedDashboardModel => ({
  title: 'Combined STT Provider Comparison',
  category: 'stt',
  generatedAt: '2026-08-22T00:00:00.000Z',
  rootDir: '/tmp/stt-with-speakers',
  summaryStats: [{ label: 'Runs', value: '1' }],
  runs: [{ runName: '1-audio', shortLabel: 'R1', detail: '1 provider' }],
  groups: [
    {
      key: 'thirdPartyServiceDiarization',
      label: 'Third-Party Service Diarization',
      metricColumns: { quality: 'Quality /100', speed: 'Mean time · throughput', cost: 'Mean cost' },
      metricDirections: { quality: 'higher', speed: 'lower', cost: 'lower' },
      evidenceColumns: ['Mean SA-WER'],
      providers: [
        {
          providerKey: 'best-quality',
          display: 'best-quality',
          model: 'quality',
          coverage: '1/1',
          quality: { display: '99.00', rank: 1 },
          speed: { display: '20.00s', rank: 3 },
          cost: { display: '$0.20', rank: 2 },
          evidence: ['1.00%'],
          perRun: [{ display: '99.00', heat: 100 }]
        },
        {
          providerKey: 'best-speed',
          display: 'best-speed',
          model: 'speed',
          coverage: '1/1',
          quality: { display: '90.00', rank: 3 },
          speed: { display: '2.00s', rank: 1 },
          cost: { display: '$0.30', rank: 3 },
          evidence: ['10.00%'],
          perRun: [{ display: '90.00', heat: 0 }]
        },
        {
          providerKey: 'best-cost',
          display: 'best-cost',
          model: 'cost',
          coverage: '1/1',
          quality: { display: '95.00', rank: 2 },
          speed: { display: '10.00s', rank: 2 },
          cost: { display: '$0.01', rank: 1 },
          evidence: ['5.00%'],
          perRun: [{ display: '95.00', heat: 50 }]
        }
      ]
    }
  ],
  methodParagraphs: ['Providers are matched by providerKey.'],
  notes: ['No weighted composite is emitted.']
})

const localGroupModel = (rootDir: string, title: string): CombinedDashboardModel => ({
  title,
  category: 'stt',
  generatedAt: '2026-09-16T00:00:00.000Z',
  rootDir,
  summaryStats: [{ label: 'Runs', value: '1' }],
  runs: [{ runName: '1-audio', shortLabel: 'R1', detail: '1 provider' }],
  groups: [
    {
      key: 'local',
      label: 'Local',
      metricColumns: { quality: 'Quality /100', speed: 'Mean time', cost: 'Mean cost' },
      metricDirections: { quality: 'higher', speed: 'lower', cost: 'lower' },
      evidenceColumns: ['Mean SA-WER'],
      providers: [
        {
          providerKey: 'whisper',
          display: 'whisper',
          model: 'base',
          coverage: '1/1',
          quality: { display: '90.00', rank: 1 },
          speed: { display: '2.00s', rank: 1 },
          cost: { display: '$0.00', rank: 1 },
          evidence: ['5.00%'],
          perRun: [{ display: '90.00', heat: 100 }]
        }
      ]
    }
  ],
  methodParagraphs: ['Providers are matched by providerKey.'],
  notes: ['No weighted composite is emitted.']
})

const twoTabPage = () => ({
  title: 'AutoShow Benchmark Dashboard',
  generatedAt: '2026-09-16T00:00:00.000Z',
  tabs: [
    { key: 'stt-local', label: 'STT local', rootLabel: 'docs/benchmarks/stt-local', model: localGroupModel('/tmp/stt-local', 'Combined STT Provider Comparison') },
    { key: 'url', label: 'URL', rootLabel: 'docs/benchmarks/url', model: localGroupModel('/tmp/url', 'Combined URL Provider Comparison') }
  ]
})

describe('combined-report metric ranking contracts', () => {
  for (const [directory, schemaVersion, groups] of [
    ['ocr', 3, ['local', 'thirdPartyService']],
    ['stt-with-speakers', 4, ['local', 'thirdPartyServiceNonDiarization', 'thirdPartyServiceDiarization']],
    ['stt-without-speakers', 4, ['local', 'thirdPartyServiceNonDiarization', 'thirdPartyServiceDiarization']],
    ['stt-local', 4, ['local', 'thirdPartyServiceNonDiarization', 'thirdPartyServiceDiarization']],
    ['url', 2, ['local', 'service']]
  ] as const) {
    test(`generated ${directory} artifacts rank cost, speed, and quality per group`, () => {
      const artifactRoot = join(projectRoot, 'docs', 'benchmarks', directory)
      const jsonPath = join(artifactRoot, 'combined-comparison-report.json')
      expect(existsSync(jsonPath)).toBe(true)
      const jsonText = readFileSync(jsonPath, 'utf8')
      const markdown = readFileSync(join(artifactRoot, 'combined-comparison-report.md'), 'utf8')
      const report = JSON.parse(jsonText) as ArtifactReport
      const qualityMetric = directory === 'url' ? 'automatedQuality' : 'qualityScore'

      expect(report.schemaVersion).toBe(schemaVersion)
      expect(report.weightedRankings).toBeUndefined()
      expect(report.tiering).toBeUndefined()
      expect(jsonText).not.toContain('"weightSets"')
      expect(jsonText).not.toContain('"weightedRankings"')
      expect(jsonText).not.toContain('"tiering"')
      expect(markdown).not.toContain('#### Weighted Rankings')
      expect(markdown).not.toContain('## Model Tiers')
      expect(markdown).not.toContain('quality-cost-terciles-v1')

      expect(Object.keys(report.metricRankings).sort()).toEqual([...groups].sort())
      for (const group of groups) {
        const rankings = report.metricRankings[group]
        expect(Object.keys(rankings ?? {}).sort()).toEqual(['price', qualityMetric, 'speed'].sort())
        expect(Array.isArray(rankings?.['price'])).toBe(true)
        expect(Array.isArray(rankings?.['speed'])).toBe(true)
        expect(Array.isArray(rankings?.[qualityMetric])).toBe(true)
        expect(markdown).toContain(`#### Price`)
        expect(markdown).toContain(`#### Speed`)
      }

      for (const legacyField of [
        'surfaceCount',
        'topN',
        'thresholds',
        'surfaces',
        'topPlacements',
        'placementSurfaces',
        'balancedComposite',
        'overallMetric',
        'overallWeights'
      ]) {
        expect(jsonText).not.toContain(`"${legacyField}":`)
      }
    })
  }
})

describe('combined dashboard browser renderer', () => {
  test('renders three precomputed orders per group, switched by CSS radios', () => {
    const html = renderTabPanel({ key: 'stt', label: 'STT', rootLabel: 'docs/benchmarks/stt', model: singleGroupModel() })

    expect(html).not.toMatch(/<script[\s>]/i)
    expect(html).toContain('class="provider-sort"')
    expect(html).toContain('name="sort-stt-thirdPartyServiceDiarization"')
    expect(html).toContain('id="sort-stt-thirdPartyServiceDiarization-quality"')
    expect(html).toContain('id="sort-stt-thirdPartyServiceDiarization-speed"')
    expect(html).toContain('id="sort-stt-thirdPartyServiceDiarization-cost"')
    expect(html).toContain('value="quality" checked')
    expect(html).toContain('<label class="sort-opt" for="sort-stt-thirdPartyServiceDiarization-quality">Quality</label>')
    expect(html).toContain('<label class="sort-opt" for="sort-stt-thirdPartyServiceDiarization-speed">Speed</label>')
    expect(html).toContain('<label class="sort-opt" for="sort-stt-thirdPartyServiceDiarization-cost">Cost</label>')

    const qualityBody = html.match(/<div class="tablewrap sort-quality">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? ''
    const speedBody = html.match(/<div class="tablewrap sort-speed">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? ''
    const costBody = html.match(/<div class="tablewrap sort-cost">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? ''
    const titles = (body: string) => [...body.matchAll(/<code title="([^"]+)"/g)].map((match) => match[1])

    expect(titles(qualityBody)).toEqual(['best-quality', 'best-cost', 'best-speed'])
    expect(titles(speedBody)).toEqual(['best-speed', 'best-cost', 'best-quality'])
    expect(titles(costBody)).toEqual(['best-cost', 'best-quality', 'best-speed'])
  })

  test('renders one tabbed panel per benchmark with unique ids across shared group keys', () => {
    const page = twoTabPage()
    const html = renderDashboard({ schemaVersion: 1, ...page })

    expect(html).toContain('<h1>AutoShow Benchmark Dashboard</h1>')
    expect(html).toContain('Generated 2026-09-16T00:00:00.000Z &middot; 2 combined benchmark roots')
    expect(html).toContain('<input type="radio" name="dashboard-tab" id="tab-stt-local" checked>')
    expect(html).toContain('<input type="radio" name="dashboard-tab" id="tab-url">')
    expect(html).toContain('<label for="tab-stt-local">STT local</label>')
    expect(html).toContain('<section class="panel" id="panel-stt-local">')
    expect(html).toContain('<section class="panel" id="panel-url">')
    expect(html).toContain('name="sort-stt-local-local"')
    expect(html).toContain('name="sort-url-local"')
    expect(html).toContain('id="sort-stt-local-local-quality"')
    expect(html).toContain('id="sort-url-local-quality"')

    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1])
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('rejects duplicate and unsafe tab keys in the builder and in the browser renderer', () => {
    const data = (tabs: BenchmarkDashboardTab[]): BenchmarkDashboardData => ({ schemaVersion: 1, title: 't', generatedAt: 'now', tabs })

    expect(() => renderBenchmarkDashboard({ title: 't', generatedAt: 'now', tabs: [stubTab('a'), stubTab('a')] })).toThrow('Duplicate dashboard tab key: a')
    expect(() => renderBenchmarkDashboard({ title: 't', generatedAt: 'now', tabs: [stubTab('a"><script>')] })).toThrow('Invalid dashboard tab key')
    expect(() => renderBenchmarkDashboard({ title: 't', generatedAt: 'now', tabs: [] })).toThrow('at least one tab')

    expect(() => renderDashboard(data([stubTab('a'), stubTab('a')]))).toThrow('Duplicate dashboard tab key: a')
    expect(() => renderDashboard(data([stubTab('a"><script>')]))).toThrow('Invalid dashboard tab key')
    expect(() => renderDashboard(data([]))).toThrow('at least one tab')
    expect(() => renderTabPanel(stubTab('../x'))).toThrow('Invalid dashboard tab key')
  })
})

describe('combined dashboard bundle', () => {
  test('writes a static shell that names its data, stylesheet, and script, and data the renderer accepts', () => {
    const page = twoTabPage()
    const bundle = renderBenchmarkDashboard(page)

    // the shell carries no data, tables, or timestamps: everything renders from the JSON at view time
    expect(bundle.html).toContain('<title>AutoShow Benchmark Dashboard</title>')
    expect(bundle.html).toContain(STYLESHEET_LINK)
    expect(bundle.html).toContain(SCRIPT_TAG)
    expect(bundle.html).toContain(`<main class="dashboard" ${DATA_SOURCE}>`)
    expect(bundle.html).toContain('<noscript>')
    expect(bundle.html).not.toMatch(/<style[\s>]/i)
    expect(bundle.html).not.toContain('<table')
    expect(bundle.html).not.toContain('sort-')
    expect(bundle.html).not.toContain('2026-09-16')
    expect(bundle.html).not.toContain('whisper')

    const data = JSON.parse(bundle.data) as BenchmarkDashboardData
    expect(data).toEqual({ schemaVersion: 1, title: page.title, generatedAt: page.generatedAt, tabs: page.tabs })
    expect(bundle.data.endsWith('\n')).toBe(true)
    expect(bundle.data.split('\n').length).toBeGreaterThan(20)
    expect(renderDashboard(data)).toContain('<section class="panel" id="panel-url">')

    // the stylesheet and script are the checked-in client files, copied verbatim
    expect(bundle.stylesheet).toBe(readFileSync(DASHBOARD_CLIENT_STYLESHEET, 'utf8'))
    expect(bundle.script).toBe(readFileSync(DASHBOARD_CLIENT_SCRIPT, 'utf8'))
  })

  test('links only plain sibling asset names and honours custom ones', () => {
    const page = (assets: { stylesheet: string, script: string, data: string }) => ({
      title: 't', generatedAt: 'now', tabs: [stubTab('a')], assets
    })

    const custom = renderBenchmarkDashboard(page({ stylesheet: 'custom-name.css', script: 'custom-name.js', data: 'custom-name.json' }))
    expect(custom.html).toContain('<link rel="stylesheet" href="custom-name.css">')
    expect(custom.html).toContain('<script src="custom-name.js"></script>')
    expect(custom.html).toContain('data-source="custom-name.json"')
    expect(custom.html).not.toContain('combined-comparison-dashboard.')
    expect(dashboardAssetNames('/any/where/dash.html')).toEqual({ stylesheet: 'dash.css', script: 'dash.js', data: 'dash.json' })

    for (const assets of [
      { stylesheet: '../styles.css', script: 'dash.js', data: 'dash.json' },
      { stylesheet: 'assets/styles.css', script: 'dash.js', data: 'dash.json' },
      { stylesheet: 'styles.css', script: 'https://example.com/dash.js', data: 'dash.json' },
      { stylesheet: 'styles.css', script: 'dash..js', data: 'dash.json' },
      { stylesheet: 'styles.js', script: 'dash.js', data: 'dash.json' },
      { stylesheet: 'styles.css', script: 'dash.css', data: 'dash.json' },
      { stylesheet: 'styles.css', script: 'dash.js', data: 'dash.txt' },
      { stylesheet: 'styles.css', script: 'dash.js', data: '/dash.json' },
      { stylesheet: '.css', script: 'dash.js', data: 'dash.json' }
    ]) {
      expect(() => renderBenchmarkDashboard(page(assets))).toThrow('Invalid dashboard asset name')
    }
  })
})

describe('custom weighting composite', () => {
  const directions = { quality: 'higher', speed: 'lower', cost: 'lower' } as const
  const higherSpeed = { quality: 'higher', speed: 'higher', cost: 'lower' } as const

  test('normalises each metric within the group and honours per-metric direction', () => {
    const rows = [
      { quality: 100, speed: 10, cost: 0 },
      { quality: 50, speed: 5, cost: 10 },
      { quality: 0, speed: 0, cost: 20 }
    ]

    expect(computeWeightedScores(rows, { quality: 100, speed: 0, cost: 0 }, directions)).toEqual([100, 50, 0])
    // speed is lower-is-better here, so the 0ms row wins
    expect(computeWeightedScores(rows, { quality: 0, speed: 100, cost: 0 }, directions)).toEqual([0, 50, 100])
    // the same raw values with a higher-is-better speed column invert
    expect(computeWeightedScores(rows, { quality: 0, speed: 100, cost: 0 }, higherSpeed)).toEqual([100, 50, 0])
    expect(computeWeightedScores(rows, { quality: 0, speed: 0, cost: 100 }, directions)).toEqual([100, 50, 0])
  })

  test('rescales weights to sum to one regardless of slider magnitudes', () => {
    const rows = [
      { quality: 100, speed: 0, cost: 0 },
      { quality: 0, speed: 10, cost: 10 }
    ]
    const balanced = computeWeightedScores(rows, { quality: 50, speed: 25, cost: 25 }, directions)

    expect(computeWeightedScores(rows, { quality: 2, speed: 1, cost: 1 }, directions)).toEqual(balanced)
    expect(computeWeightedScores(rows, { quality: 100, speed: 50, cost: 50 }, directions)).toEqual(balanced)
  })

  test('treats an all-zero weight set as equal thirds', () => {
    const rows = [
      { quality: 100, speed: 0, cost: 0 },
      { quality: 0, speed: 10, cost: 10 }
    ]
    expect(computeWeightedScores(rows, { quality: 0, speed: 0, cost: 0 }, directions))
      .toEqual(computeWeightedScores(rows, { quality: 1, speed: 1, cost: 1 }, directions))
  })

  test('scores a row null when a weighted metric is missing, but ignores missing unweighted metrics', () => {
    const rows = [
      { quality: 100, speed: 1, cost: 1 },
      { quality: 50, speed: null, cost: 2 }
    ]

    expect(computeWeightedScores(rows, { quality: 50, speed: 50, cost: 0 }, directions)[1]).toBeNull()
    expect(computeWeightedScores(rows, { quality: 100, speed: 0, cost: 0 }, directions)[1]).toBe(0)
  })

  test('gives every row full credit when a metric has no spread', () => {
    const rows = [
      { quality: 90, speed: 5, cost: 1 },
      { quality: 90, speed: 5, cost: 1 }
    ]
    expect(computeWeightedScores(rows, { quality: 60, speed: 20, cost: 20 }, directions)).toEqual([100, 100])
  })

  test('single-provider groups score 100 rather than dividing by a zero span', () => {
    expect(computeWeightedScores([{ quality: 42, speed: 7, cost: 3 }], { quality: 60, speed: 20, cost: 20 }, directions))
      .toEqual([100])
  })
})

describe('committed benchmark dashboard', () => {
  test('is a static shell whose data, stylesheet, and script are the generated siblings, byte for byte', () => {
    const html = readFileSync(dashboardPath, 'utf8')
    const data = readCommittedData()

    expect(html).not.toMatch(/<style[\s>]/i)
    expect([...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0])).toEqual([STYLESHEET_LINK])
    expect([...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)].map((match) => match[0])).toEqual([SCRIPT_TAG])
    expect(html).toContain(`<main class="dashboard" ${DATA_SOURCE}>`)
    expect(html).toContain('<noscript>')
    expect(html).not.toContain('<table')
    expect(html).not.toContain('Generated ')
    expect(html).not.toContain('/Users/')

    // the shell depends only on the title, and the client files are copied verbatim
    expect(html).toBe(renderBenchmarkDashboard({ title: data.title, generatedAt: data.generatedAt, tabs: data.tabs }).html)
    expect(readFileSync(stylesheetPath, 'utf8')).toBe(readFileSync(DASHBOARD_CLIENT_STYLESHEET, 'utf8'))
    expect(readFileSync(scriptPath, 'utf8')).toBe(readFileSync(DASHBOARD_CLIENT_SCRIPT, 'utf8'))
  })

  test('keeps every combined-report tab and matches the current TTS results, including an empty archive', () => {
    const raw = readFileSync(dataPath, 'utf8')
    const data = JSON.parse(raw) as BenchmarkDashboardData

    expect(data.schemaVersion).toBe(1)
    expect(data.title).toBe('AutoShow Benchmark Dashboard')
    expect(data.tabs.map((tab) => tab.key)).toEqual([...DASHBOARD_TABS.map(([key]) => key), 'tts'])
    expect(raw).not.toContain('/Users/')
    expect(raw).not.toContain('Quality-cost terciles')
    expect(raw).not.toContain('quality-cost-terciles-v1')
    expect(raw).not.toContain('All weighted rankings')

    for (const [key, groups] of DASHBOARD_TABS) {
      const report = JSON.parse(
        readFileSync(join(projectRoot, 'docs', 'benchmarks', key, 'combined-comparison-report.json'), 'utf8')
      ) as ArtifactReport
      const qualityMetric = key === 'url' ? 'automatedQuality' : 'qualityScore'
      const tab = data.tabs.find((candidate) => candidate.key === key)

      expect(tab?.rootLabel).toBe(`docs/benchmarks/${key}`)
      expect(tab?.model.groups.map((group) => group.key)).toEqual([...groups])
      for (const group of groups) {
        const populated = (report.metricRankings[group]?.[qualityMetric] ?? []).length > 0
        expect((tab?.model.groups.find((candidate) => candidate.key === group)?.providers.length ?? 0) > 0).toBe(populated)
      }
    }

    const tts = data.tabs.find((candidate) => candidate.key === 'tts')
    expect(tts?.rootLabel).toBe('docs/benchmarks/tts')
    expect(tts?.model).toEqual(buildTtsDashboard(join(benchmarksRoot, 'tts'), data.generatedAt).dashboardModel)
  })

  test('renders its data into tabbed panels with sortable metric tables', () => {
    const html = renderDashboard(readCommittedData())

    expect(html).toContain('<input type="radio" name="dashboard-tab" id="tab-ocr" checked>')
    expect(html).toContain('id="tab-tts"')
    expect(panelFor(html, 'tts')).toContain('TTS benchmark results')

    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1])
    expect(new Set(ids).size).toBe(ids.length)

    for (const [key, groups] of DASHBOARD_TABS) {
      const report = JSON.parse(
        readFileSync(join(projectRoot, 'docs', 'benchmarks', key, 'combined-comparison-report.json'), 'utf8')
      ) as ArtifactReport
      const qualityMetric = key === 'url' ? 'automatedQuality' : 'qualityScore'
      const panel = panelFor(html, key)

      expect(html).toContain(`id="tab-${key}"`)
      expect(html).toContain(`id="panel-${key}"`)
      expect(panel).toContain(`<code>docs/benchmarks/${key}</code>`)
      expect(panel).toContain('<table class="providers">')
      expect(panel).toContain('<h3>Metric rankings</h3>')
      expect(panel).toContain('value="quality" checked')
      expect(panel).toContain('class="tablewrap sort-quality"')
      expect(panel).toContain('class="tablewrap sort-speed"')
      expect(panel).toContain('class="tablewrap sort-cost"')

      for (const group of groups) {
        const populated = (report.metricRankings[group]?.[qualityMetric] ?? []).length > 0
        expect(panel.includes(`name="sort-${key}-${group}"`)).toBe(populated)
      }
    }

    expect(panelFor(html, 'url')).toContain('<h3>Per-run automated quality</h3>')
    expect(panelFor(html, 'url')).toContain('rel="noreferrer"')
  })

  test('ships the weight sliders as a progressive enhancement in the sibling script', () => {
    const html = renderDashboard(readCommittedData())
    const stylesheet = readFileSync(stylesheetPath, 'utf8')
    const script = readFileSync(scriptPath, 'utf8')

    // the script loads only the relative data-source and is a classic script with no other dependency,
    // so it still runs from file:// and can explain that the JSON needs an HTTP origin
    expect(script).toContain('getAttribute("data-source")')
    expect(script).not.toMatch(/https?:\/\//)
    expect(script).not.toMatch(/^\s*(?:import|export)\b/m)
    expect(script).not.toContain('import(')
    expect(script).not.toContain('XMLHttpRequest')
    expect(script).toContain('file://')
    expect(stylesheet).not.toMatch(/@import|url\(|https?:\/\//)

    // the browser runs the same scoring function this suite unit-tests
    expect(script).toContain('function computeWeightedScores(')

    // every group carries its own slider set, with the documented defaults
    for (const [metric, value] of [['quality', 60], ['speed', 20], ['cost', 20]] as const) {
      expect(html).toContain(`<input type="range" id="w-ocr-thirdPartyService-${metric}" data-weight="${metric}" min="0" max="100" step="1" value="${value}">`)
      expect(html).toContain(`<input type="range" id="w-url-service-${metric}" data-weight="${metric}" min="0" max="100" step="1" value="${value}">`)
    }
    expect(html).toContain('class="weights-reset"')

    // the defaults are a valid split of one 100% budget
    expect(60 + 20 + 20).toBe(100)

    // slider ids are unique per group, so two groups never share a control
    const sliderIds = [...html.matchAll(/<input type="range" id="([^"]+)"/g)].map((match) => match[1] ?? '')
    expect(sliderIds.length).toBe(sliderIds.filter((id) => id.startsWith('w-')).length)
    expect(new Set(sliderIds).size).toBe(sliderIds.length)

    // the control sits in the sort row and is revealed only by the script-injected Custom radio
    expect(stylesheet).toContain('.provider-sort > .weights { display: none; }')
    expect(stylesheet).toContain('.provider-sort > input[value="custom"]:checked ~ .weights { display: flex; }')
    expect(html).not.toMatch(/<input[^>]*value="custom"/)
    for (const key of ['ocr', 'url'] as const) {
      const sortRow = panelFor(html, key).split('<div class="provider-sort"')[1] ?? ''
      expect(sortRow.indexOf('class="weights"')).toBeGreaterThan(sortRow.indexOf('class="sort-opt"'))
      expect(sortRow.indexOf('class="weights"')).toBeLessThan(sortRow.indexOf('class="tablewrap'))
    }

    // raw magnitudes and per-metric direction travel with the markup
    for (const [key, direction] of [['ocr', 'higher'], ['url', 'lower'], ['stt-local', 'lower']] as const) {
      const panel = panelFor(html, key)
      expect(panel).toContain(`data-dir-speed="${direction}"`)
      expect(panel).toMatch(/<tr data-q="[-\d.eE+]+" data-s="[-\d.eE+]+" data-c="[-\d.eE+]+">/)
    }

    // three precomputed orders still ship per group; Custom is added by the script at view time
    const ocr = panelFor(html, 'ocr')
    expect(ocr).toContain('class="tablewrap sort-quality"')
    expect(ocr).toContain('class="tablewrap sort-speed"')
    expect(ocr).toContain('class="tablewrap sort-cost"')
    expect(ocr).not.toContain('sort-custom')
  })
})
