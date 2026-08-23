import {
  describe,
  expect,
  test
} from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { renderCombinedDashboard } from '../../../../.codex/skills/consensus/scripts/shared/combined_report_html'
import type { ArtifactReport } from '~/types'

const projectRoot = resolve(import.meta.dir, '../../../../')

describe('combined-report metric ranking contracts', () => {
  for (const [directory, schemaVersion, groups] of [
    ['ocr', 3, ['local', 'thirdPartyService']],
    ['stt-with-speakers', 4, ['local', 'thirdPartyServiceNonDiarization', 'thirdPartyServiceDiarization']],
    ['stt-without-speakers', 4, ['local', 'thirdPartyServiceNonDiarization', 'thirdPartyServiceDiarization']],
    ['url', 2, ['local', 'service']]
  ] as const) {
    test(`generated ${directory} artifacts rank cost, speed, and quality per group`, () => {
      const artifactRoot = join(projectRoot, 'docs', 'benchmarks', directory)
      const jsonPath = join(artifactRoot, 'combined-comparison-report.json')
      expect(existsSync(jsonPath)).toBe(true)
      const jsonText = readFileSync(jsonPath, 'utf8')
      const markdown = readFileSync(join(artifactRoot, 'combined-comparison-report.md'), 'utf8')
      const html = readFileSync(join(artifactRoot, 'combined-comparison-report.html'), 'utf8')
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
      expect(html).not.toContain('Quality-cost terciles')
      expect(html).not.toContain('quality-cost-terciles-v1')
      expect(html).not.toContain('All weighted rankings')
      expect(html).not.toMatch(/<script[\s>]/i)
      expect(html).toContain('<table class="providers">')
      expect(html).toContain('<h3>Metric rankings</h3>')

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
    const titles = (body: string) => [...body.matchAll(/title="([^"]+)"/g)].map((match) => match[1])

    expect(titles(qualityBody)).toEqual(['best-quality', 'best-cost', 'best-speed'])
    expect(titles(speedBody)).toEqual(['best-speed', 'best-cost', 'best-quality'])
    expect(titles(costBody)).toEqual(['best-cost', 'best-quality', 'best-speed'])
  })

  test('committed stt-with-speakers dashboard exposes quality, cost, and speed sorts', () => {
    const html = readFileSync(
      join(projectRoot, 'docs', 'benchmarks', 'stt-with-speakers', 'combined-comparison-report.html'),
      'utf8',
    )
    expect(html).toContain('class="provider-sort"')
    expect(html).toContain('name="sort-thirdPartyServiceDiarization"')
    expect(html).toContain('value="quality" checked')
    expect(html).toContain('value="speed"')
    expect(html).toContain('value="cost"')
    expect(html).toContain('class="tablewrap sort-quality"')
    expect(html).toContain('class="tablewrap sort-speed"')
    expect(html).toContain('class="tablewrap sort-cost"')
    expect(html).not.toMatch(/<script[\s>]/i)
  })

  test('committed stt-without-speakers dashboard exposes quality, cost, and speed sorts', () => {
    const html = readFileSync(
      join(projectRoot, 'docs', 'benchmarks', 'stt-without-speakers', 'combined-comparison-report.html'),
      'utf8',
    )
    expect(html).toContain('class="provider-sort"')
    expect(html).toContain('name="sort-thirdPartyServiceNonDiarization"')
    expect(html).toContain('value="quality" checked')
    expect(html).toContain('value="speed"')
    expect(html).toContain('value="cost"')
    expect(html).toContain('class="tablewrap sort-quality"')
    expect(html).toContain('class="tablewrap sort-speed"')
    expect(html).toContain('class="tablewrap sort-cost"')
    expect(html).not.toMatch(/<script[\s>]/i)
  })
})
