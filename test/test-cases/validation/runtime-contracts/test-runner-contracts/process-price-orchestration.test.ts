import { describe, expect, test } from 'bun:test'
import type { ExecutedBudgetPreflightVariant, PriceCommandSpec, TestRunArtifacts } from '~/types'
import { argvKeyFor } from '../../../../test-runner/budget-preflight-cache'
import { collectOrderedVariantObservations, partitionBudgetCacheHits } from '../../../../test-runner/budget-preflight-orchestration'
import { buildPriceSpawnArgs } from '../../../../test-runner/price-execution'
import { buildBunTestArgs, buildTestWorkerEnv, createBunCrashDetector } from '../../../../test-runner/process-execution'
import { BUN_FILE_TIMINGS_CACHE_PATH } from '../../../../test-runner/file-timings'
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

const restoreEnv = (key: string, value: string | undefined): void => {
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
}

describe('test-runner process and price orchestration', () => {
  test('detects a fatal worker crash once, including colored diagnostics, without treating ordinary error text as a crash', () => {
    let crashes = 0
    const observe = createBunCrashDetector(() => { crashes++ })
    observe('oh no: Bun has crashed. quoted diagnostic without a runtime header')
    observe('panic: an application error')
    expect(crashes).toBe(0)
    observe('Bun v1.4.2 (744846f84) macOS Silicon')
    observe('oh no: Bun has crashed. no runtime panic yet')
    expect(crashes).toBe(0)
    observe('panic: A C++ exception occurred')
    observe('oh no\u001b[0m\u001b[2m:\u001b[0m Bun has crashed. This indicates a bug in Bun, not your code.')
    observe('oh no: Bun has crashed. duplicate output')
    expect(crashes).toBe(1)
  })
  test('test commands enable descendant cleanup and native timing updates without dropping JUnit reporting', () => {
    const file = 'test/test-cases/validation/runtime-contracts/example.test.ts'
    expect(buildBunTestArgs([file], artifacts, ['--only-failures'])).toEqual([
      'test',
      '--no-orphans',
      `--timings=${BUN_FILE_TIMINGS_CACHE_PATH}`,
      '--update-timings',
      '--timeout',
      '600000',
      expect.stringMatching(/^--max-concurrency=\d+$/),
      expect.stringMatching(/^--parallel=\d+$/),
      '--only-failures',
      '--reporter',
      'junit',
      '--reporter-outfile',
      artifacts.junitPath,
      file
    ])
  })

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
        '--json',
      ])
    } finally {
      if (previous === undefined) delete process.env['AUTOSHOW_TEST_CLI_BUNDLE']
      else process.env['AUTOSHOW_TEST_CLI_BUNDLE'] = previous
    }
  })

  test('test worker environments allow runner inputs without ambient provider credentials', () => {
    const priorMode = process.env['AUTOSHOW_TEST_CREDENTIAL_MODE']
    const priorKeys = process.env['AUTOSHOW_TEST_CREDENTIAL_KEYS']
    const priorProvider = process.env['OPENAI_API_KEY']
    const priorSecret = process.env['AUTOSHOW_UNRELATED_SECRET']
    try {
      // The runner itself runs in live mode, so the credential mode is pinned here
      // instead of inherited: fixture mode must never forward a provider key.
      process.env['AUTOSHOW_TEST_CREDENTIAL_MODE'] = 'fixture'
      delete process.env['AUTOSHOW_TEST_CREDENTIAL_KEYS']
      process.env['OPENAI_API_KEY'] = 'provider-fixture'
      process.env['AUTOSHOW_UNRELATED_SECRET'] = 'must-not-leak'
      const env = buildTestWorkerEnv(
        ['test/test-cases/e2e/service/audio/tts/example.test.ts'],
        artifacts,
        true,
        { AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY: '0' }
      )

      expect(env['AUTOSHOW_TEST_CREDENTIAL_MODE']).toBe('fixture')
      expect(env['OPENAI_API_KEY']).toBeUndefined()
      expect(env['AUTOSHOW_UNRELATED_SECRET']).toBeUndefined()
      expect(env['AUTOSHOW_TEST_ARTIFACTS_DIR']).toBe(artifacts.runDir)
      expect(env['AUTOSHOW_TEST_PRESERVE_ARTIFACTS']).toBe('1')
      expect(env['AUTOSHOW_TEST_CONCURRENT']).toBe('1')
      expect(env['AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY']).toBe('0')
    } finally {
      restoreEnv('AUTOSHOW_TEST_CREDENTIAL_MODE', priorMode)
      restoreEnv('AUTOSHOW_TEST_CREDENTIAL_KEYS', priorKeys)
      restoreEnv('OPENAI_API_KEY', priorProvider)
      restoreEnv('AUTOSHOW_UNRELATED_SECRET', priorSecret)
    }
  })

  test('live test worker environments forward only the declared provider credentials', () => {
    const priorMode = process.env['AUTOSHOW_TEST_CREDENTIAL_MODE']
    const priorKeys = process.env['AUTOSHOW_TEST_CREDENTIAL_KEYS']
    const priorProvider = process.env['OPENAI_API_KEY']
    const priorOtherProvider = process.env['MISTRAL_API_KEY']
    const priorSecret = process.env['AUTOSHOW_UNRELATED_SECRET']
    try {
      process.env['AUTOSHOW_TEST_CREDENTIAL_MODE'] = 'live'
      process.env['AUTOSHOW_TEST_CREDENTIAL_KEYS'] = JSON.stringify(['OPENAI_API_KEY'])
      process.env['OPENAI_API_KEY'] = 'provider-fixture'
      process.env['MISTRAL_API_KEY'] = 'undeclared-provider-fixture'
      process.env['AUTOSHOW_UNRELATED_SECRET'] = 'must-not-leak'
      const env = buildTestWorkerEnv(
        ['test/test-cases/e2e/service/audio/tts/example.test.ts'],
        artifacts,
        true,
        {}
      )

      expect(env['AUTOSHOW_TEST_CREDENTIAL_MODE']).toBe('live')
      expect(env['OPENAI_API_KEY']).toBe('provider-fixture')
      expect(env['MISTRAL_API_KEY']).toBeUndefined()
      expect(env['AUTOSHOW_UNRELATED_SECRET']).toBeUndefined()
    } finally {
      restoreEnv('AUTOSHOW_TEST_CREDENTIAL_MODE', priorMode)
      restoreEnv('AUTOSHOW_TEST_CREDENTIAL_KEYS', priorKeys)
      restoreEnv('OPENAI_API_KEY', priorProvider)
      restoreEnv('MISTRAL_API_KEY', priorOtherProvider)
      restoreEnv('AUTOSHOW_UNRELATED_SECRET', priorSecret)
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
