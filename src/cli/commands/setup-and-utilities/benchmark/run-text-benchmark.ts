import { stat } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import type { BenchmarkFlags, BenchmarkProviderGroup, JsonObject, MatchedCostStep, MatchedTimingStep, RankingEntry, RankingSurfaces, SurfaceGroup, TextComparisonReport, TextProviderRow, TextStep3Entry } from '~/types'
import { CLIUsageError, isCLIUsageError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { createKeyValueTable } from '~/utils/app-logger/human-table/human-table'
import { escapeCell, getArray, getNumber, getObject, getString, isRecord } from './benchmark-utils'

const TEXT_QUALITY_UNAVAILABLE_REASON = 'No explicit text quality scores were available. Text benchmark quality is not inferred from length, speed, cost, schema validity, output existence, or subjective judgment.'
const TEXT_HUMAN_QUALITY_UNAVAILABLE_REASON = 'No explicit humanQualityScore was available. Text benchmark human quality is not inferred from length, speed, cost, schema validity, output existence, or subjective judgment.'

const asObjectArray = (value: unknown): JsonObject[] => {
  if (Array.isArray(value)) {
    return value.filter(isRecord)
  }
  return isRecord(value) ? [value] : []
}

const numberFromKeys = (record: JsonObject | undefined, keys: readonly string[]): number | undefined => {
  if (!record) {
    return undefined
  }
  for (const key of keys) {
    const value = getNumber(record, key)
    if (value !== undefined) {
      return value
    }
  }
  return undefined
}

const round3 = (value: number): number => {
  const rounded = Math.round(value * 1000) / 1000
  return Object.is(rounded, -0) ? 0 : rounded
}

export const providerKey = (service: string, model: string): string => `${service}/${model}`

const providerGroup = (service: string): BenchmarkProviderGroup =>
  service === 'llama.cpp' ? 'local' : 'service'

const formatCost = (value: number | null): string => {
  if (value === null) {
    return 'n/a'
  }
  if (value === 0) {
    return '$0.00'
  }
  return `$${(value / 100).toFixed(4)}`
}

const formatDurationMs = (value: number | null): string =>
  value === null ? 'n/a' : `${(value / 1000).toFixed(2)}s`

const formatSpeed = (row: TextProviderRow): string => {
  if (row.msPerUnit !== null) {
    return `${row.msPerUnit.toFixed(3)} ms/1K tokens`
  }
  return formatDurationMs(row.processingTimeMs)
}

const comparableSpeedValue = (row: TextProviderRow): number | null =>
  row.msPerUnit ?? row.processingTimeMs

const compareNullableAscending = (left: number | null, right: number | null): number => {
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  return left - right
}

const surfaceEntry = (
  row: TextProviderRow,
  rank: number,
  metric: string,
  value: number | null,
  label: string
): RankingEntry => ({
  rank,
  providerKey: row.providerKey,
  provider: row.provider,
  model: row.model,
  group: row.group,
  metric,
  value,
  label
})

const costSteps = (runJson: JsonObject, source: 'actual' | 'estimated'): JsonObject[] => {
  const metadata = getObject(runJson, 'metadata')
  const cost = metadata ? getObject(metadata, 'cost') : undefined
  const scope = cost ? getObject(cost, source) : undefined
  return scope ? getArray(scope, 'steps').filter(isRecord) : []
}

const timingSteps = (runJson: JsonObject, source: 'actual' | 'estimated'): JsonObject[] => {
  const metadata = getObject(runJson, 'metadata')
  const timing = metadata ? getObject(metadata, 'timing') : undefined
  const scope = timing ? getObject(timing, source) : undefined
  return scope ? getArray(scope, 'steps').filter(isRecord) : []
}

const stepMatchesProvider = (step: JsonObject, service: string, model: string): boolean =>
  (getString(step, 'step') === undefined || getString(step, 'step') === 'llm')
  && getString(step, 'provider') === service
  && getString(step, 'model') === model

const findCostStep = (runJson: JsonObject, service: string, model: string): MatchedCostStep | null => {
  for (const source of ['actual', 'estimated'] as const) {
    const step = costSteps(runJson, source).find((candidate) => stepMatchesProvider(candidate, service, model))
    const costCents = numberFromKeys(step, ['cost', 'costCents', 'actualCostCents', 'estimatedCostCents', 'totalCost'])
    if (step && costCents !== undefined) {
      return { costCents, source, raw: step }
    }
  }
  return null
}

const findTimingStep = (runJson: JsonObject, service: string, model: string): MatchedTimingStep | null => {
  for (const source of ['actual', 'estimated'] as const) {
    const step = timingSteps(runJson, source).find((candidate) => stepMatchesProvider(candidate, service, model))
    if (!step) {
      continue
    }
    return {
      processingTimeMs: numberFromKeys(step, ['processingTimeMs', 'processingTime']),
      msPerUnit: getNumber(step, 'msPerUnit'),
      throughputValue: getNumber(step, 'throughputValue'),
      throughputUnit: getString(step, 'throughputUnit'),
      rateBasis: getString(step, 'rateBasis'),
      inputMetric: getString(step, 'inputMetric'),
      inputValue: getNumber(step, 'inputValue'),
      timingScope: getString(step, 'timingScope'),
      source,
      raw: step
    }
  }
  return null
}

const normalizeStep3Entries = (runJson: JsonObject): TextStep3Entry[] => {
  const metadata = getObject(runJson, 'metadata')
  if (!metadata) {
    throw CLIUsageError('Text benchmark run.json is missing metadata.')
  }

  const entries = asObjectArray(metadata['step3'])
  if (entries.length === 0) {
    throw CLIUsageError('Text benchmark run.json must contain metadata.step3.')
  }

  return entries.map((entry, index) => {
    const llmService = getString(entry, 'llmService')
    const llmModel = getString(entry, 'llmModel')
    if (!llmService || !llmModel) {
      throw CLIUsageError(`Text benchmark metadata.step3[${index}] must include llmService and llmModel.`)
    }
    return {
      ...entry,
      llmService,
      llmModel,
      processingTime: getNumber(entry, 'processingTime'),
      inputTokenCount: getNumber(entry, 'inputTokenCount'),
      outputTokenCount: getNumber(entry, 'outputTokenCount'),
      outputFileName: getString(entry, 'outputFileName')
    }
  })
}

const outputFileEvidence = async (
  runDir: string,
  outputFileName: string | undefined
): Promise<{ outputFileName: string | null, outputExists: boolean, outputByteSize: number | null }> => {
  if (!outputFileName) {
    return { outputFileName: null, outputExists: false, outputByteSize: null }
  }
  const outputPath = join(runDir, outputFileName)
  const file = Bun.file(outputPath)
  const outputExists = await file.exists()
  return {
    outputFileName,
    outputExists,
    outputByteSize: outputExists ? file.size : null
  }
}

const buildProviderRows = async (
  runDir: string,
  runJson: JsonObject,
  entries: readonly TextStep3Entry[]
): Promise<TextProviderRow[]> => {
  const rows: TextProviderRow[] = []
  for (const entry of entries) {
    const service = entry.llmService
    const model = entry.llmModel
    const inputTokenCount = entry.inputTokenCount ?? 0
    const outputTokenCount = entry.outputTokenCount ?? 0
    const totalTokenCount = inputTokenCount + outputTokenCount
    const cost = findCostStep(runJson, service, model)
    const timing = findTimingStep(runJson, service, model)
    const processingTimeMs = timing?.processingTimeMs ?? entry.processingTime ?? null
    const msPerUnit = timing?.msPerUnit
      ?? (processingTimeMs !== null && totalTokenCount > 0 ? round3(processingTimeMs / (totalTokenCount / 1000)) : null)
    const group = providerGroup(service)
    const output = await outputFileEvidence(runDir, entry.outputFileName)
    const actualCostCents = cost?.source === 'actual' ? cost.costCents : null
    const estimatedCostCents = cost?.source === 'estimated' ? cost.costCents : null
    const costCents = group === 'local' ? 0 : actualCostCents ?? estimatedCostCents
    const explicitAutomatedQualityScore = getNumber(entry, 'automatedQualityScore') ?? getNumber(entry, 'textQualityScore')
    const explicitHumanQualityScore = getNumber(entry, 'humanQualityScore')

    rows.push({
      providerKey: providerKey(service, model),
      provider: service,
      model,
      group,
      llmService: service,
      llmModel: model,
      processingTimeMs,
      actualProcessingTimeMs: timing?.source === 'actual' ? timing.processingTimeMs ?? null : null,
      estimatedProcessingTimeMs: timing?.source === 'estimated' ? timing.processingTimeMs ?? null : null,
      msPerUnit,
      throughputValue: timing?.throughputValue ?? null,
      throughputUnit: timing?.throughputUnit ?? null,
      rateBasis: timing?.rateBasis ?? (msPerUnit !== null ? '1KTokens' : null),
      timingScope: timing?.timingScope ?? (timing?.source === 'actual' ? 'wall' : null),
      timingSource: timing?.source ?? (entry.processingTime !== undefined ? 'metadata.step3.processingTime' : null),
      inputMetric: timing?.inputMetric ?? (totalTokenCount > 0 ? 'tokens' : null),
      inputValue: timing?.inputValue ?? (totalTokenCount > 0 ? totalTokenCount : null),
      costCents,
      actualCostCents,
      estimatedCostCents,
      costSource: cost?.source ?? (group === 'local' ? 'local_zero' : null),
      inputTokenCount,
      outputTokenCount,
      totalTokenCount,
      tokenCountSource: getString(entry, 'tokenCountSource') ?? null,
      providerReturnedModel: getString(entry, 'providerReturnedModel') ?? null,
      providerUsage: isRecord(entry['providerUsage']) ? entry['providerUsage'] : null,
      rawProviderUsage: entry['rawProviderUsage'] ?? null,
      structuredMode: getString(entry, 'structuredMode') ?? null,
      structuredPresetNames: Array.isArray(entry['structuredPresetNames']) ? entry['structuredPresetNames'] : [],
      outputFormat: getString(entry, 'outputFormat') ?? null,
      ...output,
      automatedQualityScore: explicitAutomatedQualityScore ?? null,
      humanQualityScore: explicitHumanQualityScore ?? null,
      qualityMetric: explicitAutomatedQualityScore !== undefined ? 'explicit text quality score' : null,
      qualityValue: explicitAutomatedQualityScore ?? null,
      qualityLabel: explicitAutomatedQualityScore !== undefined ? `${explicitAutomatedQualityScore.toFixed(2)} explicit text quality score` : null,
      metrics: {
        inputTokenCount,
        outputTokenCount,
        totalTokenCount,
        msPerUnit,
        ...(typeof timing?.throughputValue === 'number' ? { throughputValue: timing.throughputValue } : {}),
        ...(typeof explicitAutomatedQualityScore === 'number' ? { automatedQualityScore: explicitAutomatedQualityScore, textQualityScore: explicitAutomatedQualityScore } : {}),
        ...(typeof explicitHumanQualityScore === 'number' ? { humanQualityScore: explicitHumanQualityScore } : {})
      }
    })
  }

  return rows.sort((left, right) => {
    if (left.group !== right.group) {
      return left.group.localeCompare(right.group)
    }
    return left.providerKey.localeCompare(right.providerKey)
  })
}

const priceRanking = (rows: readonly TextProviderRow[], group: BenchmarkProviderGroup): RankingEntry[] =>
  [...rows]
    .sort((left, right) => compareNullableAscending(left.costCents, right.costCents) || left.providerKey.localeCompare(right.providerKey))
    .map((row, index) => surfaceEntry(
      row,
      index + 1,
      group === 'local' ? 'local monetary cost' : 'costCents',
      row.costCents,
      group === 'local' ? '$0.00 local monetary cost' : formatCost(row.costCents)
    ))

const speedRanking = (rows: readonly TextProviderRow[]): RankingEntry[] =>
  [...rows]
    .sort((left, right) => compareNullableAscending(comparableSpeedValue(left), comparableSpeedValue(right)) || left.providerKey.localeCompare(right.providerKey))
    .map((row, index) => surfaceEntry(
      row,
      index + 1,
      row.msPerUnit !== null ? 'msPerUnit' : 'processingTimeMs',
      comparableSpeedValue(row),
      formatSpeed(row)
    ))

const qualityRanking = (
  rows: readonly TextProviderRow[],
  field: 'automatedQualityScore' | 'humanQualityScore',
  metric: string
): RankingEntry[] =>
  rows
    .map((row) => ({ row, value: getNumber(row, field) }))
    .filter((entry): entry is { row: TextProviderRow, value: number } => entry.value !== undefined)
    .sort((left, right) => right.value - left.value || left.row.providerKey.localeCompare(right.row.providerKey))
    .map((entry, index) => surfaceEntry(entry.row, index + 1, metric, entry.value, `${entry.value.toFixed(2)} ${metric}`))

const buildRankingSurfaces = (rows: readonly TextProviderRow[]): RankingSurfaces => {
  const buildGroup = (group: BenchmarkProviderGroup): SurfaceGroup => {
    const groupRows = rows.filter((row) => row.group === group)
    const price = priceRanking(groupRows, group)
    const speed = speedRanking(groupRows)
    const automatedQuality = qualityRanking(groupRows, 'automatedQualityScore', 'explicit text quality score')
    const humanQuality = qualityRanking(groupRows, 'humanQualityScore', 'humanQualityScore')
    const qualityAlias = humanQuality.length > 0 ? humanQuality : automatedQuality
    const emptyReason = groupRows.length === 0 ? `No ${group} providers were found.` : null
    const qualityReason = groupRows.length === 0 ? emptyReason : TEXT_QUALITY_UNAVAILABLE_REASON
    const humanQualityReason = groupRows.length === 0 ? emptyReason : TEXT_HUMAN_QUALITY_UNAVAILABLE_REASON

    return {
      fastest: speed,
      cheapest: price,
      highestQuality: qualityAlias,
      fastestUnavailableReason: emptyReason,
      cheapestUnavailableReason: emptyReason,
      highestQualityUnavailableReason: qualityAlias.length > 0 ? null : qualityReason,
      price,
      speed,
      automatedQuality,
      humanQuality,
      priceUnavailableReason: emptyReason,
      speedUnavailableReason: emptyReason,
      automatedQualityUnavailableReason: automatedQuality.length > 0 ? null : qualityReason,
      humanQualityUnavailableReason: humanQuality.length > 0 ? null : humanQualityReason
    }
  }

  return {
    local: buildGroup('local'),
    service: buildGroup('service')
  }
}

const buildReport = (runDir: string, rows: TextProviderRow[]): TextComparisonReport => {
  const localProviders = rows.filter((row) => row.group === 'local')
  const serviceProviders = rows.filter((row) => row.group === 'service')
  return {
    schemaVersion: 2,
    kind: 'text-provider-comparison',
    category: 'text',
    runDir,
    runName: basename(runDir),
    generatedAt: new Date().toISOString(),
    metric: 'metadata-only price-speed',
    providerCount: rows.length,
    providerGroups: {
      local: {
        count: localProviders.length,
        providers: localProviders
      },
      service: {
        count: serviceProviders.length,
        providers: serviceProviders
      }
    },
    providers: rows,
    rankingSurfaces: buildRankingSurfaces(rows),
    combinedLeaderboardPolicy: 'omitted: local and service providers are not ranked against each other',
    qualityPolicy: 'Text benchmark quality is unavailable unless explicit future quality fields are present. Length, speed, cost, output existence, schema validity, and subjective judgment are not quality proxies.',
    notes: [
      'Text mode scores existing write outputs only and does not call LLM providers.',
      'Price rankings use local zero monetary cost and reported actual or estimated service costs from run.json.',
      'Speed rankings prefer normalized msPerUnit timing when present, falling back to wall-clock processing time.',
      'Automated and human quality rankings require explicit quality fields and are otherwise unavailable.'
    ]
  }
}

const markdownRow = (cells: readonly string[]): string => `| ${cells.join(' | ')} |`

const rankingTable = (entries: readonly RankingEntry[], unavailableReason: string | null): string => {
  if (entries.length === 0) {
    return `Unavailable: ${unavailableReason ?? 'No eligible providers were found.'}`
  }
  return [
    '| Rank | Provider | Evidence |',
    '| ---: | --- | --- |',
    ...entries.map((entry) => markdownRow([
      String(entry.rank),
      `\`${escapeCell(entry.providerKey)}\``,
      escapeCell(entry.label)
    ]))
  ].join('\n')
}

const providerDetailTable = (rows: readonly TextProviderRow[], group: BenchmarkProviderGroup): string => {
  if (rows.length === 0) {
    return `No ${group} providers were found.`
  }
  return [
    '| Provider | Tokens | Speed | Monetary Cost | Output | Quality Evidence |',
    '| --- | ---: | ---: | ---: | --- | --- |',
    ...rows.map((row) => markdownRow([
      `\`${escapeCell(row.providerKey)}\``,
      `${row.inputTokenCount.toLocaleString()} in / ${row.outputTokenCount.toLocaleString()} out`,
      formatSpeed(row),
      formatCost(row.costCents),
      row.outputFileName ? `${escapeCell(row.outputFileName)}${row.outputExists ? '' : ' (missing)'}` : 'n/a',
      getString(row, 'qualityLabel') ?? 'n/a'
    ]))
  ].join('\n')
}

const groupMarkdown = (
  title: string,
  group: BenchmarkProviderGroup,
  rows: readonly TextProviderRow[],
  surfaces: SurfaceGroup
): string => [
  `## ${title}`,
  '',
  '### Price',
  '',
  rankingTable(surfaces.price, surfaces.priceUnavailableReason),
  '',
  '### Speed',
  '',
  rankingTable(surfaces.speed, surfaces.speedUnavailableReason),
  '',
  '### Automated Quality',
  '',
  rankingTable(surfaces.automatedQuality, surfaces.automatedQualityUnavailableReason),
  '',
  '### Human Quality',
  '',
  rankingTable(surfaces.humanQuality, surfaces.humanQualityUnavailableReason),
  '',
  '### Provider Detail',
  '',
  providerDetailTable(rows, group)
].join('\n')

const reportMarkdown = (report: TextComparisonReport): string => {
  const localRows = report.providerGroups.local.providers
  const serviceRows = report.providerGroups.service.providers
  return [
    '# Text Provider Comparison Report',
    '',
    '## Summary',
    '',
    `- Run directory: \`${report.runDir}\``,
    `- Total providers: ${report.providerCount} (${localRows.length} local, ${serviceRows.length} service)`,
    '- Text mode scores existing `write` outputs only and does not call providers.',
    '- Local and service providers are intentionally not ranked against each other.',
    '',
    '## Method',
    '',
    '- Price rankings use zero monetary cost for local LLMs and reported actual or estimated service cost from `run.json`.',
    '- Speed rankings prefer `msPerUnit` normalized timing when present, then fall back to wall-clock processing time.',
    '- Token counts, output file presence, schema mode, speed, and cost are evidence only.',
    '- Text quality is not inferred from length, speed, cost, output existence, schema validity, or subjective judgment.',
    '',
    groupMarkdown('Local Providers', 'local', localRows, report.rankingSurfaces.local),
    '',
    groupMarkdown('Service Providers', 'service', serviceRows, report.rankingSurfaces.service),
    '',
    '## Notes',
    '',
    ...report.notes.map((note) => `- ${note}`),
    ''
  ].join('\n')
}

const loadTextRunJson = async (runDir: string): Promise<JsonObject> => {
  try {
    const dirStat = await stat(runDir)
    if (!dirStat.isDirectory()) {
      throw CLIUsageError(`Text benchmark input must be a run directory: ${runDir}`)
    }
  } catch (error) {
    if (isCLIUsageError(error)) {
      throw error
    }
    throw CLIUsageError(`Text run directory not found: ${runDir}`)
  }

  const runJsonPath = join(runDir, 'run.json')
  try {
    await stat(runJsonPath)
  } catch {
    throw CLIUsageError(`Text run directory is missing run.json: ${runJsonPath}`)
  }

  let parsed: unknown
  try {
    parsed = await Bun.file(runJsonPath).json()
  } catch (error) {
    throw CLIUsageError(`Text benchmark run.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!isRecord(parsed)) {
    throw CLIUsageError('Text benchmark run.json must be a JSON object.')
  }
  const kind = getString(parsed, 'kind')
  if (kind !== 'write') {
    throw CLIUsageError(`run.json kind is "${kind ?? 'unknown'}", expected "write"`)
  }
  return parsed
}

export const writeTextProviderComparisonReports = async (
  runDir: string,
  runJson: JsonObject
): Promise<{ report: TextComparisonReport, jsonOut: string, markdownOut: string }> => {
  const entries = normalizeStep3Entries(runJson)
  const rows = await buildProviderRows(runDir, runJson, entries)
  const report = buildReport(runDir, rows)
  const jsonOut = join(runDir, 'provider-comparison-report.json')
  const markdownOut = join(runDir, 'provider-comparison-report.md')
  await Bun.write(jsonOut, `${JSON.stringify(report, null, 2)}\n`)
  await Bun.write(markdownOut, reportMarkdown(report))
  return { report, jsonOut, markdownOut }
}

export const runTextBenchmark = async (
  input: string | undefined,
  _flags: BenchmarkFlags
): Promise<void> => {
  if (!input) {
    throw CLIUsageError('Text run directory is required. Usage: bun autoshow benchmark <write-run-dir> --text')
  }

  const runDir = resolve(input)
  const runJson = await loadTextRunJson(runDir)
  const { report, jsonOut, markdownOut } = await writeTextProviderComparisonReports(runDir, runJson)

  l.write('info', 'Text Benchmark Report', {
    category: 'artifact',
    humanTable: createKeyValueTable([
      ['runDir', runDir],
      ['providers', report.providerCount],
      ['json', jsonOut],
      ['markdown', markdownOut]
    ]),
    metadata: {
      runDir,
      providerCount: report.providerCount,
      jsonOut,
      markdownOut
    }
  })
}
