import type { AdaptiveConcurrencyConfig, AppErrorKind, CommandResultBase, OutputMetadataSummary } from '~/types'

export type BudgetKeyInput = string | readonly string[]

export type MockFetchCall = {
  url: string
  method: string
  headers: Headers
  bodyText: string
  bodyJson?: Record<string, unknown> | undefined
  bodyBytes?: number | undefined
  form?: FormData | undefined
}

export type MockFetchHandler = (
  call: MockFetchCall,
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
) => Promise<Response> | Response

export type EnvSnapshot = Record<string, string | undefined>

export type RunCommandOptions = {
  testName?: string
  env?: Record<string, string | undefined>
  cwd?: string
  timeoutMs?: number
  forceSourceCli?: boolean
  attemptRunner?: RunCommandAttemptRunner
  adaptiveStateDir?: string
  adaptiveConfig?: Partial<Omit<AdaptiveConcurrencyConfig, 'stateDir'>>
}

export type RunCommandResult = CommandResultBase & {
  outputDir: string | null
  outputRoot: string
}

type RunCommandAttemptInput = {
  args: string[]
  env: Record<string, string | undefined>
  attempt: number
  timeoutMs: number
  outputRoot: string
}

export type RunCommandAttemptResult = CommandResultBase & {
  timedOut?: boolean | undefined
}

export type RunCommandAttemptRunner = (input: RunCommandAttemptInput) => Promise<RunCommandAttemptResult>

export type ConsoleMethod = 'log' | 'warn' | 'error' | 'info' | 'debug'

export type TestBuffer = {
  lines: string[]
  failed: boolean
}

export type CallerLocation = { file: string | null, line: number | null, column: number | null }

export type RunCommandArtifacts = {
  outputDir: string | null
  absoluteOutputDir: string | null
  metadataSummary: OutputMetadataSummary | null
  parsedEstimatedCostCents: number | null
}

export type RunAndExpectOutputDirOptions = {
  // Retry a single transient provider failure before treating it as fatal.
  transient?: {
    isTransient: (output: string) => boolean
    providerLabel: string
    persistedLabel: string
  }
  // Runs before the generic exit-code handling, so a suite can convert a known provider
  // account state into its own terminal message.
  onResult?: (result: RunCommandResult) => void
  // Set false for suites that report the raw command failure without classifying it as a
  // live-provider availability problem. Defaults to true.
  classifyAvailability?: boolean
}

export type CommandFailureExpectation = {
  // Defaults to 2: the usage exit code, which is what nearly every caller means.
  exitCode?: number
  contains?: string | readonly string[]
  notContains?: string | readonly string[]
  env?: RunCommandOptions['env']
}

export type ConsoleCapture = {
  stdout: string[]
  stderr: string[]
}

export type CaptureConsoleOptions = {
  // Strip ANSI before recording, so assertions do not depend on the color regime.
  strip?: boolean
  // Swap in an interactive human sink for the duration. Under the non-TTY test
  // runner the default sink routes info-level events to stderr, which leaves
  // `stdout` empty for tests that mean to assert on the stdout channel.
  interactiveHumanSink?: boolean
}

export type ProviderHttpErrorExpectation = {
  status?: number
  kind?: AppErrorKind
  stage?: string
  retryable?: boolean
  headers?: Readonly<Record<string, string>>
  messageContains?: string | readonly string[]
  instanceOf?: new (...args: never[]) => Error
  name?: string
}
