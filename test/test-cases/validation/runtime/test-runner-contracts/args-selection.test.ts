import {
  afterEach,
  describe,
  expect,
  test
} from 'bun:test'
import { rm } from 'node:fs/promises'
import {
  DEFAULT_TEST_RUNNER_CONCURRENCY,
  E2E_TEST_RUNNER_PARALLEL,
  buildBunTestFlags,
  isE2EOnlyTestSelection,
  parseRunnerArgs,
  withDefaultTestConcurrency
} from '../../../../test-runner/args'
import { formatSelectedPathsLabel, orderTestFiles } from '../../../../test-runner/path-selection'
import { VALIDATION_TEST_TIMEOUT_MS } from '../../../../test-utils/timeouts'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('test-runner contracts', () => {
  test('arg parsing separates path filters from runner flags', () => {
      const parsed = parseRunnerArgs([
        'bun',
        'test/test-runner.ts',
        'test/test-cases/validation/runtime/',
        '--price',
        '--budget',
        '500',
        '--bail'
      ])

      expect(parsed.pathFilters).toEqual(['test/test-cases/validation/runtime/'])
      expect(parsed.priceMode).toBe(true)
      expect(parsed.budgetHundredthCents).toBe(500)
      expect(parsed.preserveTestOutput).toBe(false)
      expect(parsed.passthroughArgs).toEqual(['--bail'])
    })

  test('arg parsing rejects legacy --concurrency spelling', () => {
      for (const args of [
        ['--concurrency', '50'],
        ['--concurrency=50'],
      ]) {
        expect(() => parseRunnerArgs([
          'bun',
          'test/test-runner.ts',
          ...args,
        ])).toThrow('Use --max-concurrency=<n> for per-file test concurrency and --parallel=<n> for file-level worker parallelism')
      }
    })

  test('arg parsing uses --no-cleanup as the explicit keep flag', () => {
      const parsed = parseRunnerArgs([
        'bun',
        'test/test-runner.ts',
        '--no-cleanup',
        'test/test-cases/validation/'
      ])

      expect(parsed.pathFilters).toEqual(['test/test-cases/validation/'])
      expect(parsed.preserveTestOutput).toBe(true)
    })

  test('arg parsing consumes --no-adaptive-concurrency as a runner flag', () => {
      const parsed = parseRunnerArgs([
        'bun',
        'test/test-runner.ts',
        '--no-adaptive-concurrency',
        '--bail',
        'test/test-cases/e2e/'
      ])

      expect(parsed.adaptiveConcurrency).toBe(false)
      expect(parsed.pathFilters).toEqual(['test/test-cases/e2e/'])
      expect(parsed.passthroughArgs).toEqual(['--bail'])
    })

  test('adaptive e2e selection detection covers helper-defined service tests', () => {
      expect(isE2EOnlyTestSelection([
        'test/test-cases/e2e/service/step-2-stt-e2e/stt-services/deepinfra-openai-whisper-large-v3.test.ts',
        'test/test-cases/e2e/service/step-2-stt-e2e/stt-services/deepinfra-openai-whisper-large-v3-turbo.test.ts',
      ])).toBe(true)

      expect(isE2EOnlyTestSelection([
        'test/test-cases/e2e/service/step-2-stt-e2e/stt-services/deepinfra-openai-whisper-large-v3.test.ts',
        'test/test-cases/validation/cli-help-contracts.test.ts',
      ])).toBe(false)
    })

  test('normal test mode defaults bun test max concurrency and parallel workers', () => {
      expect(withDefaultTestConcurrency(['--bail'])).toEqual([
        `--max-concurrency=${DEFAULT_TEST_RUNNER_CONCURRENCY}`,
        `--parallel=${DEFAULT_TEST_RUNNER_CONCURRENCY}`,
        '--bail',
      ])
    })

  test('normal test mode preserves explicit bun test max concurrency and parallel workers', () => {
      expect(withDefaultTestConcurrency(['--max-concurrency=8', '--bail'])).toEqual([
        `--parallel=${DEFAULT_TEST_RUNNER_CONCURRENCY}`,
        '--max-concurrency=8',
        '--bail',
      ])
      expect(withDefaultTestConcurrency(['--max-concurrency', '8'])).toEqual([
        `--parallel=${DEFAULT_TEST_RUNNER_CONCURRENCY}`,
        '--max-concurrency',
        '8',
      ])
      expect(withDefaultTestConcurrency(['--parallel=4', '--bail'])).toEqual([
        `--max-concurrency=${DEFAULT_TEST_RUNNER_CONCURRENCY}`,
        '--parallel=4',
        '--bail',
      ])
      expect(withDefaultTestConcurrency(['--parallel', '4'])).toEqual([
        `--max-concurrency=${DEFAULT_TEST_RUNNER_CONCURRENCY}`,
        '--parallel',
        '4',
      ])
      expect(withDefaultTestConcurrency(['--max-concurrency=8', '--parallel=4', '--bail'])).toEqual([
        '--max-concurrency=8',
        '--parallel=4',
        '--bail',
      ])
    })

  test('e2e-only selections raise the default parallel worker count', () => {
      expect(withDefaultTestConcurrency(['--bail'], { e2eOnly: true })).toEqual([
        `--max-concurrency=${DEFAULT_TEST_RUNNER_CONCURRENCY}`,
        `--parallel=${E2E_TEST_RUNNER_PARALLEL}`,
        '--bail',
      ])
    })

  test('bun test flags use a 10 minute default timeout and retry only for e2e-only selections', () => {
      const validation = 'test/test-cases/validation/cli/cli-help-contracts.test.ts'
      const e2e = 'test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ocr-replicate.test.ts'
      expect(buildBunTestFlags([validation], ['--bail'])).toEqual([
        '--timeout',
        String(VALIDATION_TEST_TIMEOUT_MS),
        `--max-concurrency=${DEFAULT_TEST_RUNNER_CONCURRENCY}`,
        `--parallel=${DEFAULT_TEST_RUNNER_CONCURRENCY}`,
        '--bail',
      ])
      expect(buildBunTestFlags([e2e], [])).toEqual([
        '--timeout',
        String(VALIDATION_TEST_TIMEOUT_MS),
        '--retry',
        '1',
        `--max-concurrency=${DEFAULT_TEST_RUNNER_CONCURRENCY}`,
        `--parallel=${E2E_TEST_RUNNER_PARALLEL}`,
      ])
    })

  test('orderTestFiles hoists known-slow e2e files and keeps other files stable', () => {
    const validation = 'test/test-cases/validation/cli/cli-help-contracts.test.ts'
    const replicate = 'test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ocr-replicate.test.ts'
    const other = 'test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ocr-mistral.test.ts'
    expect(orderTestFiles([validation, replicate, other])).toEqual([replicate, validation, other])

    const unchanged = [validation, other]
    expect(orderTestFiles(unchanged)).toEqual(unchanged)
    expect(orderTestFiles(unchanged)).toHaveLength(unchanged.length)

    expect(orderTestFiles([validation, replicate, other], new Map([
      [validation, 50_000],
      [other, 80_000],
      [replicate, 10_000],
    ]))).toEqual([other, validation, replicate])
  })

  test('path-selection labels strip the test/test-cases prefix for validation paths', () => {
      expect(formatSelectedPathsLabel(['test/test-cases/validation/runtime/'])).toBe('Selected paths: validation/runtime')
      expect(formatSelectedPathsLabel(['test/test-cases/validation/'])).toBe('Selected paths: validation')
      expect(formatSelectedPathsLabel(['test/test-cases/e2e/service/step-4-tts-e2e/tts-services/'])).toBe('Selected paths: service/step-4-tts-e2e/tts-services')
    })
})
