import type { BudgetPreflightSummary, CalibrationRecommendation, CalibrationReport, ParsedJunitCase } from '~/types'
import { formatCost } from '~/utils/app-logger/formatters'

const LIVE_SERVICE_TEST_PREFIX = 'test/test-cases/e2e/service/'
const DEFAULT_MAX_FAILURES = 25
const DEFAULT_MAX_MESSAGE_LINES = 8
const DEFAULT_MAX_CALIBRATION_ROWS = 10
const MAX_OTHER_SKIPS = 10
const DEFAULT_MAX_SLOWEST = 5
const SLOW_TEST_THRESHOLD_MS = 1_000

export type RunDigestInput = {
  junitCases: ParsedJunitCase[]
  budgetSummary?: BudgetPreflightSummary | undefined
  calibration?: CalibrationReport | undefined
  calibrationPath?: string | undefined
  maxFailures?: number
  maxMessageLines?: number
  maxCalibrationRows?: number
  maxSlowest?: number
}

const relativeChange = (oldValue: number | null, newValue: number | null): number => {
  if (newValue === null) return 0
  if (oldValue === null || oldValue === 0) return Number.POSITIVE_INFINITY
  return Math.abs(newValue - oldValue) / Math.abs(oldValue)
}

const recommendationDrift = (entry: CalibrationRecommendation): number =>
  Math.max(
    relativeChange(entry.oldCostMultiplier, entry.recommendedCostMultiplier),
    relativeChange(entry.oldTimeValue, entry.recommendedTimeValue)
  )

const formatNumber = (value: number | null): string => {
  if (value === null) return '—'
  return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(4)))
}

const formatChange = (
  field: string,
  oldValue: number | null,
  newValue: number | null,
  median: number | null,
  samples: number
): string | null => {
  if (newValue === null) return null
  const change = oldValue === null ? `unset → ${formatNumber(newValue)}` : `${formatNumber(oldValue)} → ${formatNumber(newValue)}`
  return `${field} ${change} (median ${formatNumber(median)}, n=${samples})`
}

// The logger collapses repeated spaces, so rows are self-describing instead of padded columns.
const formatRecommendation = (entry: CalibrationRecommendation): string => {
  const changes = [
    formatChange('cost multiplier', entry.oldCostMultiplier, entry.recommendedCostMultiplier, entry.medianCostMultiplier, entry.costSamples),
    formatChange(entry.timeField, entry.oldTimeValue, entry.recommendedTimeValue, entry.medianTimeValue, entry.timeSamples),
  ].filter((change): change is string => change !== null)
  return `  ${entry.kind} ${entry.service}/${entry.model}: ${changes.join('; ')}`
}

const truncateMessage = (message: string, maxLines: number): string[] => {
  const lines = message.split(/\r?\n/).map(line => line.trimEnd()).filter(line => line.trim().length > 0)
  if (lines.length <= maxLines) return lines
  return [...lines.slice(0, maxLines), `… ${lines.length - maxLines} more line${lines.length - maxLines === 1 ? '' : 's'}`]
}

export const buildFailureDigest = (
  junitCases: ParsedJunitCase[],
  options: { maxFailures?: number, maxMessageLines?: number } = {}
): string[] => {
  const failed = junitCases.filter(testCase => testCase.status === 'failed')
  if (failed.length === 0) return []
  const maxFailures = options.maxFailures ?? DEFAULT_MAX_FAILURES
  const maxMessageLines = options.maxMessageLines ?? DEFAULT_MAX_MESSAGE_LINES
  const lines = [`Failures (${failed.length})`]
  for (const testCase of failed.slice(0, maxFailures)) {
    lines.push(`✗ ${testCase.file}${testCase.line === null ? '' : `:${testCase.line}`} :: ${testCase.name}`)
    for (const messageLine of truncateMessage(testCase.failureMessage ?? 'Test failed', maxMessageLines)) {
      lines.push(`    ${messageLine}`)
    }
  }
  if (failed.length > maxFailures) {
    lines.push(`… ${failed.length - maxFailures} more failure${failed.length - maxFailures === 1 ? '' : 's'}; see output/test-output/latest.log`)
  }
  return lines
}

export const buildSkipDigest = (
  junitCases: ParsedJunitCase[],
  budgetSummary?: BudgetPreflightSummary
): string[] => {
  const skipped = junitCases.filter(testCase => testCase.status === 'skipped')
  if (skipped.length === 0) return []
  const live = skipped.filter(testCase => testCase.file.startsWith(LIVE_SERVICE_TEST_PREFIX))
  const other = skipped.filter(testCase => !testCase.file.startsWith(LIVE_SERVICE_TEST_PREFIX))
  const budget = budgetSummary
    ? ` (the ${formatCost(budgetSummary.budgetHundredthCents / 100)} budget allowed ${budgetSummary.commandsRunnable} of ${budgetSummary.commandsChecked} priced test keys)`
    : ''
  const lines = [`Skipped ${skipped.length}: ${live.length} live service test${live.length === 1 ? '' : 's'}${budget}, ${other.length} other`]
  for (const testCase of other.slice(0, MAX_OTHER_SKIPS)) {
    lines.push(`» ${testCase.file} :: ${testCase.name}`)
  }
  if (other.length > MAX_OTHER_SKIPS) lines.push(`… ${other.length - MAX_OTHER_SKIPS} more`)
  return lines
}

const formatSeconds = (durationMs: number): string => `${(durationMs / 1000).toFixed(1)}s`

export const buildSlowestDigest = (junitCases: ParsedJunitCase[], maxRows = DEFAULT_MAX_SLOWEST): string[] => {
  const timed = junitCases
    .filter(testCase => testCase.status !== 'skipped' && testCase.durationMs >= SLOW_TEST_THRESHOLD_MS)
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, maxRows)
  if (timed.length === 0) return []
  return [
    `Slowest ${timed.length} test${timed.length === 1 ? '' : 's'}`,
    ...timed.map(testCase => `  ${formatSeconds(testCase.durationMs)} ${testCase.file} :: ${testCase.name}`),
  ]
}

export const buildCalibrationDigest = (
  calibration: CalibrationReport | undefined,
  calibrationPath: string | undefined,
  maxRows = DEFAULT_MAX_CALIBRATION_ROWS
): string[] => {
  if (!calibration) return []
  const location = calibrationPath ? `: ${calibrationPath}` : ''
  if (calibration.recommendations.length === 0) {
    return [`Model calibration: no recommendations (${calibration.metadataFilesScanned} metadata files scanned)${location}`]
  }
  const sorted = [...calibration.recommendations].sort((a, b) => recommendationDrift(b) - recommendationDrift(a))
  const lines = [
    `Model calibration: ${calibration.recommendedModels} recommendation${calibration.recommendedModels === 1 ? '' : 's'}${location}`,
    ...sorted.slice(0, maxRows).map(formatRecommendation),
  ]
  if (sorted.length > maxRows) lines.push(`  … ${sorted.length - maxRows} more in the report`)
  return lines
}

export const buildRunDigest = (input: RunDigestInput): string[] => {
  const sections = [
    buildFailureDigest(input.junitCases, {
      ...(input.maxFailures !== undefined ? { maxFailures: input.maxFailures } : {}),
      ...(input.maxMessageLines !== undefined ? { maxMessageLines: input.maxMessageLines } : {}),
    }),
    buildSkipDigest(input.junitCases, input.budgetSummary),
    buildSlowestDigest(input.junitCases, input.maxSlowest),
    buildCalibrationDigest(input.calibration, input.calibrationPath, input.maxCalibrationRows),
  ].filter(section => section.length > 0)
  return sections.flatMap((section, index) => index === 0 ? section : ['', ...section])
}
