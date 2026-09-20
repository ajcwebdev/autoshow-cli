import { describe, expect, test } from 'bun:test'
import type { BudgetPreflightSummary, CalibrationRecommendation, CalibrationReport, ParsedJunitCase } from '~/types'
import { buildRunDigest } from '../../../../test-runner/reports/run-digest'

const junitCase = (overrides: Partial<ParsedJunitCase>): ParsedJunitCase => ({
  id: `${overrides.file ?? 'test/test-cases/validation/a.test.ts'}::${overrides.name ?? 'case'}`,
  file: 'test/test-cases/validation/a.test.ts',
  name: 'case',
  line: null,
  durationMs: 1,
  status: 'passed',
  failureMessage: null,
  ...overrides,
})

const recommendation = (overrides: Partial<CalibrationRecommendation>): CalibrationRecommendation => ({
  kind: 'llm',
  service: 'openai',
  model: 'model',
  costSamples: 3,
  timeSamples: 3,
  oldCostMultiplier: 1,
  recommendedCostMultiplier: null,
  medianCostMultiplier: null,
  timeField: 'msPerOutputToken',
  oldTimeValue: null,
  recommendedTimeValue: null,
  medianTimeValue: null,
  ...overrides,
})

const calibration = (recommendations: CalibrationRecommendation[]): CalibrationReport => ({
  generatedAt: '2026-09-19T00:00:00.000Z',
  rootDir: 'output/test-output',
  runsScanned: 1,
  metadataFilesScanned: 4,
  recommendedModels: recommendations.length,
  recommendations,
})

const budget: BudgetPreflightSummary = {
  suiteName: 'All mapped tests',
  budgetHundredthCents: 10,
  commandsChecked: 89,
  commandsRunnable: 22,
  commandsSkipped: 67,
  commandsFailed: 0,
  runnableEstimatedCostCents: 0.48,
  skipKeys: [],
  skippedEntries: [],
}

describe('test-runner run digest', () => {
  test('a clean run has no failure section and still reports skips and calibration', () => {
    const digest = buildRunDigest({
      junitCases: [
        junitCase({ name: 'passes' }),
        junitCase({ file: 'test/test-cases/e2e/service/tts/live.test.ts', name: 'live', status: 'skipped' }),
      ],
      budgetSummary: budget,
      calibration: calibration([]),
      calibrationPath: 'output/test-output/latest-model-calibration.json',
    })
    expect(digest.some(line => line.startsWith('Failures'))).toBe(false)
    expect(digest).toContain('Skipped 1: 1 live service test (the 0.100¢ budget allowed 22 of 89 priced test keys), 0 other')
    expect(digest.at(-1)).toBe('Model calibration: no recommendations (4 metadata files scanned): output/test-output/latest-model-calibration.json')
  })

  test('failures come first with capped messages and a capped list', () => {
    const failures = Array.from({ length: 3 }, (_, index) => junitCase({
      name: `broken ${index}`,
      line: 10 + index,
      status: 'failed',
      failureMessage: Array.from({ length: 5 }, (_, line) => `line ${line}`).join('\n'),
    }))
    const digest = buildRunDigest({ junitCases: failures, maxFailures: 2, maxMessageLines: 2 })
    expect(digest).toEqual([
      'Failures (3)',
      '✗ test/test-cases/validation/a.test.ts:10 :: broken 0',
      '    line 0',
      '    line 1',
      '    … 3 more lines',
      '✗ test/test-cases/validation/a.test.ts:11 :: broken 1',
      '    line 0',
      '    line 1',
      '    … 3 more lines',
      '… 1 more failure; see output/test-output/latest.log',
    ])
  })

  test('non-live skips are listed by name', () => {
    const digest = buildRunDigest({
      junitCases: [junitCase({ name: 'unexpected skip', status: 'skipped' })],
    })
    expect(digest).toEqual([
      'Skipped 1: 0 live service tests, 1 other',
      '» test/test-cases/validation/a.test.ts :: unexpected skip',
    ])
  })

  test('slowest tests are ranked by duration, exclude skips, and are capped', () => {
    const digest = buildRunDigest({
      junitCases: [
        junitCase({ name: 'fast', durationMs: 20 }),
        junitCase({ name: 'slow failure', status: 'failed', durationMs: 37_227, failureMessage: 'boom' }),
        junitCase({ name: 'skipped', status: 'skipped', durationMs: 99_000 }),
        junitCase({ name: 'medium', durationMs: 4_150 }),
      ],
      maxFailures: 0,
      maxSlowest: 2,
    })
    expect(digest.some(line => line.includes(':: fast'))).toBe(false)
    const start = digest.indexOf('Slowest 2 tests')
    expect(digest.slice(start, start + 3)).toEqual([
      'Slowest 2 tests',
      '  37.2s test/test-cases/validation/a.test.ts :: slow failure',
      '  4.2s test/test-cases/validation/a.test.ts :: medium',
    ])
  })

  test('calibration rows are ordered by drift and limited', () => {
    const digest = buildRunDigest({
      junitCases: [],
      calibration: calibration([
        recommendation({ model: 'small-drift', recommendedCostMultiplier: 1.2 }),
        recommendation({ model: 'large-drift', recommendedCostMultiplier: 3, medianCostMultiplier: 3.5 }),
        recommendation({ kind: 'stt', service: 'whisperfile', model: 'unset', oldCostMultiplier: null, timeField: 'msPerSecond', recommendedTimeValue: 195, medianTimeValue: 314.104, timeSamples: 1 }),
      ]),
      calibrationPath: 'output/test-output/latest-model-calibration.json',
      maxCalibrationRows: 2,
    })
    expect(digest[0]).toBe('Model calibration: 3 recommendations: output/test-output/latest-model-calibration.json')
    expect(digest[1]).toBe('  stt whisperfile/unset: msPerSecond unset → 195 (median 314.1, n=1)')
    expect(digest[2]).toBe('  llm openai/large-drift: cost multiplier 1 → 3 (median 3.5, n=3)')
    expect(digest).toHaveLength(4)
    expect(digest.at(-1)).toBe('  … 1 more in the report')
  })
})
