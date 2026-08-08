import type { RunnerArgs } from '~/types'

export const DEFAULT_TEST_RUNNER_CONCURRENCY = 10
export const E2E_TEST_CASE_PREFIX = 'test/test-cases/e2e/'

const BUN_TEST_MAX_CONCURRENCY_FLAG = '--max-concurrency'
const BUN_TEST_PARALLEL_FLAG = '--parallel'
const UNSUPPORTED_CONCURRENCY_FLAG = '--concurrency'

const unsupportedConcurrencyMessage =
  'Error: --concurrency is not a Bun test runner flag. Use --max-concurrency=<n> for per-file test concurrency and --parallel=<n> for file-level worker parallelism.'

const hasMaxConcurrencyFlag = (args: string[]): boolean =>
  args.some(arg => arg === BUN_TEST_MAX_CONCURRENCY_FLAG || arg.startsWith(`${BUN_TEST_MAX_CONCURRENCY_FLAG}=`))

const hasParallelFlag = (args: string[]): boolean =>
  args.some(arg => arg === BUN_TEST_PARALLEL_FLAG || arg.startsWith(`${BUN_TEST_PARALLEL_FLAG}=`))

export const withDefaultTestConcurrency = (args: string[]): string[] => {
  const defaultArgs: string[] = []
  if (!hasMaxConcurrencyFlag(args)) {
    defaultArgs.push(`${BUN_TEST_MAX_CONCURRENCY_FLAG}=${DEFAULT_TEST_RUNNER_CONCURRENCY}`)
  }
  if (!hasParallelFlag(args)) {
    defaultArgs.push(`${BUN_TEST_PARALLEL_FLAG}=${DEFAULT_TEST_RUNNER_CONCURRENCY}`)
  }
  return defaultArgs.length === 0 ? args : [...defaultArgs, ...args]
}

export const isE2ETestCasePath = (path: string): boolean =>
  path.replace(/\\/g, '/').startsWith(E2E_TEST_CASE_PREFIX)

export const isE2EOnlyTestSelection = (files: string[]): boolean =>
  files.length > 0 && files.every(isE2ETestCasePath)

export const parseRunnerArgs = (argv: string[]): RunnerArgs => {
  let priceMode = false
  let budgetHundredthCents: number | undefined
  let preserveTestOutput = false
  let adaptiveConcurrency = true
  const passthroughArgs: string[] = []
  const pathFilters: string[] = []

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (typeof arg !== 'string') {
      continue
    }

    switch (arg) {
      case '--no-cleanup':         preserveTestOutput = true; break
      case '--no-adaptive-concurrency': adaptiveConcurrency = false; break
      case '--price':              priceMode = true; break
      case UNSUPPORTED_CONCURRENCY_FLAG:
        throw new Error(unsupportedConcurrencyMessage)
      case '--budget': {
        const value = argv[++i]
        if (!value) {
          throw new Error('Error: --budget requires a whole-number value in hundredths of a cent (for example: --budget 100 for 1 cent)')
        }
        if (!/^\d+$/.test(value)) {
          throw new Error(`Error: invalid --budget value "${value}". Use whole-number hundredths of a cent (for example: --budget 100 for 1 cent).`)
        }
        const parsed = Number.parseInt(value, 10)
        if (!Number.isFinite(parsed)) {
          throw new Error(`Error: invalid --budget value "${value}".`)
        }
        budgetHundredthCents = parsed
        break
      }
      case '--':                   break
      default:
        if (arg.startsWith(`${UNSUPPORTED_CONCURRENCY_FLAG}=`)) {
          throw new Error(unsupportedConcurrencyMessage)
        }
        if (!arg.startsWith('-') && (arg.includes('/') || arg.endsWith('.ts'))) {
          pathFilters.push(arg)
        } else {
          passthroughArgs.push(arg)
      }
    }
  }

  return {
    priceMode,
    budgetHundredthCents,
    preserveTestOutput,
    adaptiveConcurrency,
    passthroughArgs,
    pathFilters,
  }
}
