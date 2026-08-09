import { basename, join } from 'node:path'
import type { BenchmarkSurfaceGroupBase, JsonObject, MediaComparisonReportOptions, MediaComparisonRowProvider, ProviderComparisonMarkdownOptions, ProviderComparisonRankingSurfaces, ProviderGroupRows } from '~/types'
import { escapeCell, formatCost, formatScore, formatSeconds, getArray, getNumber, getObject, getString, isRecord } from './benchmark-utils'

export const splitProviderComparisonRows = (rows: readonly JsonObject[]): ProviderGroupRows => ({
  local: rows.filter((row) => getString(row, 'group') === 'local'),
  service: rows.filter((row) => getString(row, 'group') !== 'local')
})

const surfaceEntry = (
  row: JsonObject,
  index: number,
  metric: string,
  value: number | null,
  label: string
): JsonObject => ({
  rank: index + 1,
  providerKey: getString(row, 'providerKey') ?? 'unknown',
  provider: getString(row, 'provider') ?? getString(row, 'providerKey') ?? 'unknown',
  model: row['model'] ?? null,
  group: getString(row, 'group') ?? 'service',
  metric,
  value,
  label
})

const compareOptionalAscending = (left: number | undefined, right: number | undefined): number => {
  if (left === undefined && right === undefined) return 0
  if (left === undefined) return 1
  if (right === undefined) return -1
  return left - right
}

const fullRankingSurface = (
  rows: readonly JsonObject[],
  metric: string,
  valueForRow: (row: JsonObject) => number | undefined,
  labelForValue: (value: number) => string
): JsonObject[] =>
  rows
    .map((row) => ({ row, value: valueForRow(row) }))
    .sort((left, right) => {
      const delta = compareOptionalAscending(left.value, right.value)
      return delta || (getString(left.row, 'providerKey') ?? '').localeCompare(getString(right.row, 'providerKey') ?? '')
    })
    .map((entry, index) =>
      surfaceEntry(
        entry.row,
        index,
        metric,
        entry.value ?? null,
        entry.value === undefined ? 'n/a' : labelForValue(entry.value)
      )
    )

const qualityRankingSurface = (
  rows: readonly JsonObject[],
  metric: string,
  labelForValue: (value: number) => string
): JsonObject[] =>
  rows
    .map((row) => ({ row, value: getNumber(row, metric) }))
    .filter((entry): entry is { row: JsonObject, value: number } => entry.value !== undefined)
    .sort((left, right) =>
      right.value - left.value || (getString(left.row, 'providerKey') ?? '').localeCompare(getString(right.row, 'providerKey') ?? '')
    )
    .map((entry, index) => surfaceEntry(entry.row, index, metric, entry.value, labelForValue(entry.value)))

const unavailableReason = (rows: readonly JsonObject[], surfaceRows: readonly JsonObject[], label: string): string | null => {
  if (rows.length === 0) {
    return 'No providers were found.'
  }
  return surfaceRows.length === 0 ? `No ${label} metric was available for these providers.` : null
}

export const buildMediaRankingSurfaces = (
  rows: readonly JsonObject[],
  options: { qualityLabel: string }
): ProviderComparisonRankingSurfaces => {
  const groups = splitProviderComparisonRows(rows)

  const buildGroup = (groupRows: readonly JsonObject[]): BenchmarkSurfaceGroupBase<JsonObject> => {
    const price = fullRankingSurface(
      groupRows,
      'costCents',
      (row) => getString(row, 'group') === 'local' ? 0 : getNumber(row, 'costCents'),
      (value) => getString(groupRows[0] ?? {}, 'group') === 'local' ? '$0.00 local monetary cost' : formatCost(value)
    )
    const speed = fullRankingSurface(groupRows, 'processingTimeMs', (row) => getNumber(row, 'processingTimeMs'), (value) => formatSeconds(value))
    const automatedQuality = qualityRankingSurface(groupRows, 'qualityScore', (value) => `${formatScore(value)}/100`)
    const humanQuality: JsonObject[] = []
    const qualityAlias = humanQuality.length > 0 ? humanQuality : automatedQuality

    return {
      fastest: speed,
      cheapest: price,
      highestQuality: qualityAlias,
      fastestUnavailableReason: speed.length === 0 && groupRows.length === 0 ? 'No providers were found.' : null,
      cheapestUnavailableReason: price.length === 0 && groupRows.length === 0 ? 'No providers were found.' : null,
      highestQualityUnavailableReason: unavailableReason(groupRows, qualityAlias, options.qualityLabel),
      price,
      speed,
      automatedQuality,
      humanQuality,
      priceUnavailableReason: price.length === 0 && groupRows.length === 0 ? 'No providers were found.' : null,
      speedUnavailableReason: speed.length === 0 && groupRows.length === 0 ? 'No providers were found.' : null,
      automatedQualityUnavailableReason: unavailableReason(groupRows, automatedQuality, options.qualityLabel),
      humanQualityUnavailableReason: groupRows.length === 0
        ? 'No providers were found.'
        : 'No explicit humanQualityScore was available for these providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.'
    }
  }

  return {
    local: buildGroup(groups.local),
    service: buildGroup(groups.service)
  }
}

export const writeProviderComparisonMarkdown = async (
  path: string,
  options: ProviderComparisonMarkdownOptions
): Promise<void> => {
  const lines = [
    `# ${options.title}`,
    '',
    '## Summary',
    '',
    `- Run directory: \`${options.runDir}\``,
    `- Total providers: ${options.providerCount}`,
    ...(options.summaryMetrics ?? []).map((metric) => `- ${metric.label}: ${metric.value}`),
    `- Judge model: \`${options.judgeModel}\``,
    '- Local and service providers are intentionally not ranked against each other.',
    '',
    '## Method',
    '',
    '- Price rankings use zero monetary cost for local providers and reported monetary cost for services; missing service price stays in the ranking at the end.',
    '- Speed rankings use processing time when present; missing timing stays in the ranking at the end.',
    `- Automated quality rankings use the explicit OpenAI vision judge score from \`${options.qualityReportFileName}\`.`,
    '- Human quality rankings use only explicit `humanQualityScore` evidence.',
    `- ${options.qualityProxyMethodText}`,
    ''
  ]

  for (const group of ['local', 'service'] as const) {
    const title = group === 'local' ? 'Local Providers' : 'Service Providers'
    const groupRows = options.rows.filter((row) => getString(row, 'group') === group)
    const surfaces = getObject(options.rankingSurfaces, group) ?? {}
    lines.push(`## ${title}`, '')

    for (const [heading, key] of [
      ['Price', 'price'],
      ['Speed', 'speed'],
      ['Automated Quality', 'automatedQuality'],
      ['Human Quality', 'humanQuality']
    ] as const) {
      const surfaceRows = getArray(surfaces, key).filter(isRecord)
      const reason = getString(surfaces, `${key}UnavailableReason`)
      lines.push(`### ${heading}`, '')
      if (surfaceRows.length === 0) {
        lines.push(`Unavailable: ${reason ?? 'No eligible providers were found.'}`, '')
        continue
      }

      lines.push('| Rank | Provider | Evidence |', '| ---: | --- | --- |')
      for (const surface of surfaceRows) {
        lines.push(`| ${getNumber(surface, 'rank') ?? ''} | \`${escapeCell(getString(surface, 'providerKey') ?? 'unknown')}\` | ${escapeCell(getString(surface, 'label') ?? '')} |`)
      }
      lines.push('')
    }

    lines.push('### Provider Detail', '')
    if (groupRows.length === 0) {
      lines.push(`No ${group} providers were found.`, '')
      continue
    }

    lines.push('| Provider | Quality Evidence | Processing Time | Monetary Cost |', '| --- | --- | ---: | ---: |')
    for (const row of groupRows) {
      lines.push(`| \`${escapeCell(getString(row, 'providerKey') ?? 'unknown')}\` | ${escapeCell(getString(row, 'qualityLabel') ?? 'n/a')} | ${formatSeconds(getNumber(row, 'processingTimeMs'))} | ${formatCost(getNumber(row, 'costCents'))} |`)
    }
    lines.push('')
  }

  lines.push(
    '## Notes',
    '',
    ...options.notes
  )

  await Bun.write(path, `${lines.join('\n')}\n`)
}

export const baseMediaComparisonRow = (provider: MediaComparisonRowProvider): JsonObject => ({
  rank: provider.rank,
  providerKey: provider.providerKey,
  provider: provider.providerKey,
  model: null,
  group: provider.group,
  processingTimeMs: provider.processingTimeMs ?? null,
  actualProcessingTimeMs: provider.processingTimeMs ?? null,
  costCents: provider.costCents ?? null,
  actualCostCents: provider.costCents ?? null,
  qualityScore: provider.qualityScore,
  qualityMetric: provider.qualityMetric,
  qualityValue: provider.qualityScore,
  qualityLabel: `${formatScore(provider.qualityScore)}/100`,
  metrics: {
    wer: null,
    cer: null,
    speakerAwareWER: null,
    textOnlyWER: null,
    roundtripWER: null,
    contentCoverage: null,
    qualityScore: provider.qualityScore
  },
  supportsDiarization: null,
  diarizationSupport: null,
  tierGroup: null,
  groupOverallRank: null,
  groupTier: null,
  qualityWarnings: [],
  segmentStats: null,
  duplicateGroupId: null
})

export const writeMediaComparisonReports = async (
  runDir: string,
  options: MediaComparisonReportOptions
): Promise<{ jsonOut: string, markdownOut: string }> => {
  const { category, categoryLabel, proxyNoun, report, rows, summaryMetrics } = options
  const { local: localProviders, service: serviceProviders } = splitProviderComparisonRows(rows)
  const rankingSurfaces = buildMediaRankingSurfaces(rows, { qualityLabel: `${category} quality` })
  const jsonOut = join(runDir, 'provider-comparison-report.json')
  const markdownOut = join(runDir, 'provider-comparison-report.md')

  const comparisonReport: JsonObject = {
    schemaVersion: 2,
    kind: `${category}-provider-comparison`,
    category,
    runDir,
    runName: basename(runDir),
    generatedAt: report.generatedAt,
    metric: `${category}-quality-price-speed`,
    scoreFormula: `Automated quality ranking uses OpenAI ${category} quality score; price and speed surfaces remain independent.`,
    tiering: null,
    duplicateGroups: [],
    normalization: null,
    providerCount: report.providerCount,
    providerGroups: {
      local: { count: localProviders.length, providers: localProviders },
      service: { count: serviceProviders.length, providers: serviceProviders }
    },
    providers: rows,
    rankingSurfaces,
    combinedLeaderboardPolicy: 'omitted: local and service providers are not ranked against each other',
    notes: [
      `Automated quality rankings use explicit ${category} judge scores from ${category}-quality-report.json.`,
      `Price and speed surfaces are evidence-only and do not affect ${category} quality scores.`,
      `${categoryLabel} mode evaluates existing generated ${category}s only; it does not generate new ${category}s.`
    ]
  }

  await Bun.write(jsonOut, `${JSON.stringify(comparisonReport, null, 2)}\n`)
  await writeProviderComparisonMarkdown(markdownOut, {
    title: `${categoryLabel} Provider Comparison Report`,
    runDir: report.runDir,
    providerCount: report.providerCount,
    ...(summaryMetrics ? { summaryMetrics } : {}),
    judgeModel: report.judge.model,
    qualityReportFileName: `${category}-quality-report.json`,
    qualityProxyMethodText: `File size, ${proxyNoun}, latency, and cost are not used as quality proxies.`,
    rows,
    rankingSurfaces,
    notes: [
      `- ${categoryLabel} mode evaluates existing generated ${category}s only; it does not generate new ${category}s.`,
      `- Quality scores are explicit judge scores and are not inferred from file size, ${proxyNoun}, latency, or cost.`
    ]
  })

  return { jsonOut, markdownOut }
}
