import { describe, expect, test } from 'bun:test'
import type { ExecutedBudgetPreflightVariant, PriceCommandSpec, TestRunArtifacts } from '~/types'
import { argvKeyFor } from '../../../../test-runner/budget-preflight-cache'
import { collectOrderedVariantObservations, partitionBudgetCacheHits } from '../../../../test-runner/budget-preflight-orchestration'
import { buildPriceSpawnArgs } from '../../../../test-runner/price-execution'
import { buildTestWorkerEnv } from '../../../../test-runner/process-execution'
import { toObservation } from '../../../../test-runner/price-evaluation'

const artifacts: TestRunArtifacts = {
  rootDir: '/tmp/test-output',
  runId: 'run-id',
  runDir: '/tmp/test-output/run-id',
  runnerLogPath: '/tmp/test-output/run-id/runner.log',
  commandLogPath: '/tmp/test-output/run-id/commands.log',
  metricsLogPath: '/tmp/test-output/run-id/metrics.jsonl',
  activeRunPath: '/tmp/test-output/run-id/active.json',
  junitPath: '/tmp/test-output/run-id/junit.xml',
  reportJsonPath: '/tmp/test-output/run-id/report.json',
  e2eReportJsonPath: '/tmp/test-output/run-id/e2e.json',
  calibrationReportJsonPath: '/tmp/test-output/run-id/calibration.json',
  metadataDirPath: '/tmp/test-output/run-id/metadata',
  startedAtMs: 0,
  startedAtIso: '2026-08-21T00:00:00.000Z',
}

const command = (name: string, args: string[]): PriceCommandSpec => ({
  name,
  key: name,
  args,
  budgetSkippable: true
})

describe('test-runner process and price orchestration', () => {
  test('price command construction preserves argument order and substitutes the prebuilt CLI bundle', () => {
    const previous = process.env['AUTOSHOW_TEST_CLI_BUNDLE']
    try {
      process.env['AUTOSHOW_TEST_CLI_BUNDLE'] = '/tmp/cli.js'
      expect(buildPriceSpawnArgs(command('price', ['src/cli/create-cli.ts', 'extract', 'input.pdf', '--price']), artifacts)).toEqual([
        'bun',
        '--no-env-file',
        '/tmp/cli.js',
        'extract',
        'input.pdf',
        '--price',
        '--output-root',
        '/tmp/test-output/run-id/outputs/price',
      ])
    } finally {
      if (previous === undefined) delete process.env['AUTOSHOW_TEST_CLI_BUNDLE']
      else process.env['AUTOSHOW_TEST_CLI_BUNDLE'] = previous
    }
  })

  test('test worker environments allow runner and provider inputs without leaking unrelated secrets', () => {
    const priorProvider = process.env['OPENAI_API_KEY']
    const priorSecret = process.env['AUTOSHOW_UNRELATED_SECRET']
    try {
      process.env['OPENAI_API_KEY'] = 'provider-fixture'
      process.env['AUTOSHOW_UNRELATED_SECRET'] = 'must-not-leak'
      const env = buildTestWorkerEnv(
        ['test/test-cases/e2e/service/step-4-tts-e2e/example.test.ts'],
        artifacts,
        true,
        { AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY: '0' }
      )

      expect(env['OPENAI_API_KEY']).toBe('provider-fixture')
      expect(env['AUTOSHOW_UNRELATED_SECRET']).toBeUndefined()
      expect(env['AUTOSHOW_TEST_ARTIFACTS_DIR']).toBe(artifacts.runDir)
      expect(env['AUTOSHOW_TEST_PRESERVE_ARTIFACTS']).toBe('1')
      expect(env['AUTOSHOW_TEST_CONCURRENT']).toBe('1')
      expect(env['AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY']).toBe('0')
    } finally {
      if (priorProvider === undefined) delete process.env['OPENAI_API_KEY']
      else process.env['OPENAI_API_KEY'] = priorProvider
      if (priorSecret === undefined) delete process.env['AUTOSHOW_UNRELATED_SECRET']
      else process.env['AUTOSHOW_UNRELATED_SECRET'] = priorSecret
    }
  })

  test('budget cache reconciliation replays hits and restores group and variant observation order', () => {
    const groups = [
      { key: 'a', variants: [command('a-1', ['a', '1']), command('a-2', ['a', '2'])] },
      { key: 'b', variants: [command('b-1', ['b', '1'])] },
    ]
    const variants = groups.flatMap((group, groupIndex) => group.variants.map((entry, variantIndex) => ({ entry, groupIndex, variantIndex })))
    const { hits, misses } = partitionBudgetCacheHits(variants, new Map([[argvKeyFor(['a', '2']), 2]]))
    expect(hits.map(hit => hit.entry.name)).toEqual(['a-2'])
    expect(misses.map(miss => miss.entry.name)).toEqual(['a-1', 'b-1'])

    const executedMisses: ExecutedBudgetPreflightVariant[] = misses.reverse().map(item => {
      const executed = { commandText: item.entry.args.join(' '), stdout: '', stderr: '', exitCode: 0, durationMs: 1, parsedCost: 1 }
      return { ...item, executed, observation: toObservation(item.entry, executed) }
    })
    expect(collectOrderedVariantObservations(groups, [...executedMisses, ...hits]).map(observation => observation.name)).toEqual([
      'a-1',
      'a-2',
      'b-1',
    ])
  })
})
