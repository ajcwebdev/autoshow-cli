import type { ParsedCommandMetric, ParsedJunitCase, TestRunArtifacts } from '~/types'
import { normalizeRepoPath } from '../utils'
import {
  buildMetricContext,
  isControlE2ETest,
  isE2ETestFile,
  joinUnique,
  selectPrimaryPairs
} from './context'
import { readHistoricalLookups } from './history'
import { matchMetricsToTests } from './matching'
import { buildBudgetRunFields } from './run-metadata'
import type {
  BudgetPreflightSummary,
  MatchProvenance,
  MetricMatchResult,
  ReportHistoricalLookup
} from '~/types'

export type LinkedMetricSummary = {
  source: 'runCommand' | 'none'
  matchedBy: MatchProvenance | null
  commandDurationMs: number | null
  estimatedCostCents: number | null
  actualCostCents: number | null
  estimatedProcessingTimeMs: number | null
  actualProcessingTimeMs: number | null
  notes: string[]
}

type LinkedMetricTotals = Pick<
  LinkedMetricSummary,
  | 'commandDurationMs'
  | 'estimatedCostCents'
  | 'actualCostCents'
  | 'estimatedProcessingTimeMs'
  | 'actualProcessingTimeMs'
>

type LinkedMetricSummarizer = (
  linked: ParsedCommandMetric[],
  historical: ReportHistoricalLookup,
  testId: string,
  matchedBy: MatchProvenance | null
) => LinkedMetricSummary

const earliestMetricStartIso = (metrics: ParsedCommandMetric[]): string | null => {
  let earliest: number | null = null

  for (const metric of metrics) {
    if (!metric.at) continue
    const atMs = Date.parse(metric.at)
    if (!Number.isFinite(atMs)) continue

    const startedAt = atMs - metric.durationMs
    if (earliest === null || startedAt < earliest) {
      earliest = startedAt
    }
  }

  return earliest === null ? null : new Date(earliest).toISOString()
}

const sumPresentMetric = (
  linked: ParsedCommandMetric[],
  select: (metric: ParsedCommandMetric) => number | null
): number | null => {
  let total: number | null = null
  for (const metric of linked) {
    const value = select(metric)
    if (value !== null) total = (total ?? 0) + value
  }
  return total
}

const calculateLinkedMetricTotals = (linked: ParsedCommandMetric[]): LinkedMetricTotals => ({
  commandDurationMs: linked.length > 0
    ? linked.reduce((sum, metric) => sum + metric.durationMs, 0)
    : null,
  estimatedCostCents: sumPresentMetric(linked, metric => metric.estimatedCostCents),
  actualCostCents: sumPresentMetric(linked, metric => metric.actualCostCents),
  estimatedProcessingTimeMs: sumPresentMetric(linked, metric => metric.estimatedProcessingTimeMs),
  actualProcessingTimeMs: sumPresentMetric(linked, metric => metric.actualProcessingTimeMs),
})

const resolveEstimatedProcessingTime = (
  current: number | null,
  historical: ReportHistoricalLookup,
  testId: string
): { value: number | null; usedHistorical: boolean } => ({
  value: current ?? historical.processingTimeById.get(testId) ?? null,
  usedHistorical: current === null && historical.processingTimeById.has(testId),
})

const buildMetricMatchNotes = (
  metricCount: number,
  matchedBy: MatchProvenance | null,
  usedHistoricalProcessingTime: boolean
): string[] => {
  const notes: string[] = []
  if (metricCount > 0 && matchedBy === 'group-order') {
    notes.push('metric matched by group-order (positional, less reliable)')
  }
  if (metricCount > 0 && matchedBy === 'heuristic') {
    notes.push('metric matched heuristically by provider/model/time')
  }
  if (metricCount > 1) {
    notes.push('multiple metrics collapsed onto this test')
  }
  if (usedHistoricalProcessingTime) {
    notes.push('estimated processing time fell back to prior successful run')
  }
  return notes
}

export const summarizeLinkedMetrics: LinkedMetricSummarizer = (linked, historical, testId, matchedBy) => {
  const totals = calculateLinkedMetricTotals(linked)
  const processingTime = resolveEstimatedProcessingTime(totals.estimatedProcessingTimeMs, historical, testId)

  return {
    ...totals,
    source: linked.length > 0 ? 'runCommand' : 'none',
    matchedBy,
    estimatedProcessingTimeMs: processingTime.value,
    notes: buildMetricMatchNotes(linked.length, matchedBy, processingTime.usedHistorical),
  }
}

const buildCondensedE2EReport = async (
  tests: Array<{
    id: string
    file: string
    name: string
    status: string
    durationMs: number
    metrics: LinkedMetricSummary
  }>,
  matched: MetricMatchResult,
  artifacts: TestRunArtifacts,
  historical: ReportHistoricalLookup,
  endedAtIso: string,
  endedAtMs: number
): Promise<Record<string, unknown>> => {
  const metadataCache = new Map<string, Record<string, unknown> | null>()

  const reportableTests = tests.filter(test => {
    return isE2ETestFile(test.file)
      && test.metrics.source === 'runCommand'
      && !isControlE2ETest(test.name)
  })

  const condensedTests = await Promise.all(reportableTests.map(async test => {
    const linked = matched.get(test.id)?.metrics ?? []
    const metricContexts = await Promise.all(
      linked.map(async metric => await buildMetricContext(metric, artifacts, metadataCache))
    )
    const testCase: ParsedJunitCase = {
      id: test.id,
      file: test.file,
      name: test.name,
      line: null,
      durationMs: test.durationMs,
      status: test.status as ParsedJunitCase['status'],
      failureMessage: null,
    }
    const primaryPairs = selectPrimaryPairs(
      testCase,
      metricContexts.flatMap(context => context.pairs)
    )

    return {
      id: test.id,
      file: test.file,
      name: test.name,
      status: test.status,
      serviceName: joinUnique(primaryPairs.map(pair => pair.service)),
      modelName: joinUnique(primaryPairs.map(pair => pair.model)),
      runAt: earliestMetricStartIso(linked),
      estimatedDurationMs: historical.durationById.get(test.id) ?? null,
      actualDurationMs: test.durationMs,
      estimatedProcessingTimeMs: test.metrics.estimatedProcessingTimeMs,
      actualProcessingTimeMs: test.metrics.actualProcessingTimeMs,
      estimatedCostCents: test.metrics.estimatedCostCents,
      actualCostCents: test.metrics.actualCostCents,
    }
  }))

  return {
    run: {
      id: artifacts.runId,
      mode: 'test',
      startedAt: artifacts.startedAtIso,
      endedAt: endedAtIso,
      durationMs: Math.max(0, endedAtMs - artifacts.startedAtMs),
      artifactDir: normalizeRepoPath(artifacts.runDir),
    },
    summary: {
      total: condensedTests.length,
      passed: condensedTests.filter(test => test.status === 'passed').length,
      failed: condensedTests.filter(test => test.status === 'failed').length,
      skipped: condensedTests.filter(test => test.status === 'skipped').length,
    },
    tests: condensedTests,
  }
}

export const buildTestReportData = async (
  junitCases: ParsedJunitCase[],
  metrics: ParsedCommandMetric[],
  artifacts: TestRunArtifacts,
  endedAtIso: string,
  endedAtMs: number,
  argv: string[],
  budgetSummary?: BudgetPreflightSummary
): Promise<Record<string, unknown>> => {
  const { matched, unmatched } = await matchMetricsToTests(metrics, junitCases, artifacts)
  const historical = await readHistoricalLookups(artifacts)

  const tests = junitCases.map(testCase => {
    const entry = matched.get(testCase.id)
    const linked = entry?.metrics ?? []
    const matchedBy = entry?.matchedBy ?? null

    return {
      id: testCase.id,
      file: testCase.file,
      name: testCase.name,
      status: testCase.status,
      durationMs: testCase.durationMs,
      metrics: summarizeLinkedMetrics(linked, historical, testCase.id, matchedBy),
    }
  })

  const passed = tests.filter(test => test.status === 'passed').length
  const failed = tests.filter(test => test.status === 'failed').length
  const skipped = tests.filter(test => test.status === 'skipped').length

  const matchedMetricCount = Array.from(matched.values()).reduce((sum, entry) => sum + entry.metrics.length, 0)
  const unmatchedMetricCount = unmatched.length

  const failures = tests
    .filter(test => test.status === 'failed')
    .map(test => {
      const source = junitCases.find(testCase => testCase.id === test.id)
      return {
        id: test.id,
        file: test.file,
        name: test.name,
        message: source?.failureMessage ?? 'Test failed'
      }
    })

  const runDurationMs = Math.max(0, endedAtMs - artifacts.startedAtMs)
  const e2e = await buildCondensedE2EReport(tests, matched, artifacts, historical, endedAtIso, endedAtMs)

  return {
    run: {
      id: artifacts.runId,
      mode: 'test',
      startedAt: artifacts.startedAtIso,
      endedAt: endedAtIso,
      durationMs: runDurationMs,
      argv,
      artifactDir: normalizeRepoPath(artifacts.runDir),
      ...buildBudgetRunFields(budgetSummary),
    },
    summary: {
      total: tests.length,
      passed,
      failed,
      skipped,
      cliMetricEligiblePassedCount: tests.filter(test => test.status === 'passed' && test.metrics.source === 'runCommand').length,
      matchedMetricCount,
      unmatchedMetricCount,
      passedWithoutMetricsCount: tests.filter(test => test.status === 'passed' && test.metrics.source === 'none').length,
    },
    tests,
    failures,
    e2e,
  }
}
