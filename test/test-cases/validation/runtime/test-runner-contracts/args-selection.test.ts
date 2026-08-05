import {
  afterEach,
  describe,
  expect,
  test
} from 'bun:test'
import { rm } from 'node:fs/promises'
import {
  DEFAULT_TEST_RUNNER_CONCURRENCY,
  isE2EOnlyTestSelection,
  parseRunnerArgs,
  withDefaultTestConcurrency
} from '../../../../test-runner/args'
import { formatSelectedPathsLabel } from '../../../../test-runner/path-selection'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('test-runner contracts', () => {
  test('arg parsing separates path filters from runner flags', () => {
      const parsed = parseRunnerArgs([
        'bun',
        'test/test-runner.ts',
        'test/test-cases/validation-next/',
        '--price',
        '--budget',
        '500',
        '--bail'
      ])

      expect(parsed.pathFilters).toEqual(['test/test-cases/validation-next/'])
      expect(parsed.priceMode).toBe(true)
      expect(parsed.budgetHundredthCents).toBe(500)
      expect(parsed.preserveTestOutput).toBe(false)
      expect(parsed.passthroughArgs).toEqual(['--bail'])
    })

  test('arg parsing rejects legacy test price spellings', () => {
      expect(() => parseRunnerArgs([
        'bun',
        'test/test-runner.ts',
        '--test-price',
      ])).toThrow('replaced by --price')

      expect(() => parseRunnerArgs([
        'bun',
        'test/test-runner.ts',
        '--testprice',
      ])).toThrow('Use --price')
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
        '--cleanup',
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

  test('path-selection labels strip the test/test-cases prefix for validation paths', () => {
      expect(formatSelectedPathsLabel(['test/test-cases/validation-next/'])).toBe('Selected paths: validation-next')
      expect(formatSelectedPathsLabel(['test/test-cases/validation/'])).toBe('Selected paths: validation')
      expect(formatSelectedPathsLabel(['test/test-cases/e2e/service/step-4-tts-e2e/tts-services/'])).toBe('Selected paths: service/step-4-tts-e2e/tts-services')
    })
})
