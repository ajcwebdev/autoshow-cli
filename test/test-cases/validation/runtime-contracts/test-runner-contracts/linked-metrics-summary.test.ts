import { describe, expect, test } from 'bun:test'
import type {
  LinkedMetricSummary,
  MatchProvenance,
  ParsedCommandMetric,
  ReportHistoricalLookup
} from '~/types'
import { summarizeLinkedMetrics } from '../../../../test-runner/reports/test-report'

const metric = (overrides: Partial<ParsedCommandMetric> = {}): ParsedCommandMetric => ({
  source: 'runCommand',
  command: 'autoshow',
  args: [],
  exitCode: 0,
  durationMs: 100,
  outputDir: null,
  callerFile: null,
  callerLine: null,
  callerColumn: null,
  at: null,
  testName: null,
  estimatedCostCents: null,
  actualCostCents: null,
  estimatedProcessingTimeMs: null,
  actualProcessingTimeMs: null,
  ...overrides,
})

const history = (processingTimeMs?: number): ReportHistoricalLookup => ({
  durationById: new Map(),
  processingTimeById: processingTimeMs === undefined
    ? new Map()
    : new Map([['test-id', processingTimeMs]]),
})

const cases: Array<{
  name: string
  linked: ParsedCommandMetric[]
  matchedBy: MatchProvenance | null
  historical: ReportHistoricalLookup
  expected: LinkedMetricSummary
}> = [
  {
    name: 'no metrics',
    linked: [],
    matchedBy: null,
    historical: history(),
    expected: {
      source: 'none',
      matchedBy: null,
      commandDurationMs: null,
      estimatedCostCents: null,
      actualCostCents: null,
      estimatedProcessingTimeMs: null,
      actualProcessingTimeMs: null,
      notes: [],
    },
  },
  {
    name: 'one metric',
    linked: [metric({
      durationMs: 125,
      estimatedCostCents: 2.5,
      actualCostCents: 3,
      estimatedProcessingTimeMs: 400,
      actualProcessingTimeMs: 450,
    })],
    matchedBy: 'name-file',
    historical: history(),
    expected: {
      source: 'runCommand',
      matchedBy: 'name-file',
      commandDurationMs: 125,
      estimatedCostCents: 2.5,
      actualCostCents: 3,
      estimatedProcessingTimeMs: 400,
      actualProcessingTimeMs: 450,
      notes: [],
    },
  },
  {
    name: 'partial nulls',
    linked: [
      metric({
        durationMs: 10,
        estimatedCostCents: 1.25,
        actualProcessingTimeMs: 30,
      }),
      metric({
        durationMs: 20,
        actualCostCents: 2.75,
        actualProcessingTimeMs: 40,
      }),
    ],
    matchedBy: 'name-global',
    historical: history(),
    expected: {
      source: 'runCommand',
      matchedBy: 'name-global',
      commandDurationMs: 30,
      estimatedCostCents: 1.25,
      actualCostCents: 2.75,
      estimatedProcessingTimeMs: null,
      actualProcessingTimeMs: 70,
      notes: ['multiple metrics collapsed onto this test'],
    },
  },
  {
    name: 'legitimate zeroes',
    linked: [metric({
      durationMs: 0,
      estimatedCostCents: 0,
      actualCostCents: 0,
      estimatedProcessingTimeMs: 0,
      actualProcessingTimeMs: 0,
    })],
    matchedBy: 'line-unique',
    historical: history(999),
    expected: {
      source: 'runCommand',
      matchedBy: 'line-unique',
      commandDurationMs: 0,
      estimatedCostCents: 0,
      actualCostCents: 0,
      estimatedProcessingTimeMs: 0,
      actualProcessingTimeMs: 0,
      notes: [],
    },
  },
  {
    name: 'multiple group-order metrics',
    linked: [
      metric({
        durationMs: 50,
        estimatedCostCents: 1,
        estimatedProcessingTimeMs: 100,
      }),
      metric({
        durationMs: 75,
        estimatedCostCents: 2,
        estimatedProcessingTimeMs: 200,
      }),
    ],
    matchedBy: 'group-order',
    historical: history(),
    expected: {
      source: 'runCommand',
      matchedBy: 'group-order',
      commandDurationMs: 125,
      estimatedCostCents: 3,
      actualCostCents: null,
      estimatedProcessingTimeMs: 300,
      actualProcessingTimeMs: null,
      notes: [
        'metric matched by group-order (positional, less reliable)',
        'multiple metrics collapsed onto this test',
      ],
    },
  },
  {
    name: 'heuristic multiple match with historical fallback',
    linked: [metric({ durationMs: 40 }), metric({ durationMs: 60 })],
    matchedBy: 'heuristic',
    historical: history(800),
    expected: {
      source: 'runCommand',
      matchedBy: 'heuristic',
      commandDurationMs: 100,
      estimatedCostCents: null,
      actualCostCents: null,
      estimatedProcessingTimeMs: 800,
      actualProcessingTimeMs: null,
      notes: [
        'metric matched heuristically by provider/model/time',
        'multiple metrics collapsed onto this test',
        'estimated processing time fell back to prior successful run',
      ],
    },
  },
  {
    name: 'historical estimated processing fallback only',
    linked: [],
    matchedBy: null,
    historical: history(720),
    expected: {
      source: 'none',
      matchedBy: null,
      commandDurationMs: null,
      estimatedCostCents: null,
      actualCostCents: null,
      estimatedProcessingTimeMs: 720,
      actualProcessingTimeMs: null,
      notes: ['estimated processing time fell back to prior successful run'],
    },
  },
]

describe('linked metric summary contracts', () => {
  for (const contract of cases) {
    test(contract.name, () => {
      expect(summarizeLinkedMetrics(
        contract.linked,
        contract.historical,
        'test-id',
        contract.matchedBy
      )).toEqual(contract.expected)
    })
  }
})
