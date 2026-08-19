import type { AdaptiveConcurrencyConfig, CommandResultBase, OutputMetadataSummary } from '~/types'

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

export type RunCommandAttemptInput = {
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
