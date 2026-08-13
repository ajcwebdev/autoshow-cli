import {
  describe,
  expect,
  test
} from 'bun:test'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  TIERING_METHOD,
  TIERING_RANKING,
  TIERING_TIE_BREAK,
  WEIGHT_SETS,
  WEIGHT_SET_KEYS,
  buildQualityCostTiering,
  computeWeightedRankings,
  qualityCostTercileSizes,
  type ProviderSubscores,
  type WeightedRankingEntry
} from '../../../../.codex/skills/consensus/scripts/shared/combined_report_lib'
import type { ArtifactReport } from '~/types'

const provider = (
  providerKey: string,
  quality: number,
  speed: number,
  cost: number
): ProviderSubscores => ({
  providerKey,
  provider: providerKey,
  model: 'fixture',
  runsCovered: 1,
  subscores: { quality, speed, cost },
  subscoreRunCounts: { quality: 1, speed: 1, cost: 1 },
  missingDimensions: [],
  balancedComposite: (quality + speed + cost) / 3
})

const subscored = [
  provider('higher-quality', 100, 0, 0),
  provider('lower-quality', 0, 0, 100),
  provider('z-identical', 40, 40, 40),
  provider('a-identical', 40, 40, 40)
]

const qualityCostFixture = (count: number): WeightedRankingEntry[] =>
  Array.from({ length: count }, (_, index) => ({
    rank: index + 1,
    providerKey: `provider-${index + 1}`,
    provider: `provider-${index + 1}`,
    model: 'fixture',
    group: 'fixture',
    weightSet: 'qualityCost',
    runsCovered: 1,
    composite: 100 - index,
    subscores: { quality: 100 - index, speed: 50, cost: 100 - index },
    subscoreRunCounts: { quality: 1, speed: 1, cost: 1 },
    missingDimensions: []
  }))

const projectRoot = resolve(import.meta.dir, '../../../../')

const htmlEscape = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

describe('combined-report weighted ranking contracts', () => {
  test('exposes the exact eight-set registry', () => {
    expect(WEIGHT_SET_KEYS).toEqual([
      'strongQuality',
      'moderateQuality',
      'strongSpeed',
      'moderateSpeed',
      'strongCost',
      'moderateCost',
      'qualityCost',
      'costSpeed'
    ])
    expect(WEIGHT_SETS).toEqual({
      strongQuality: { label: 'Strong quality (0.8 quality / 0.1 speed / 0.1 cost)', quality: 0.8, speed: 0.1, cost: 0.1 },
      moderateQuality: { label: 'Moderate quality (0.6 quality / 0.2 speed / 0.2 cost)', quality: 0.6, speed: 0.2, cost: 0.2 },
      strongSpeed: { label: 'Strong speed (0.1 quality / 0.8 speed / 0.1 cost)', quality: 0.1, speed: 0.8, cost: 0.1 },
      moderateSpeed: { label: 'Moderate speed (0.2 quality / 0.6 speed / 0.2 cost)', quality: 0.2, speed: 0.6, cost: 0.2 },
      strongCost: { label: 'Strong cost (0.1 quality / 0.1 speed / 0.8 cost)', quality: 0.1, speed: 0.1, cost: 0.8 },
      moderateCost: { label: 'Moderate cost (0.2 quality / 0.2 speed / 0.6 cost)', quality: 0.2, speed: 0.2, cost: 0.6 },
      qualityCost: { label: 'Quality + cost (0.45 quality / 0.10 speed / 0.45 cost)', quality: 0.45, speed: 0.1, cost: 0.45 },
      costSpeed: { label: 'Cost + speed (0.10 quality / 0.45 speed / 0.45 cost)', quality: 0.1, speed: 0.45, cost: 0.45 }
    })
  })

  test('computes both added formulas and keeps deterministic tie-break ordering', () => {
    const rankings = computeWeightedRankings(subscored, 'fixture')

    expect(rankings.qualityCost.map((entry) => entry.providerKey)).toEqual([
      'higher-quality',
      'lower-quality',
      'a-identical',
      'z-identical'
    ])
    expect(rankings.costSpeed.map((entry) => entry.providerKey)).toEqual([
      'lower-quality',
      'a-identical',
      'z-identical',
      'higher-quality'
    ])

    for (const key of ['qualityCost', 'costSpeed'] as const) {
      const weights = WEIGHT_SETS[key]
      for (const entry of rankings[key]) {
        const expected =
          weights.quality * entry.subscores.quality +
          weights.speed * entry.subscores.speed +
          weights.cost * entry.subscores.cost
        expect(entry.composite).toBeCloseTo(expected, 10)
        expect(entry.rank).toBe(rankings[key].indexOf(entry) + 1)
      }
    }
  })

  test('builds tiers as exact contiguous slices of qualityCost ordering', () => {
    const rankings = computeWeightedRankings(subscored, 'fixture')
    const tiering = buildQualityCostTiering(rankings.qualityCost)

    expect(tiering.method).toBe('quality-cost-terciles-v1')
    expect(tiering.ranking).toBe('qualityCost')
    expect(tiering.tieBreak).toBe('composite-desc, quality-subscore-desc, providerKey-asc')
    expect(tiering.tiers.map((tier) => tier.count)).toEqual([2, 1, 1])
    expect(tiering.tiers.map((tier) => tier.providers.map((entry) => entry.providerKey))).toEqual([
      ['higher-quality', 'lower-quality'],
      ['a-identical'],
      ['z-identical']
    ])
    expect(tiering.tiers.flatMap((tier) => tier.providers)).toEqual(
      rankings.qualityCost.map((entry) => ({
        providerKey: entry.providerKey,
        provider: entry.provider,
        model: entry.model,
        qualityCostRank: entry.rank,
        qualityCostComposite: entry.composite
      }))
    )
  })

  test.each([
    [0, [0, 0, 0]],
    [1, [1, 0, 0]],
    [2, [1, 1, 0]],
    [3, [1, 1, 1]],
    [4, [2, 1, 1]],
    [8, [3, 3, 2]],
    [10, [4, 3, 3]]
  ] as const)('front-loads the remainder for a %i-model group', (count, expectedSizes) => {
    const ranking = qualityCostFixture(count)
    const tiering = buildQualityCostTiering(ranking)
    const flattened = tiering.tiers.flatMap((tier) => tier.providers)

    expect(tiering.tiers).toHaveLength(3)
    expect(tiering.tiers.map((tier) => tier.count)).toEqual([...expectedSizes])
    expect(flattened.map((entry) => entry.providerKey)).toEqual(ranking.map((entry) => entry.providerKey))
    expect(flattened.map((entry) => entry.qualityCostRank)).toEqual(ranking.map((entry) => entry.rank))
    expect(new Set(flattened.map((entry) => entry.providerKey)).size).toBe(count)
  })

  test.each([
    ['ocr', 2],
    ['stt', 3],
    ['url', 1]
  ] as const)('generated %s artifacts use quality-cost terciles', (category, schemaVersion) => {
    const artifactRoot = join(projectRoot, 'docs', 'benchmarks', category)
    const jsonText = readFileSync(join(artifactRoot, 'combined-comparison-report.json'), 'utf8')
    const markdown = readFileSync(join(artifactRoot, 'combined-comparison-report.md'), 'utf8')
    const html = readFileSync(join(artifactRoot, 'combined-comparison-report.html'), 'utf8')
    const report = JSON.parse(jsonText) as ArtifactReport

    expect(report.schemaVersion).toBe(schemaVersion)
    expect(markdown).toContain('`quality-cost-terciles-v1`')
    expect(markdown).toContain("`qualityCost` weighted ranking")
    expect(markdown).toContain('| Models (quality-cost rank · composite) |')
    expect(html).toContain('<h3>Quality-cost terciles</h3>')
    expect(html).toContain('<code>quality-cost-terciles-v1</code>')
    expect(html).toContain('<code>qualityCost</code>')

    for (const [group, tiering] of Object.entries(report.tiering)) {
      expect(Object.keys(report.weightedRankings[group] ?? {}).sort()).toEqual([...WEIGHT_SET_KEYS].sort())
      const qualityCost = report.weightedRankings[group]!.qualityCost
      const flattened = tiering.tiers.flatMap((tier) => tier.providers)

      expect(Object.keys(tiering).sort()).toEqual(['method', 'providerCount', 'ranking', 'tieBreak', 'tiers'])
      expect(tiering.method).toBe(TIERING_METHOD)
      expect(tiering.ranking).toBe(TIERING_RANKING)
      expect(tiering.tieBreak).toBe(TIERING_TIE_BREAK)
      expect(tiering.providerCount).toBe(qualityCost.length)
      expect(tiering.tiers).toHaveLength(3)
      expect(tiering.tiers.map((tier) => tier.count)).toEqual(qualityCostTercileSizes(qualityCost.length))
      expect(
        flattened.map((entry) => ({
          providerKey: entry.providerKey,
          rank: entry.qualityCostRank,
          composite: entry.qualityCostComposite
        }))
      ).toEqual(
        qualityCost.map((entry) => ({
          providerKey: entry.providerKey,
          rank: entry.rank,
          composite: entry.composite
        }))
      )
      expect(new Set(flattened.map((entry) => entry.providerKey)).size).toBe(qualityCost.length)

      for (const provider of flattened) {
        const display = provider.display ?? provider.provider
        const rankAndComposite = `#${provider.qualityCostRank} · ${provider.qualityCostComposite.toFixed(2)}`
        expect(markdown).toContain(`<code>${display}</code> (${rankAndComposite})`)
        expect(html).toContain(`<code>${htmlEscape(display)}</code> <span class="n">${rankAndComposite}</span>`)
      }
    }

    if (category === 'url') {
      expect(report.tiering['service']?.tiers.map((tier) => tier.count)).toEqual([2, 2, 1])
    }

    // Deny-list over the generated artifact, matched at key position (`"<field>":`) rather
    // than as a bare quoted token, so a string *value* that happens to equal one of these
    // names cannot trip it. All three builders emit `JSON.stringify(report, null, 2)`, so
    // every real key carries the colon.
    for (const legacyField of [
      // Tombstones. Fields of the retired placement-surface schema (ADR-012: the current
      // versions "do not expose the former placement-surface counts, thresholds, or
      // placement lists"). No builder can produce these any more, so they guard a revert.
      'surfaceCount',
      'topN',
      'thresholds',
      'surfaces',
      'topPlacements',
      'placementSurfaces',
      // Not a tombstone — this is the entry guarding a live regression path.
      // `balancedComposite` is a real in-memory field: `computeGroupSubscores` sets it on
      // every `ProviderSubscores` row and the HTML dashboard ranks by it via
      // `balancedCells`. It stays out of the JSON only because each builder routes
      // `subscoresByGroup` into `buildDashboardGroup` and never into `jsonReport`.
      // Serializing a subscore row directly would leak it, and this is what catches that.
      'balancedComposite'
    ]) {
      expect(jsonText).not.toContain(`"${legacyField}":`)
    }
  })
})
