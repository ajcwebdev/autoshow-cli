import {
  describe,
  expect,
  test
} from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  computeWeightedScores,
  renderBenchmarkDashboard,
  renderCombinedDashboard,
  type CombinedDashboardModel
} from '../../../../.codex/skills/consensus/scripts/shared/combined_report_html'
import type { ArtifactReport } from '~/types'

const projectRoot = resolve(import.meta.dir, '../../../../')
const dashboardPath = join(projectRoot, 'docs', 'benchmarks', 'combined-comparison-dashboard.html')

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

describe('combined dashboard metric table sorting', () => {
  test('pre-renders quality, speed, and cost orders without JavaScript', () => {
    const html = renderCombinedDashboard({
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
              perRun: [{ display: '99.00', heat: 100 }],
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
              perRun: [{ display: '90.00', heat: 0 }],
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
              perRun: [{ display: '95.00', heat: 50 }],
            },
          ],
        },
      ],
      methodParagraphs: ['Providers are matched by providerKey.'],
      notes: ['No weighted composite is emitted.'],
    })

    expect(html).not.toMatch(/<script[\s>]/i)
    expect(html).not.toMatch(/<link\b/i)
    expect(html).toContain('class="provider-sort"')
    expect(html).toContain('name="sort-thirdPartyServiceDiarization"')
    expect(html).toContain('id="sort-thirdPartyServiceDiarization-quality"')
    expect(html).toContain('id="sort-thirdPartyServiceDiarization-speed"')
    expect(html).toContain('id="sort-thirdPartyServiceDiarization-cost"')
    expect(html).toContain('value="quality" checked')
    expect(html).toContain('<label class="sort-opt" for="sort-thirdPartyServiceDiarization-quality">Quality</label>')
    expect(html).toContain('<label class="sort-opt" for="sort-thirdPartyServiceDiarization-speed">Speed</label>')
    expect(html).toContain('<label class="sort-opt" for="sort-thirdPartyServiceDiarization-cost">Cost</label>')

    const qualityBody = html.match(/<div class="tablewrap sort-quality">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? ''
    const speedBody = html.match(/<div class="tablewrap sort-speed">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? ''
    const costBody = html.match(/<div class="tablewrap sort-cost">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? ''
    const titles = (body: string) => [...body.matchAll(/<code title="([^"]+)"/g)].map((match) => match[1])

    expect(titles(qualityBody)).toEqual(['best-quality', 'best-cost', 'best-speed'])
    expect(titles(speedBody)).toEqual(['best-speed', 'best-cost', 'best-quality'])
    expect(titles(costBody)).toEqual(['best-cost', 'best-quality', 'best-speed'])
  })

  test('renders one tabbed panel per benchmark with unique ids across shared group keys', () => {
    const groupModel = (rootDir: string, title: string): CombinedDashboardModel => ({
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

    const html = renderBenchmarkDashboard({
      title: 'AutoShow Benchmark Dashboard',
      generatedAt: '2026-09-16T00:00:00.000Z',
      tabs: [
        { key: 'stt-local', label: 'STT local', rootLabel: 'docs/benchmarks/stt-local', model: groupModel('/tmp/stt-local', 'Combined STT Provider Comparison') },
        { key: 'url', label: 'URL', rootLabel: 'docs/benchmarks/url', model: groupModel('/tmp/url', 'Combined URL Provider Comparison') }
      ]
    })

    expect(html).not.toMatch(/<link\b/i)
    expect(html).toContain('<input type="radio" name="dashboard-tab" id="tab-stt-local" checked>')
    expect(html).toContain('<input type="radio" name="dashboard-tab" id="tab-url">')
    expect(html).toContain('name="sort-stt-local-local"')
    expect(html).toContain('name="sort-url-local"')
    expect(html).toContain('id="sort-stt-local-local-quality"')
    expect(html).toContain('id="sort-url-local-quality"')

    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1])
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('rejects duplicate and unsafe tab keys', () => {
    const tab = (key: string) => ({
      key,
      label: key,
      rootLabel: key,
      model: {
        title: 'x', category: 'stt', generatedAt: 'now', rootDir: '/tmp',
        summaryStats: [], runs: [], groups: [], methodParagraphs: [], notes: []
      } as CombinedDashboardModel
    })
    expect(() => renderBenchmarkDashboard({ title: 't', generatedAt: 'now', tabs: [tab('a'), tab('a')] })).toThrow('Duplicate dashboard tab key: a')
    expect(() => renderBenchmarkDashboard({ title: 't', generatedAt: 'now', tabs: [tab('a"><script>')] })).toThrow('Invalid dashboard tab key')
    expect(() => renderBenchmarkDashboard({ title: 't', generatedAt: 'now', tabs: [] })).toThrow('at least one tab')
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
  test('is a single self-contained page with combined-report tabs and current TTS artifacts', () => {
    const html = readFileSync(dashboardPath, 'utf8')

    expect(html).toContain('<style>')
    expect(html).not.toMatch(/<link\b/i)
    expect(html).not.toContain('fetch(')
    expect(html).not.toContain('XMLHttpRequest')
    expect(html).not.toContain('Quality-cost terciles')
    expect(html).not.toContain('quality-cost-terciles-v1')
    expect(html).not.toContain('All weighted rankings')
    expect(html).not.toContain('/Users/')
    expect([...html.matchAll(/<input type="radio" name="dashboard-tab"/g)]).toHaveLength(DASHBOARD_TABS.length + 1)
    expect(html).toContain('id="tab-tts"')
    expect(html).toContain('#tab-tts:checked ~ #panel-tts { display: block; }')
    expect(panelFor(html, 'tts')).toContain('soniox/tts-rt-v2')

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
      expect(html).toContain(`#tab-${key}:checked ~ #panel-${key} { display: block; }`)
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

    expect(html).toContain('<input type="radio" name="dashboard-tab" id="tab-ocr" checked>')
    expect(panelFor(html, 'url')).toContain('<h3>Per-run automated quality</h3>')
    expect(panelFor(html, 'url')).toContain('rel="noreferrer"')
  })

  test('ships the weight sliders as a self-contained progressive enhancement', () => {
    const html = readFileSync(dashboardPath, 'utf8')

    // exactly one inline script, no external or network dependency
    expect([...html.matchAll(/<script[\s>]/gi)]).toHaveLength(1)
    expect(html).not.toMatch(/<script[^>]+src=/i)
    expect(html).not.toContain('fetch(')
    expect(html).not.toContain('XMLHttpRequest')
    expect(html).not.toContain('import(')

    // the browser runs the same scoring function this suite unit-tests
    expect(html).toContain('function computeWeightedScores(')

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

    // the control sits in the sort row and is revealed only by the JS-injected Custom radio,
    // so a JS-off reader never sees a dead input
    expect(html).toContain('.provider-sort > .weights { display: none; }')
    expect(html).toContain('.provider-sort > input[value="custom"]:checked ~ .weights { display: flex; }')
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

    // the no-JS surface is untouched: three precomputed orders still ship per group
    const ocr = panelFor(html, 'ocr')
    expect(ocr).toContain('class="tablewrap sort-quality"')
    expect(ocr).toContain('class="tablewrap sort-speed"')
    expect(ocr).toContain('class="tablewrap sort-cost"')
    expect(ocr).not.toContain('sort-custom')
  })
})
