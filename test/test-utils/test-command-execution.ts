import { appendFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import type {
  AdaptiveCommandAttemptRecord,
  AdaptiveConcurrencyConfig,
  CallerLocation,
  CommandResultBase,
  RunCommandAttemptResult,
  RunCommandOptions,
  RunCommandResult
} from '~/types'
import { consumeBoundedTextStream } from '~/utils/bounded-text-stream'
import {
  acquireAdaptiveProviderLease,
  classifyAdaptivePressure,
  recordAdaptivePressure,
  recordAdaptiveSuccess,
  resolveAdaptiveConcurrencyConfig
} from '../test-runner/adaptive-concurrency'
import { extractAdaptiveProviderGroups } from '../test-runner/adaptive-provider-groups'
import { appendCommandMetricsRecord, collectRunArtifacts } from './test-command-artifacts'
import { buildChildEnv, CLI_SOURCE_ENTRY, injectGlobalCliFlags, isProcessingCliCommand, withEmptyTestConfig } from './test-command-options'
import { OUTPUT_DIR, resolveCommandOutputRoot } from './test-output-directories'
import { E2E_TEST_TIMEOUT_MS } from './timeouts'

const MAX_TEST_COMMAND_STREAM_BYTES = 64 * 1024 * 1024

const SUBPROCESS_TIMEOUT = E2E_TEST_TIMEOUT_MS

const resolveCliSpawnArgs = (args: string[], forceSource = false): string[] => {
  const bundle = process.env['AUTOSHOW_TEST_CLI_BUNDLE']?.trim()
  if (!forceSource && bundle && args[0] === CLI_SOURCE_ENTRY) {
    return [bundle, ...args.slice(1)]
  }
  return args
}

const readStreamText = async (stream: ReadableStream): Promise<string> => {
  const result = await consumeBoundedTextStream(stream as ReadableStream<Uint8Array>, {
    maxBytes: MAX_TEST_COMMAND_STREAM_BYTES,
    retainText: true
  })
  return result.text
}

const resolveAdaptiveStateDir = (
  env: Record<string, string | undefined>,
  outputRoot: string
): string => {
  const artifactsDir = env['AUTOSHOW_TEST_ARTIFACTS_DIR']?.trim()
  if (artifactsDir) {
    return join(artifactsDir, 'adaptive-concurrency')
  }

  const absoluteOutputRoot = isAbsolute(outputRoot) ? outputRoot : resolve(process.cwd(), outputRoot)
  const absoluteProcessOutputDir = isAbsolute(OUTPUT_DIR) ? OUTPUT_DIR : resolve(process.cwd(), OUTPUT_DIR)
  if (absoluteOutputRoot.startsWith(`${absoluteProcessOutputDir}/`)) {
    return join(dirname(absoluteProcessOutputDir), '.adaptive-concurrency')
  }

  return join(dirname(outputRoot), '.adaptive-concurrency')
}

const shouldUseAdaptiveConcurrency = (
  args: string[],
  callerFile: string | null,
  env: Record<string, string | undefined>
): boolean => {
  if (!isProcessingCliCommand(args)) {
    return false
  }

  const configured = env['AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY']?.trim().toLowerCase()
  if (configured === '0' || configured === 'false' || configured === 'off') {
    return false
  }

  if (configured === 'force' || configured === 'always') {
    return true
  }

  if (env['AUTOSHOW_TEST_ADAPTIVE_E2E_SELECTION'] === '1') {
    return true
  }

  return callerFile?.startsWith('test/test-cases/e2e/') === true
}

const runCommandAttempt = async (
  args: string[],
  env: Record<string, string | undefined>,
  opts: RunCommandOptions | undefined,
  attempt: number,
  timeoutMs: number,
  outputRoot: string
): Promise<Required<RunCommandAttemptResult>> => {
  if (opts?.attemptRunner) {
    const result = await opts.attemptRunner({ args, env, attempt, timeoutMs, outputRoot })
    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      timedOut: result.timedOut ?? false,
    }
  }

  const spawnArgs = resolveCliSpawnArgs(args, opts?.forceSourceCli === true)
  const spawnEnv = spawnArgs[0] !== args[0] && !env['AUTOSHOW_PROJECT_ROOT']
    ? { ...env, AUTOSHOW_PROJECT_ROOT: process.cwd() }
    : env
  const proc = Bun.spawn(['bun', '--no-env-file', ...spawnArgs], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: spawnEnv,
    ...(opts?.cwd ? { cwd: opts.cwd } : {})
  })
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    try {
      process.kill(-proc.pid, 'SIGTERM')
    } catch {
      proc.kill()
    }
  }, timeoutMs)

  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      readStreamText(proc.stdout),
      readStreamText(proc.stderr),
      proc.exited,
    ])

    return { stdout, stderr, exitCode, timedOut }
  } finally {
    clearTimeout(timer)
  }
}

const runCommandWithOptionalAdaptiveConcurrency = async (
  args: string[],
  env: Record<string, string | undefined>,
  opts: RunCommandOptions | undefined,
  commandText: string,
  timeoutMs: number,
  outputRoot: string,
  adaptiveConfig: AdaptiveConcurrencyConfig | null
): Promise<CommandResultBase & { adaptiveRecords: AdaptiveCommandAttemptRecord[] }> => {
  const groups = adaptiveConfig ? extractAdaptiveProviderGroups(args) : []
  const adaptiveRecords: AdaptiveCommandAttemptRecord[] = []
  const lease = adaptiveConfig && groups.length > 0
    ? await acquireAdaptiveProviderLease(groups, adaptiveConfig, { command: commandText, leaseTtlMs: timeoutMs + 60_000 })
    : null

  try {
    const result = await runCommandAttempt(args, env, opts, 1, timeoutMs, outputRoot)
    if (adaptiveConfig && groups.length > 0) {
      if (result.exitCode === 0) {
        await recordAdaptiveSuccess(groups, adaptiveConfig)
      } else {
        const pressure = classifyAdaptivePressure(`${result.stdout}\n${result.stderr}`, result.exitCode, result.timedOut === true)
        if (pressure) {
          adaptiveRecords.push({ attempt: 1, exitCode: result.exitCode, pressure, groups })
          await recordAdaptivePressure(groups, pressure, adaptiveConfig)
        }
      }
    }
    return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr, adaptiveRecords }
  } finally {
    await lease?.release()
  }
}

export const prepareTestCommand = async (args: string[], opts: RunCommandOptions | undefined) => {
  const testName = opts?.testName ?? null
  const baseChildArgs = withEmptyTestConfig(args)
  const startTime = Date.now()
  const commandLogPath = process.env['AUTOSHOW_TEST_COMMAND_LOG']
  const metricsLogPath = process.env['AUTOSHOW_TEST_METRICS_LOG']
  const timeoutMs = opts?.timeoutMs ?? SUBPROCESS_TIMEOUT
  const outputRoot = await resolveCommandOutputRoot(baseChildArgs, testName, opts?.env)

  const childArgs = injectGlobalCliFlags(baseChildArgs, outputRoot, opts?.binDir?.trim())
  const cmdStr = `bun ${childArgs.join(' ')}`
  const env = buildChildEnv(opts?.env)

  return { opts, testName, startTime, commandLogPath, metricsLogPath, timeoutMs, outputRoot, childArgs, cmdStr, env }
}

export const executeTestCommand = async (prepared: Awaited<ReturnType<typeof prepareTestCommand>>, caller: CallerLocation): Promise<RunCommandResult> => {
  const { opts, testName, startTime, commandLogPath, metricsLogPath, timeoutMs, outputRoot, childArgs, cmdStr, env } = prepared
  const adaptiveConfig = shouldUseAdaptiveConcurrency(childArgs, caller.file, env)
    ? resolveAdaptiveConcurrencyConfig(
      opts?.adaptiveStateDir ?? resolveAdaptiveStateDir(env, outputRoot),
      opts?.adaptiveConfig
    )
    : null
  const { stdout, stderr, exitCode, adaptiveRecords } = await runCommandWithOptionalAdaptiveConcurrency(
    childArgs,
    env,
    opts,
    cmdStr,
    timeoutMs,
    outputRoot,
    adaptiveConfig
  )
  const duration = Date.now() - startTime

  const runArtifacts = await collectRunArtifacts(stdout, stderr, outputRoot)

  if (metricsLogPath) {
    await appendCommandMetricsRecord(metricsLogPath, {
      commandText: cmdStr,
      args: childArgs,
      exitCode,
      durationMs: duration,
      outputRoot,
      caller,
      testName,
      runArtifacts,
      adaptiveConfig,
      adaptivePressureSignals: adaptiveRecords.length,
    })
  }

  if (commandLogPath) {
    await appendFile(
      commandLogPath,
      `\n=== START cmd: ${cmdStr} ===\nstdout:\n${stdout}\nstderr:\n${stderr}\n=== END cmd: ${cmdStr} (exit=${exitCode}, ${duration}ms) ===\n`
    )
  }
  return { exitCode, stdout, stderr, outputDir: runArtifacts.outputDir, outputRoot }
}
