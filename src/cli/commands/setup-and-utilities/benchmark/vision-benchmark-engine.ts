import { basename, join, resolve } from 'node:path'
import * as l from '~/utils/app-logger/app-logger'
import { createHumanTable, createKeyValueTable } from '~/utils/app-logger/human-table/human-table'
import { CLIUsageError, ValidationError } from '~/utils/error-handler'
import { average, escapeCell, formatScore, getNumber, getString, optionalAverage, parseJsonObjectFromText, providerGroup, providerKey, round2, runOpenAIJudge, stringArray, uniqueStrings } from './benchmark-utils'
import type { BenchmarkProviderBase, JsonObject, MediaEvaluationBase, QualityEvidenceBase, QualityReportBase, QualityReportRubricBase } from '~/types'

export type VisionCriterion<TKey extends string> = {
  key: TKey
  reportLabel: string
  markdownLabel: string
  promptLine: string
}

type VisionJudgeResult<TKey extends string> = Omit<MediaEvaluationBase<Record<TKey, number>>, 'fileName'>

type VisionProviderStats = Pick<BenchmarkProviderBase, 'processingTimeMs' | 'costCents'>

type VisionProviderSeed<TArtifact> = {
  service: string
  model: string
  artifacts: TArtifact[]
} & VisionProviderStats

type VisionBenchmarkReportSummary = {
  providers: Array<{ rank: number, providerKey: string, qualityScore: number }>
}

export type VisionBenchmarkDescriptor<TFlags, TManifestView, TProvider, TReport extends VisionBenchmarkReportSummary> = {
  label: 'Image' | 'Video'
  usage: string
  artifactLabel: 'images' | 'videos'
  artifactCountKey: 'imageCount' | 'videoCount'
  defaultJudgeModel: string
  judgeModel: (flags: TFlags) => string | undefined
  load: (runDir: string) => Promise<{ manifestView: TManifestView, providers: TProvider[] }>
  artifactCount: (provider: TProvider) => number
  prepare?: (() => void) | undefined
  framesPerArtifact?: number | undefined
  writeQualityReports: (runDir: string, manifestView: TManifestView, providers: readonly TProvider[], judgeModel: string) => Promise<VisionQualityReportOutput<TReport>>
  writeComparisonReports: (runDir: string, report: TReport) => Promise<{ jsonOut: string, markdownOut: string }>
}

export type VisionQualityProvider<TKey extends string> = BenchmarkProviderBase & {
  rank: number
  criterionScores: Record<TKey, number>
  averageScore10: number
  qualityScore: number
  evidence: QualityEvidenceBase
}

export type VisionQualityReport<TKey extends string> = {
  runDir: string
  judge: { model: string }
  providerCount: number
  providers: VisionQualityProvider<TKey>[]
}

export type VisionQualityReportOutput<TReport> = {
  report: TReport
  jsonOut: string
  markdownOut: string
}

export type VisionQualityMarkdownOptions<TKey extends string> = {
  title: string
  artifactLabel: 'Images' | 'Videos'
  artifactCount: number
  extraSummaryMetrics?: ReadonlyArray<{ label: string, value: number }> | undefined
  criteria: readonly VisionCriterion<TKey>[]
  rubricCriteria: string
  extraRubricLines?: readonly string[] | undefined
}

const createJudgeSchema = <TKey extends string>(criteria: readonly VisionCriterion<TKey>[]): JsonObject => ({
  type: 'object',
  additionalProperties: false,
  required: [...criteria.map(({ key }) => key), 'summary', 'strengths', 'issues'],
  properties: {
    ...Object.fromEntries(criteria.map(({ key }) => [key, { type: 'integer', minimum: 1, maximum: 10 }])),
    summary: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' } },
    issues: { type: 'array', items: { type: 'string' } }
  }
})

export const judgeVisionArtifact = async <TKey extends string>(options: {
  domain: 'image' | 'video'
  providerKey: string
  fileName: string
  model: string
  content: unknown[]
  criteria: readonly VisionCriterion<TKey>[]
}): Promise<VisionJudgeResult<TKey>> => {
  const stage = `benchmark:${options.domain}-judge`
  const { rawText, usage } = await runOpenAIJudge(
    options.model,
    options.content,
    `${options.domain}_quality_evaluation`,
    createJudgeSchema(options.criteria),
    `OpenAI ${options.domain} judge returned no text for ${options.providerKey} ${options.fileName}.`,
    stage
  )
  const parsed = parseJsonObjectFromText(rawText, `OpenAI ${options.domain} judge response was not a JSON object.`)
  const criterionScores = {} as Record<TKey, number>
  for (const { key } of options.criteria) {
    const value = getNumber(parsed, key)
    if (value === undefined || value < 1 || value > 10) {
      throw ValidationError(`OpenAI ${options.domain} judge response field ${key} must be a number from 1 through 10.`, { stage })
    }
    criterionScores[key] = value
  }

  const summary = getString(parsed, 'summary')
  if (!summary) {
    throw ValidationError(`OpenAI ${options.domain} judge response field summary must be a non-empty string.`, { stage })
  }

  const averageScore10 = round2(average(Object.values(criterionScores)))
  return {
    criterionScores,
    averageScore10,
    qualityScore: round2(averageScore10 * 10),
    summary,
    strengths: stringArray(parsed, 'strengths'),
    issues: stringArray(parsed, 'issues'),
    ...(usage ? { usage } : {})
  }
}

export const summarizeVisionEvaluations = <TKey extends string>(
  criteria: readonly VisionCriterion<TKey>[],
  evaluations: readonly MediaEvaluationBase<Record<TKey, number>>[]
): {
    criterionScores: Record<TKey, number>
    averageScore10: number
    qualityScore: number
    evidence: QualityEvidenceBase
  } => {
  const criterionScores = {} as Record<TKey, number>
  for (const { key } of criteria) {
    criterionScores[key] = round2(average(evaluations.map((evaluation) => evaluation.criterionScores[key])))
  }
  return {
    criterionScores,
    averageScore10: round2(average(evaluations.map((evaluation) => evaluation.averageScore10))),
    qualityScore: round2(average(evaluations.map((evaluation) => evaluation.qualityScore))),
    evidence: {
      summary: evaluations.map((evaluation) => `${evaluation.fileName}: ${evaluation.summary}`).join(' '),
      strengths: uniqueStrings(evaluations.flatMap((evaluation) => evaluation.strengths)),
      issues: uniqueStrings(evaluations.flatMap((evaluation) => evaluation.issues))
    }
  }
}

export const rankVisionProviders = <TProvider extends { providerKey: string, qualityScore: number }>(
  providers: readonly TProvider[]
): Array<TProvider & { rank: number }> => providers
  .slice()
  .sort((left, right) => right.qualityScore - left.qualityScore || left.providerKey.localeCompare(right.providerKey))
  .map((provider, index) => ({ rank: index + 1, ...provider }))

export const resolveVisionProviders = async <TEntry, TArtifact, TProvider extends BenchmarkProviderBase>(options: {
  entries: readonly TEntry[]
  identity: (entry: TEntry) => { service: string, model: string }
  stats: (entry: TEntry) => VisionProviderStats
  artifacts: (entry: TEntry) => Promise<TArtifact[]>
  statsPolicy: 'first' | 'average'
  assemble: (base: BenchmarkProviderBase, artifacts: TArtifact[]) => TProvider
}): Promise<TProvider[]> => {
  const groups = new Map<string, VisionProviderSeed<TArtifact>>()
  const groupedStats = new Map<string, VisionProviderStats[]>()

  for (const entry of options.entries) {
    const { service, model } = options.identity(entry)
    const key = providerKey(service, model)
    const stats = options.stats(entry)
    const existing = groups.get(key)
    if (existing) {
      existing.artifacts.push(...await options.artifacts(entry))
      groupedStats.get(key)?.push(stats)
    } else {
      groups.set(key, { service, model, artifacts: await options.artifacts(entry), ...stats })
      groupedStats.set(key, [stats])
    }
  }

  return [...groups.entries()].map(([providerKey, seed]) => {
    const stats = options.statsPolicy === 'first'
      ? seed
      : averageProviderStats(groupedStats.get(providerKey) ?? [])
    return options.assemble({
      providerKey,
      provider: seed.service,
      model: seed.model,
      group: providerGroup(seed.service),
      ...(stats.processingTimeMs !== undefined ? { processingTimeMs: stats.processingTimeMs } : {}),
      ...(stats.costCents !== undefined ? { costCents: stats.costCents } : {})
    }, seed.artifacts)
  }).sort((left, right) => left.providerKey.localeCompare(right.providerKey))
}

const averageProviderStats = (stats: readonly VisionProviderStats[]): VisionProviderStats => {
  const averaged = (key: keyof VisionProviderStats): number | undefined => {
    const values = stats.map((entry) => entry[key]).filter((value): value is number => value !== undefined)
    return optionalAverage(values)
  }
  const processingTimeMs = averaged('processingTimeMs')
  const costCents = averaged('costCents')
  return {
    ...(processingTimeMs !== undefined ? { processingTimeMs } : {}),
    ...(costCents !== undefined ? { costCents } : {})
  }
}

export const qualityReportBase = <TKind extends 'image-quality-report' | 'video-quality-report', TRubric extends QualityReportRubricBase>(
  kind: TKind,
  runDir: string,
  generatedAt: string,
  judgeModel: string,
  prompt: string,
  rubric: TRubric
): Omit<QualityReportBase<TKind, TRubric>, 'providerCount'> => ({
  schemaVersion: 1,
  kind,
  runDir,
  runName: basename(runDir),
  generatedAt,
  judge: { provider: 'openai', model: judgeModel, endpoint: 'responses' },
  prompt,
  rubric
})

export const writeVisionQualityMarkdown = async <TKey extends string>(
  path: string,
  report: VisionQualityReport<TKey>,
  options: VisionQualityMarkdownOptions<TKey>
): Promise<void> => {
  const lines = [
    `# ${options.title} Quality Report`, '', '## Summary', '',
    `- Run directory: \`${report.runDir}\``,
    `- Judge model: \`${report.judge.model}\``,
    `- Providers: ${report.providerCount}`,
    `- ${options.artifactLabel} scored: ${options.artifactCount}`,
    ...(options.extraSummaryMetrics ?? []).map(({ label, value }) => `- ${label}: ${value}`),
    '', '## Ranking', '',
    `| Rank | Provider | Quality / 100 | Average / 10 | ${options.criteria.map(({ markdownLabel }) => markdownLabel).join(' | ')} | Evidence |`,
    `| ---: | --- | ---: | ---: | ${options.criteria.map(() => '---:').join(' | ')} | --- |`
  ]
  for (const provider of report.providers) {
    const scores = options.criteria.map(({ key }) => formatScore(provider.criterionScores[key])).join(' | ')
    lines.push(`| ${provider.rank} | \`${escapeCell(provider.providerKey)}\` | ${formatScore(provider.qualityScore)} | ${formatScore(provider.averageScore10)} | ${scores} | ${escapeCell(provider.evidence.summary)} |`)
  }
  lines.push(
    '', '## Rubric', '',
    `- ${options.rubricCriteria} are scored from 1 to 10.`,
    '- `qualityScore` is the average 1-10 score multiplied by 10 for 0-100 ranking compatibility.',
    ...(options.extraRubricLines ?? [])
  )
  await Bun.write(path, `${lines.join('\n')}\n`)
}

export const writeVisionQualityJson = async (runDir: string, category: 'image' | 'video', report: unknown): Promise<string> => {
  const jsonOut = join(runDir, `${category}-quality-report.json`)
  await Bun.write(jsonOut, `${JSON.stringify(report, null, 2)}\n`)
  return jsonOut
}

export const runVisionBenchmark = async <TFlags, TManifestView, TProvider, TReport extends VisionBenchmarkReportSummary>(
  input: string | undefined,
  flags: TFlags,
  descriptor: VisionBenchmarkDescriptor<TFlags, TManifestView, TProvider, TReport>
): Promise<void> => {
  if (!input) throw CLIUsageError(`${descriptor.label} run directory is required. Usage: ${descriptor.usage}`)
  const runDir = resolve(input)
  const { manifestView, providers } = await descriptor.load(runDir)
  descriptor.prepare?.()
  const judgeModel = descriptor.judgeModel(flags) ?? descriptor.defaultJudgeModel
  const artifactCount = providers.reduce((sum, provider) => sum + descriptor.artifactCount(provider), 0)
  const frameRows = descriptor.framesPerArtifact === undefined ? [] : [['framesPerVideo', descriptor.framesPerArtifact] as [string, number]]

  l.write('info', `${descriptor.label} Benchmark Input`, {
    category: 'artifact',
    humanTable: createKeyValueTable([
      ['runDir', runDir], ['providers', providers.length], [descriptor.artifactLabel, artifactCount], ...frameRows, ['judgeModel', judgeModel]
    ]),
    metadata: {
      runDir,
      providerCount: providers.length,
      [descriptor.artifactCountKey]: artifactCount,
      ...(descriptor.framesPerArtifact === undefined ? {} : { framesPerVideo: descriptor.framesPerArtifact }),
      judgeModel
    }
  })

  const { report, jsonOut, markdownOut } = await descriptor.writeQualityReports(runDir, manifestView, providers, judgeModel)
  const comparison = await descriptor.writeComparisonReports(runDir, report)
  l.write('info', `${descriptor.label} Benchmark Report`, {
    category: 'artifact',
    humanTable: createKeyValueTable([
      ['qualityJson', jsonOut], ['qualityMarkdown', markdownOut], ['comparisonJson', comparison.jsonOut], ['comparisonMarkdown', comparison.markdownOut]
    ]),
    metadata: { jsonOut, markdownOut, comparisonJsonOut: comparison.jsonOut, comparisonMarkdownOut: comparison.markdownOut }
  })

  const rankings = report.providers.slice(0, 10)
  l.write('info', `${descriptor.label} Quality Rankings`, {
    category: 'pipeline',
    humanTable: createHumanTable(rankings.map(({ rank, providerKey, qualityScore }) => ({ rank, providerModel: providerKey, qualityScore: formatScore(qualityScore) })), ['rank', 'providerModel', 'qualityScore']),
    metadata: { rankings: rankings.map(({ rank, providerKey, qualityScore }) => ({ rank, providerKey, qualityScore })) }
  })
}
