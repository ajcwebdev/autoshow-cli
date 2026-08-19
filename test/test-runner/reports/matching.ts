import {
  buildMetricContext,
  buildTestContext,
  isControlE2ETest,
  isE2ETestFile,
  normalizeValue
} from './context'
import type {
  JunitIndexes,
  MatchProvenance,
  MetricContext,
  MetricMatchResult,
  ParsedCommandMetric,
  ParsedJunitCase,
  ReportTestContext,
  ServiceModelPair,
  TestRunArtifacts
} from '~/types'

const metricModelMatches = (modelHints: Set<string>, metricPairs: ServiceModelPair[]): boolean => {
  if (modelHints.size === 0) return true

  for (const pair of metricPairs) {
    const normalizedModel = normalizeValue(pair.model)
    if (normalizedModel && modelHints.has(normalizedModel)) {
      return true
    }
  }

  return false
}

const metricServiceMatches = (serviceHints: Set<string>, metricPairs: ServiceModelPair[]): boolean => {
  if (serviceHints.size === 0) return true

  for (const pair of metricPairs) {
    const normalizedService = normalizeValue(pair.service)
    if (normalizedService && serviceHints.has(normalizedService)) {
      return true
    }
  }

  return false
}

const scoreHeuristicMatch = (
  testContext: ReportTestContext,
  metricContext: MetricContext
): number | null => {
  const { testCase } = testContext
  const name = testCase.name

  if (testCase.status === 'skipped' || isControlE2ETest(name)) {
    return null
  }

  if (testContext.isPrice !== metricContext.isPrice) {
    return null
  }

  if (testContext.kind && metricContext.kind && testContext.kind !== metricContext.kind) {
    const hasMatchingPairKind = metricContext.pairs.some(pair => pair.kind === testContext.kind)
    if (!hasMatchingPairKind) {
      return null
    }
  }

  if (!metricServiceMatches(testContext.serviceHints, metricContext.pairs)) {
    return null
  }

  if (!metricModelMatches(testContext.modelHints, metricContext.pairs)) {
    return null
  }

  if (testCase.status === 'passed' && metricContext.metric.exitCode !== 0) {
    return null
  }

  const durationDelta = Math.abs(testCase.durationMs - metricContext.metric.durationMs)
  const serviceBonus = testContext.serviceHints.size > 0 ? 0 : 10_000
  const modelBonus = testContext.modelHints.size > 0 ? 0 : 5_000
  return durationDelta + serviceBonus + modelBonus
}

const addToMatched = (
  matched: MetricMatchResult,
  testCase: ParsedJunitCase,
  metric: ParsedCommandMetric,
  provenance: MatchProvenance
): void => {
  const existing = matched.get(testCase.id)
  if (existing) {
    existing.metrics.push(metric)
  } else {
    matched.set(testCase.id, { metrics: [metric], matchedBy: provenance })
  }
}

const addHeuristicMatches = async (
  matched: MetricMatchResult,
  unmatchedMetrics: ParsedCommandMetric[],
  junitCases: ParsedJunitCase[],
  artifacts: TestRunArtifacts
): Promise<ParsedCommandMetric[]> => {
  const unmatchedTests = junitCases
    .filter(testCase => !matched.has(testCase.id) && isE2ETestFile(testCase.file))
    .map(buildTestContext)

  if (unmatchedTests.length === 0 || unmatchedMetrics.length === 0) {
    return unmatchedMetrics
  }

  const metadataCache = new Map<string, Record<string, unknown> | null>()
  const metricContexts = await Promise.all(
    unmatchedMetrics.map(async metric => await buildMetricContext(metric, artifacts, metadataCache))
  )

  const candidates: Array<{ testIndex: number, metricIndex: number, score: number }> = []
  for (const [testIndex, testContext] of unmatchedTests.entries()) {
    for (const [metricIndex, metricContext] of metricContexts.entries()) {
      const score = scoreHeuristicMatch(testContext, metricContext)
      if (score !== null) {
        candidates.push({ testIndex, metricIndex, score })
      }
    }
  }

  candidates.sort((a, b) => a.score - b.score || a.testIndex - b.testIndex || a.metricIndex - b.metricIndex)

  const usedTests = new Set<number>()
  const usedMetrics = new Set<number>()

  for (const candidate of candidates) {
    if (usedTests.has(candidate.testIndex) || usedMetrics.has(candidate.metricIndex)) {
      continue
    }

    const testContext = unmatchedTests[candidate.testIndex]
    const metric = unmatchedMetrics[candidate.metricIndex]
    if (!testContext || !metric) {
      continue
    }

    addToMatched(matched, testContext.testCase, metric, 'heuristic')
    usedTests.add(candidate.testIndex)
    usedMetrics.add(candidate.metricIndex)
  }

  return unmatchedMetrics.filter((_metric, index) => !usedMetrics.has(index))
}

const fileLineKey = (file: string, line: number): string => `${file}::${line}`

const buildJunitIndexes = (matchableCases: ParsedJunitCase[]): JunitIndexes => {
  const byFileAndName = new Map<string, Map<string, ParsedJunitCase>>()
  const byName = new Map<string, ParsedJunitCase[]>()
  const byFileLine = new Map<string, ParsedJunitCase[]>()

  for (const tc of matchableCases) {
    const namesInFile = byFileAndName.get(tc.file) ?? new Map<string, ParsedJunitCase>()
    namesInFile.set(tc.name, tc)
    byFileAndName.set(tc.file, namesInFile)

    const nameList = byName.get(tc.name) ?? []
    nameList.push(tc)
    byName.set(tc.name, nameList)

    if (tc.line !== null) {
      const key = fileLineKey(tc.file, tc.line)
      const lineList = byFileLine.get(key) ?? []
      lineList.push(tc)
      byFileLine.set(key, lineList)
    }
  }

  return { byFileAndName, byName, byFileLine }
}

const findByNameInFile = (metric: ParsedCommandMetric, indexes: JunitIndexes): ParsedJunitCase | null => {
  if (metric.testName === null || metric.callerFile === null) {
    return null
  }
  return indexes.byFileAndName.get(metric.callerFile)?.get(metric.testName) ?? null
}

const findByGlobalName = (metric: ParsedCommandMetric, indexes: JunitIndexes): ParsedJunitCase | null => {
  if (metric.testName === null) {
    return null
  }
  const candidates = indexes.byName.get(metric.testName) ?? []
  return candidates.length === 1 ? candidates[0] ?? null : null
}

const findByUniqueLine = (
  metric: ParsedCommandMetric,
  indexes: JunitIndexes,
  matched: MetricMatchResult
): ParsedJunitCase | null => {
  if (metric.callerFile === null || metric.callerLine === null) {
    return null
  }
  const candidates = indexes.byFileLine.get(fileLineKey(metric.callerFile, metric.callerLine)) ?? []
  const candidate = candidates[0]
  if (candidates.length !== 1 || !candidate || matched.has(candidate.id)) {
    return null
  }
  return candidate
}

const DIRECT_PASSES: Array<{
  provenance: MatchProvenance
  find: (metric: ParsedCommandMetric, indexes: JunitIndexes, matched: MetricMatchResult) => ParsedJunitCase | null
}> = [
  { provenance: 'name-file', find: findByNameInFile },
  { provenance: 'name-global', find: findByGlobalName },
  { provenance: 'line-unique', find: findByUniqueLine },
]

const matchDirectPasses = (
  metrics: ParsedCommandMetric[],
  indexes: JunitIndexes,
  matched: MetricMatchResult
): ParsedCommandMetric[] => {
  const remaining: ParsedCommandMetric[] = []

  for (const metric of metrics) {
    let testCase: ParsedJunitCase | null = null

    for (const pass of DIRECT_PASSES) {
      testCase = pass.find(metric, indexes, matched)
      if (testCase) {
        addToMatched(matched, testCase, metric, pass.provenance)
        break
      }
    }

    if (!testCase) {
      remaining.push(metric)
    }
  }

  return remaining
}

/**
 * Positional pass for metrics that share a caller file/line: when one call site logs several
 * metrics (a helper looping over variants), JUnit reports one test case per invocation at that
 * same line. Pairing the Nth remaining metric with the Nth still-unmatched case at that line is
 * the only signal available, so the contract is index order in, index order out. Metrics with no
 * caller location, and any leftovers past the shorter of the two lists, stay unmatched for the
 * heuristic pass.
 */
const matchGroupOrder = (
  remaining: ParsedCommandMetric[],
  byFileLine: Map<string, ParsedJunitCase[]>,
  matched: MetricMatchResult
): ParsedCommandMetric[] => {
  const unmatched: ParsedCommandMetric[] = []
  const groups = new Map<string, ParsedCommandMetric[]>()

  for (const metric of remaining) {
    if (metric.callerFile !== null && metric.callerLine !== null) {
      const key = fileLineKey(metric.callerFile, metric.callerLine)
      const list = groups.get(key) ?? []
      list.push(metric)
      groups.set(key, list)
    } else {
      unmatched.push(metric)
    }
  }

  for (const [key, groupMetrics] of groups) {
    const tcAtLine = (byFileLine.get(key) ?? []).filter(tc => !matched.has(tc.id))
    const count = Math.min(groupMetrics.length, tcAtLine.length)
    for (let index = 0; index < count; index++) {
      const testCase = tcAtLine[index]
      const metric = groupMetrics[index]
      if (testCase && metric) {
        addToMatched(matched, testCase, metric, 'group-order')
      }
    }
    for (let index = count; index < groupMetrics.length; index++) {
      const metric = groupMetrics[index]
      if (metric) {
        unmatched.push(metric)
      }
    }
  }

  return unmatched
}

export const matchMetricsToTests = async (
  metrics: ParsedCommandMetric[],
  junitCases: ParsedJunitCase[],
  artifacts: TestRunArtifacts
): Promise<{ matched: MetricMatchResult; unmatched: ParsedCommandMetric[] }> => {
  const matched: MetricMatchResult = new Map()
  const indexes = buildJunitIndexes(junitCases.filter(tc => tc.status !== 'skipped'))
  const remaining = matchDirectPasses(metrics, indexes, matched)
  const unmatched = matchGroupOrder(remaining, indexes.byFileLine, matched)
  const remainingAfterHeuristic = await addHeuristicMatches(matched, unmatched, junitCases, artifacts)
  return { matched, unmatched: remainingAfterHeuristic }
}
