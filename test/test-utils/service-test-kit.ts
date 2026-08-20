import { beforeAll } from 'bun:test'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from './budget'
import {
  runCommand,
  findLatestDirectory,
  readConfiguredEnvVar,
  readConfiguredEnvVarSync
} from './test-helpers'
import type { RunCommandOptions, RunCommandResult } from '~/types'
import { l } from '~/utils/app-logger/app-logger'
import { stripAnsi } from '~/utils/terminal-colors'
import {
  RUNWAY_INSUFFICIENT_CREDITS_MESSAGE,
  isGlmAccountAvailabilityFailure,
  isGlmReaderRateLimitFailure,
  isGlmCertificateExpiryFailure,
  isGlmRetryable429Exhaustion,
  isDeepInfraWhisperLargeV3CommandTimeout,
  isGeminiImageAvailabilityFailure,
  isGeminiImageEmptyResponse,
  isSupadataPlanLimitFailure,
  isBflResultDownloadAvailabilityFailure,
  isTogetherSttAvailabilityFailure
} from './provider-failure-classifiers'

export const classifyLiveProviderAvailabilityFailure = (output: string): string | null => {
  const cleanOutput = stripAnsi(output)
  if (cleanOutput.includes(RUNWAY_INSUFFICIENT_CREDITS_MESSAGE)) {
    return 'Runway account does not have enough credits to run this task'
  }
  if (isGlmAccountAvailabilityFailure(cleanOutput)) {
    return 'GLM account does not have enough balance or an active resource package'
  }
  if (isGlmReaderRateLimitFailure(cleanOutput)) {
    return 'GLM Reader is rate limited'
  }
  if (isGlmCertificateExpiryFailure(cleanOutput)) {
    return 'GLM provider TLS certificate has expired'
  }
  if (isGlmRetryable429Exhaustion(cleanOutput)) {
    return 'GLM provider remained rate limited after retries'
  }
  if (isDeepInfraWhisperLargeV3CommandTimeout(cleanOutput)) {
    return 'DeepInfra openai/whisper-large-v3 transcription timed out'
  }
  if (isGeminiImageAvailabilityFailure(cleanOutput)) {
    return 'Gemini image provider is temporarily unavailable or rate limited'
  }
  if (isGeminiImageEmptyResponse(cleanOutput)) {
    return 'Gemini image provider returned a response with no image content (refusal or filtered prompt)'
  }
  if (isSupadataPlanLimitFailure(cleanOutput)) {
    return 'Supadata account plan limit is exhausted'
  }
  if (isBflResultDownloadAvailabilityFailure(cleanOutput)) {
    return 'BFL image result download hit a transient provider availability failure'
  }
  if (isTogetherSttAvailabilityFailure(cleanOutput)) {
    return 'Together STT provider remained unavailable after retries'
  }
  return null
}

export const withOutputLifecycle = (
  _title: string,
  setup?: (() => Promise<void>) | undefined
): void => {
  beforeAll(async () => {
    if (setup) {
      await setup()
    }
  })
}

export const getMissingConfiguredEnvVarKeysSync = (
  envVarKeys: readonly (string | undefined)[]
): string[] => {
  const missing: string[] = []
  for (const envVarKey of envVarKeys) {
    if (!envVarKey) {
      continue
    }
    if (!readConfiguredEnvVarSync(envVarKey)) {
      missing.push(envVarKey)
    }
  }
  return missing
}

export const defineBudgetedLiveServiceTest = (
  budgetKey: Parameters<typeof budgetedTest>[0],
  name: string,
  _envVarKeys: readonly (string | undefined)[],
  fn: () => void | Promise<void>,
  timeoutMs: number = E2E_TEST_TIMEOUT_MS
): void => {
  // Always run the test. A missing API key fails it (via requireConfiguredEnvVar in the
  // body) rather than being silently skipped. Over-budget skipping still applies.
  budgetedTest(budgetKey, name, fn, timeoutMs)
}

export const requireConfiguredValue = <T>(
  value: T | null | undefined,
  message: string
): NonNullable<T> => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length > 0) {
      return trimmed as NonNullable<T>
    }
  } else if (value !== null && value !== undefined) {
    return value as NonNullable<T>
  }

  throw new Error(message)
}

export const requireConfiguredEnvVar = async (
  envVarKey: string,
  message = `${envVarKey} is required`
): Promise<string> => {
  const value = await readConfiguredEnvVar(envVarKey)
  return requireConfiguredValue(value, message)
}

export const requireConfiguredEnvVars = async (
  envVarKeys: readonly string[],
  message?: string
): Promise<Record<string, string>> => {
  const values: Record<string, string> = {}
  const missing: string[] = []

  for (const envVarKey of envVarKeys) {
    const value = await readConfiguredEnvVar(envVarKey)
    if (value) {
      values[envVarKey] = value
    } else {
      missing.push(envVarKey)
    }
  }

  if (missing.length > 0) {
    throw new Error(message ?? `${missing.join(', ')} required`)
  }

  return values
}

const COMMAND_FAILURE_TAIL_LINES = 80

const formatCommandArg = (arg: string): string =>
  /^[A-Za-z0-9_./:=@+-]+$/.test(arg) ? arg : JSON.stringify(arg)

const tailLines = (text: string, lineCount: number): string => {
  const trimmed = text.trimEnd()
  if (trimmed.length === 0) return '(empty)'
  return trimmed.split(/\r?\n/).slice(-lineCount).join('\n')
}

export const formatCommandFailureDiagnostics = (
  args: string[],
  result: { exitCode: number, stdout: string, stderr: string },
  lineCount = COMMAND_FAILURE_TAIL_LINES
): string => [
  `Command failed with exit code ${result.exitCode}: bun ${args.map(formatCommandArg).join(' ')}`,
  `--- stdout tail (${lineCount} lines) ---`,
  tailLines(result.stdout, lineCount),
  `--- stderr tail (${lineCount} lines) ---`,
  tailLines(result.stderr, lineCount)
].join('\n')

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

/**
 * Run a command, fail loudly with tail diagnostics, and return its output directory.
 *
 * The `transient` and `onResult` hooks exist so the LLM-write and TTS factories can reuse
 * this instead of keeping verbatim copies of the body — the two things they varied were a
 * single-retry transient predicate and a provider-specific terminal-failure check.
 */
export const runCommandAndExpectOutputDir = async (
  title: string,
  args: string[],
  opts?: RunCommandOptions,
  extra: RunAndExpectOutputDirOptions = {}
): Promise<string> => {
  const result = extra.transient
    ? await runCommandWithTransientRetry(args, extra.transient, opts)
    : await runCommand(args, opts)

  extra.onResult?.(result)

  const combinedOutput = `${result.stdout}\n${result.stderr}`
  if (result.exitCode !== 0) {
    const diagnostics = formatCommandFailureDiagnostics(args, result)
    const availabilityReason = extra.classifyAvailability === false
      ? undefined
      : classifyLiveProviderAvailabilityFailure(combinedOutput)
    if (availabilityReason) {
      throw new Error(`Live provider availability failure: ${availabilityReason}\n${diagnostics}`)
    }
    throw new Error(diagnostics)
  }

  const outputDir = result.outputDir ?? await findLatestDirectory(title, result.outputRoot)
  if (!outputDir) {
    throw new Error(`Expected output directory for ${title}`)
  }
  return outputDir
}

// Runs a command once; if it fails with a transient provider error (per `isTransient`), warns,
// waits, and retries a single time. Throws if the transient failure persists; otherwise returns
// the result for the caller to handle (success or a non-transient failure). Any factory can opt
// in by passing the relevant provider predicate from `./provider-failure-classifiers`.
export const runCommandWithTransientRetry = async (
  commandArgs: string[],
  opts: {
    isTransient: (output: string) => boolean
    providerLabel: string
    persistedLabel: string
    retryDelayMs?: number
  },
  runOptions?: RunCommandOptions
): Promise<Awaited<ReturnType<typeof runCommand>>> => {
  let result = await runCommand(commandArgs, runOptions)
  if (result.exitCode === 0) return result
  if (!opts.isTransient(`${result.stdout}\n${result.stderr}`)) return result

  l.warn(`Retrying once after ${opts.providerLabel}`, { category: 'pipeline' })
  await Bun.sleep(opts.retryDelayMs ?? 2_000)
  result = await runCommand(commandArgs, runOptions)

  if (result.exitCode !== 0 && opts.isTransient(`${result.stdout}\n${result.stderr}`)) {
    throw new Error(`${opts.persistedLabel}\n${formatCommandFailureDiagnostics(commandArgs, result)}`)
  }
  return result
}
