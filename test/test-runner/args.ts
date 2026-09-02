import { availableParallelism } from 'node:os'
import type { RunnerArgDestination, RunnerArgs, RunnerControlResult, RunnerParseState } from '~/types'
import { VALIDATION_TEST_TIMEOUT_MS } from '../test-utils/timeouts'

export const DEFAULT_TEST_RUNNER_CONCURRENCY = Math.max(1, availableParallelism())
export const E2E_TEST_RUNNER_PARALLEL = 32
const E2E_TEST_CASE_PREFIX = 'test/test-cases/e2e/'

const BUN_TEST_MAX_CONCURRENCY_FLAG = '--max-concurrency'
const BUN_TEST_PARALLEL_FLAG = '--parallel'
const UNSUPPORTED_CONCURRENCY_FLAG = '--concurrency'
const UNSUPPORTED_CONCURRENCY_SPELLINGS = [
  UNSUPPORTED_CONCURRENCY_FLAG,
  `${UNSUPPORTED_CONCURRENCY_FLAG}=`,
] as const

const unsupportedConcurrencyMessage =
  'Error: --concurrency is not a Bun test runner flag. Use --max-concurrency=<n> for per-file test concurrency and --parallel=<n> for file-level worker parallelism.'
const unsupportedRetryMessage =
  'Error: test retry passthrough is disabled because every selected command and test must run at most once.'
const missingBudgetMessage =
  'Error: --budget requires a whole-number value in hundredths of a cent (for example: --budget 100 for 1 cent)'

const hasMaxConcurrencyFlag = (args: string[]): boolean =>
  args.some(arg => arg === BUN_TEST_MAX_CONCURRENCY_FLAG || arg.startsWith(`${BUN_TEST_MAX_CONCURRENCY_FLAG}=`))

const hasParallelFlag = (args: string[]): boolean =>
  args.some(arg => arg === BUN_TEST_PARALLEL_FLAG || arg.startsWith(`${BUN_TEST_PARALLEL_FLAG}=`))

const resolveDefaultParallel = (e2eOnly: boolean): number =>
  e2eOnly ? E2E_TEST_RUNNER_PARALLEL : DEFAULT_TEST_RUNNER_CONCURRENCY

export const withDefaultTestConcurrency = (
  args: string[],
  options: { e2eOnly?: boolean } = {}
): string[] => {
  const defaultArgs: string[] = []
  if (!hasMaxConcurrencyFlag(args)) {
    defaultArgs.push(`${BUN_TEST_MAX_CONCURRENCY_FLAG}=${DEFAULT_TEST_RUNNER_CONCURRENCY}`)
  }
  if (!hasParallelFlag(args)) {
    defaultArgs.push(`${BUN_TEST_PARALLEL_FLAG}=${resolveDefaultParallel(options.e2eOnly === true)}`)
  }
  return defaultArgs.length === 0 ? args : [...defaultArgs, ...args]
}

const isE2ETestCasePath = (path: string): boolean =>
  path.replace(/\\/g, '/').startsWith(E2E_TEST_CASE_PREFIX)

export const isE2EOnlyTestSelection = (files: string[]): boolean =>
  files.length > 0 && files.every(isE2ETestCasePath)

export const buildBunTestFlags = (files: string[], passthroughArgs: string[]): string[] => {
  const e2eOnly = isE2EOnlyTestSelection(files)
  return [
    '--timeout',
    String(VALIDATION_TEST_TIMEOUT_MS),
    ...withDefaultTestConcurrency(passthroughArgs, { e2eOnly }),
  ]
}

const parseBudgetHundredthCents = (value: string | undefined): number => {
  if (!value) {
    throw new Error(missingBudgetMessage)
  }
  if (!/^\d+$/.test(value)) {
    throw new Error(`Error: invalid --budget value "${value}". Use whole-number hundredths of a cent (for example: --budget 100 for 1 cent).`)
  }
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Error: invalid --budget value "${value}".`)
  }
  return parsed
}

const isUnsupportedConcurrencyArg = (arg: string): boolean =>
  arg === UNSUPPORTED_CONCURRENCY_SPELLINGS[0]
  || arg.startsWith(UNSUPPORTED_CONCURRENCY_SPELLINGS[1])

const consumeRunnerControlArg = (
  argv: string[],
  index: number,
  state: RunnerParseState
): RunnerControlResult => {
  const arg = argv[index]
  if (typeof arg !== 'string') {
    return { kind: 'unhandled' }
  }
  if (isUnsupportedConcurrencyArg(arg)) {
    throw new Error(unsupportedConcurrencyMessage)
  }
  if (arg === '--retry' || arg.startsWith('--retry=')) {
    throw new Error(unsupportedRetryMessage)
  }

  switch (arg) {
    case '--no-cleanup':
      state.preserveTestOutput = true
      return { kind: 'consumed', nextIndex: index }
    case '--no-adaptive-concurrency':
      state.adaptiveConcurrency = false
      return { kind: 'consumed', nextIndex: index }
    case '--price':
      state.priceMode = true
      return { kind: 'consumed', nextIndex: index }
    case '--budget':
      state.budgetHundredthCents = parseBudgetHundredthCents(argv[index + 1])
      return { kind: 'consumed', nextIndex: index + 1 }
    case '--':
      return { kind: 'consumed', nextIndex: index }
    default:
      return { kind: 'unhandled' }
  }
}

const classifyRunnerArg = (arg: string): RunnerArgDestination => {
  if (arg.startsWith('-')) return 'passthroughArgs'
  if (arg.includes('/')) return 'pathFilters'
  if (arg.endsWith('.ts')) return 'pathFilters'
  return 'passthroughArgs'
}

export const parseRunnerArgs = (argv: string[]): RunnerArgs => {
  const state: RunnerParseState = {
    priceMode: false,
    budgetHundredthCents: undefined,
    preserveTestOutput: false,
    adaptiveConcurrency: true,
    passthroughArgs: [],
    pathFilters: [],
  }

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index]
    if (typeof arg !== 'string') {
      continue
    }

    const controlResult = consumeRunnerControlArg(argv, index, state)
    if (controlResult.kind === 'consumed') {
      index = controlResult.nextIndex
      continue
    }

    state[classifyRunnerArg(arg)].push(arg)
  }

  return state
}
