import { readFileSync } from 'node:fs'
import { mkdir, readdir, rm, appendFile, copyFile, stat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path'
import { parseCommandOutputText } from '../test-runner/utils'
import {
  acquireAdaptiveProviderLease,
  classifyAdaptivePressure,
  formatAdaptiveRetrySummary,
  recordAdaptivePressure,
  recordAdaptiveSuccess,
  resolveAdaptiveConcurrencyConfig
} from '../test-runner/adaptive-concurrency'
import { extractAdaptiveProviderGroups } from '../test-runner/adaptive-provider-groups'
import { parseConfiguredEnvValueFromDotEnv } from './env-file'
import { readOutputMetadataSummary } from './output-metadata-summary'
import { E2E_TEST_TIMEOUT_MS } from './timeouts'
import { configureOutputRoot } from '~/cli/commands/process-steps/output-root'
import type {
  AdaptiveCommandAttemptRecord,
  AdaptiveConcurrencyConfig,
  CallerLocation,
  CommandResultBase,
  RunCommandArtifacts,
  RunCommandAttemptResult,
  RunCommandOptions,
  RunCommandResult
} from '~/types'
import { hasErrorCode, serializeDiagnosticError } from '~/utils/error-handler'
import { l } from '~/utils/app-logger/app-logger'

const TEST_OUTPUT_ROOT = 'project/test-output'

const sanitizeOutputRootSegment = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'run'

const resolveTestOutputDir = (): string => {
  const artifactsDir = process.env['AUTOSHOW_TEST_ARTIFACTS_DIR']?.trim()
  if (artifactsDir) {
    return join(artifactsDir, 'outputs', `p${process.pid}`)
  }

  const explicit = process.env['AUTOSHOW_TEST_OUTPUT_DIR']?.trim()
  if (explicit) {
    return explicit
  }

  return join(TEST_OUTPUT_ROOT, 'local', `p${process.pid}`)
}

export const OUTPUT_DIR = resolveTestOutputDir()
// In-process tests call production getOutputRoot() directly; point it at the test
// output dir. (Production no longer reads AUTOSHOW_OUTPUT_DIR — it is flag-driven.)
configureOutputRoot(OUTPUT_DIR)
const EXAMPLE_AUDIO_URL = 'https://ajc.pics/autoshow/examples/1-audio.mp3'
export const EXAMPLE_SHORT_AUDIO_URL = 'https://ajc.pics/autoshow/examples/0-audio-short.mp3'

export const LOCAL_EXAMPLE_AUDIO_PATH = join('input/examples/audio', '1-audio.mp3')
export const LOCAL_EXAMPLE_SHORT_AUDIO_PATH = join('input/examples/audio', '0-audio-short.mp3')
export const STABLE_EXAMPLE_AUDIO_URL = EXAMPLE_AUDIO_URL
export const STABLE_EXAMPLE_AUDIO_TITLE = STABLE_EXAMPLE_AUDIO_URL.split('/').pop()?.replace(/\.[^/.]+$/, '') ?? ''
export const STABLE_TTS_MD_PATH = 'input/examples/tts/1-tts.md'
export const STABLE_TTS_MD_TITLE = '1-tts'
const PAGE_IMAGE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAN0lEQVR4nO3RwQ0AMAjDwJT9d05HMB9+vgGCZF7bXJrT9XhgwR8gEyETIRMhEyETIRMhEyEThXzH8QM9OMM6fAAAAABJRU5ErkJggg=='

const shouldPreserveArtifacts = (): boolean => process.env['AUTOSHOW_TEST_PRESERVE_ARTIFACTS'] !== '0'

const sanitizeOutputSuffix = (titleSuffix: string): string =>
  titleSuffix.replace(/\s+/g, '_').replace(/[<>:"/\\|?*]/g, '')

const parseCallerLocation = (): { file: string | null, line: number | null, column: number | null } => {
  const stack = new Error().stack ?? ''
  const lines = stack.split('\n').map(line => line.trim())
  const parsedCandidates: Array<{ file: string, line: number, column: number }> = []

  for (const line of lines) {
    const matchWithParen = line.match(/\((.*):(\d+):(\d+)\)$/)
    const matchNoParen = line.match(/at (.*):(\d+):(\d+)$/)
    const match = matchWithParen ?? matchNoParen
    if (!match) {
      continue
    }

    const rawPath = match[1]
    const lineNo = Number.parseInt(match[2] || '', 10)
    const colNo = Number.parseInt(match[3] || '', 10)

    if (!rawPath || Number.isNaN(lineNo) || Number.isNaN(colNo)) {
      continue
    }

    const normalizedPath = rawPath.replace(/^file:\/\//, '')
    if (!normalizedPath.includes('/test/')) {
      continue
    }
    const absolutePath = isAbsolute(normalizedPath) ? normalizedPath : resolve(process.cwd(), normalizedPath)
    const relativePath = normalize(relative(process.cwd(), absolutePath)).replace(/\\/g, '/')
    parsedCandidates.push({ file: relativePath, line: lineNo, column: colNo })
  }

  const testCaseHit = parsedCandidates.find(candidate => candidate.file.includes('test/test-cases/'))
  if (testCaseHit) {
    return testCaseHit
  }

  const fallback = parsedCandidates.find(candidate => candidate.file !== 'test/test-utils/test-helpers.ts')
  if (fallback) {
    return fallback
  }

  return {
    file: null,
    line: null,
    column: null,
  }
}

const copyManifestToArtifacts = async (outputDir: string | null, outputRoot: string): Promise<void> => {
  const artifactsDir = process.env['AUTOSHOW_TEST_ARTIFACTS_DIR']
  if (!artifactsDir || !outputDir) {
    return
  }

  const absoluteOutputDir = isAbsolute(outputDir) ? outputDir : resolve(process.cwd(), outputDir)
  const absoluteOutputRoot = isAbsolute(outputRoot) ? outputRoot : resolve(process.cwd(), outputRoot)
  const srcPath = `${absoluteOutputDir}/manifest.json`

  try {
    const exists = await fileExists(srcPath)
    if (!exists) {
      return
    }

    const destDir = `${artifactsDir}/run`
    const destName = [
      sanitizeOutputRootSegment(basename(absoluteOutputRoot)),
      sanitizeOutputRootSegment(basename(absoluteOutputDir)),
    ].join('-')
    await mkdir(destDir, { recursive: true })
    await copyFile(srcPath, `${destDir}/${destName}.json`)
  } catch {
  }
}

const SUBPROCESS_TIMEOUT = E2E_TEST_TIMEOUT_MS
const TEST_CONFIG_PATH = resolve(import.meta.dir, 'fixtures/empty-autoshow-config.json')
const PROCESSING_COMMANDS = new Set([
  'metadata',
  'download',
  'extract',
  'resume',
  'write',
  'tts',
  'image',
  'music',
  'video',
  'comic'
])
const HELP_FLAGS = new Set(['--help', '-h'])

export const CLI_SOURCE_ENTRY = 'src/cli/create-cli.ts'

export const resolveCliSpawnArgs = (args: string[], forceSource = false): string[] => {
  const bundle = process.env['AUTOSHOW_TEST_CLI_BUNDLE']?.trim()
  if (!forceSource && bundle && args[0] === CLI_SOURCE_ENTRY) {
    return [bundle, ...args.slice(1)]
  }
  return args
}

let commandOutputCounter = 0
let commandMetricsWriteWarned = false
const BASE_CHILD_ENV = Object.entries(process.env).reduce<Record<string, string>>((env, [key, value]) => {
  if (typeof value === 'string') {
    env[key] = value
  }
  return env
}, {})

const shouldUseEmptyTestConfig = (args: string[]): boolean => {
  if (args[0] !== CLI_SOURCE_ENTRY) {
    return false
  }

  if (args.some((arg) => arg === '--config-path' || arg.startsWith('--config-path='))) {
    return false
  }

  if (args.some((arg) => HELP_FLAGS.has(arg))) {
    return false
  }

  const command = args[1]
  return typeof command === 'string' && PROCESSING_COMMANDS.has(command)
}

const withEmptyTestConfig = (args: string[]): string[] =>
  shouldUseEmptyTestConfig(args)
    ? [...args, '--config-path', TEST_CONFIG_PATH]
    : args

const isProcessingCliCommand = (args: string[]): boolean => {
  if (args[0] !== CLI_SOURCE_ENTRY) {
    return false
  }
  if (args.some((arg) => HELP_FLAGS.has(arg))) {
    return false
  }
  const command = args[1]
  return typeof command === 'string' && PROCESSING_COMMANDS.has(command)
}

const createCommandOutputRoot = async (args: string[], testName: string | null): Promise<string> => {
  const index = ++commandOutputCounter
  const command = args[1] ?? 'command'
  const label = testName ?? args.slice(1, 5).join('-')
  const segment = [
    String(index).padStart(4, '0'),
    Date.now().toString(36),
    sanitizeOutputRootSegment(command),
    sanitizeOutputRootSegment(label).slice(0, 80),
  ].filter(Boolean).join('-')
  const outputRoot = join(OUTPUT_DIR, segment)
  await mkdir(outputRoot, { recursive: true })
  return outputRoot
}

const resolveCommandOutputRoot = async (
  args: string[],
  testName: string | null,
  env: Record<string, string | undefined> | undefined
): Promise<string> => {
  const explicitOutputRoot = env?.['AUTOSHOW_TEST_OUTPUT_DIR']?.trim()
  if (explicitOutputRoot) {
    return explicitOutputRoot
  }

  if (isProcessingCliCommand(args)) {
    return await createCommandOutputRoot(args, testName)
  }

  return OUTPUT_DIR
}

const readStreamText = async (stream: ReadableStream): Promise<string> => {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let full = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      full += decoder.decode(value, { stream: true })
    }

    full += decoder.decode()
  } finally {
    reader.releaseLock()
  }

  return full
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
  const proc = Bun.spawn(['bun', ...spawnArgs], {
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

const appendAttemptOutput = (
  current: string,
  next: string,
  attempt: number,
  streamLabel: 'stdout' | 'stderr'
): string => {
  if (attempt === 1) {
    return next
  }

  const separator = `\n--- adaptive attempt ${attempt} ${streamLabel} ---\n`
  return `${current}${separator}${next}`
}

const appendAdaptiveSummary = (
  stderr: string,
  records: AdaptiveCommandAttemptRecord[],
  finalExitCode: number
): string => {
  const summary = formatAdaptiveRetrySummary(records, finalExitCode)
  if (!summary) {
    return stderr
  }

  return `${stderr.trimEnd()}\n\n${summary}\n`
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
  const maxAttempts = adaptiveConfig && groups.length > 0 ? adaptiveConfig.maxAttempts : 1
  const adaptiveRecords: AdaptiveCommandAttemptRecord[] = []
  let stdout = ''
  let stderr = ''
  let exitCode = 0

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const lease = adaptiveConfig && groups.length > 0
      ? await acquireAdaptiveProviderLease(groups, adaptiveConfig, {
          command: commandText,
          leaseTtlMs: timeoutMs + 60_000,
        })
      : null

    try {
      const result = await runCommandAttempt(args, env, opts, attempt, timeoutMs, outputRoot)

      stdout = appendAttemptOutput(stdout, result.stdout, attempt, 'stdout')
      stderr = appendAttemptOutput(stderr, result.stderr, attempt, 'stderr')
      exitCode = result.exitCode

      if (!adaptiveConfig || groups.length === 0) {
        break
      }

      if (result.exitCode === 0) {
        await recordAdaptiveSuccess(groups, adaptiveConfig)
        break
      }

      const pressure = classifyAdaptivePressure(`${result.stdout}\n${result.stderr}`, result.exitCode, result.timedOut === true)
      if (!pressure) {
        break
      }

      adaptiveRecords.push({
        attempt,
        exitCode: result.exitCode,
        pressure,
        groups,
      })
      await recordAdaptivePressure(groups, pressure, adaptiveConfig)

      if (attempt >= maxAttempts) {
        stderr = appendAdaptiveSummary(stderr, adaptiveRecords, result.exitCode)
        break
      }
    } finally {
      await lease?.release()
    }
  }

  return { exitCode, stdout, stderr, adaptiveRecords }
}

// Production reads config from flags, not env. Translate the harness's output-root
// and optional bin-dir conventions into the global CLI flags the child understands.
// Only inject for processing commands (the ones that consume the output root and the
// managed binaries); help invocations do not need either. Insert BEFORE any `--`
// passthrough separator so the flags are parsed by AutoShow, not forwarded to yt-dlp.
export const injectGlobalCliFlags = (
  baseChildArgs: string[],
  outputRoot: string,
  overrideBinDir: string | undefined
): string[] => {
  const injectedGlobalFlags = isProcessingCliCommand(baseChildArgs)
    ? [
      '--output-root', outputRoot,
      ...(overrideBinDir ? ['--bin-dir', overrideBinDir] : [])
    ]
    : []

  if (injectedGlobalFlags.length === 0) {
    return baseChildArgs
  }

  const passthroughIndex = baseChildArgs.indexOf('--')
  return passthroughIndex === -1
    ? [...baseChildArgs, ...injectedGlobalFlags]
    : [
      ...baseChildArgs.slice(0, passthroughIndex),
      ...injectedGlobalFlags,
      ...baseChildArgs.slice(passthroughIndex)
    ]
}

const buildChildEnv = (optsEnv: Record<string, string | undefined> | undefined): Record<string, string | undefined> => ({
  ...BASE_CHILD_ENV,
  // Don't let an inherited FORCE_COLOR (set when `bun t` runs in an interactive
  // terminal) force ANSI codes into child CLI output. FORCE_COLOR overrides both
  // NO_COLOR and non-TTY detection (see shouldUseTerminalColors), which breaks
  // plain-substring assertions. Tests that need color can re-enable via opts.env.
  FORCE_COLOR: '0',
  ...(optsEnv ?? {})
})

const collectRunArtifacts = async (
  stdout: string,
  stderr: string,
  outputRoot: string
): Promise<RunCommandArtifacts> => {
  const { outputDir, estimatedCostCents: parsedEstimatedCostCents } = parseCommandOutputText(`${stdout}\n${stderr}`)
  await copyManifestToArtifacts(outputDir, outputRoot)
  const absoluteOutputDir = outputDir
    ? (isAbsolute(outputDir) ? outputDir : resolve(process.cwd(), outputDir))
    : null
  const metadataSummary = absoluteOutputDir
    ? await readOutputMetadataSummary(`${absoluteOutputDir}/manifest.json`)
    : null

  return { outputDir, absoluteOutputDir, metadataSummary, parsedEstimatedCostCents }
}

const appendCommandMetricsRecord = async (
  metricsLogPath: string,
  parts: {
    commandText: string
    args: string[]
    exitCode: number
    durationMs: number
    outputRoot: string
    caller: CallerLocation
    testName: string | null
    runArtifacts: RunCommandArtifacts
    adaptiveConfig: AdaptiveConcurrencyConfig | null
    adaptiveRetryAttempts: number
  }
): Promise<void> => {
  const { runArtifacts, caller } = parts
  const record = {
    kind: 'command_metric',
    at: new Date().toISOString(),
    source: 'runCommand',
    command: parts.commandText,
    args: parts.args,
    exitCode: parts.exitCode,
    durationMs: parts.durationMs,
    outputDir: runArtifacts.outputDir,
    outputRoot: parts.outputRoot,
    callerFile: caller.file,
    callerLine: caller.line,
    callerColumn: caller.column,
    testName: parts.testName,
    estimatedCostCents: runArtifacts.metadataSummary?.estimatedCostCents ?? runArtifacts.parsedEstimatedCostCents,
    actualCostCents: runArtifacts.metadataSummary?.actualCostCents ?? null,
    estimatedProcessingTimeMs: runArtifacts.metadataSummary?.estimatedProcessingTimeMs ?? null,
    actualProcessingTimeMs: runArtifacts.metadataSummary?.actualProcessingTimeMs ?? null,
    adaptiveConcurrencyGroups: parts.adaptiveConfig ? extractAdaptiveProviderGroups(parts.args) : [],
    adaptiveRetryAttempts: parts.adaptiveRetryAttempts,
  }

  try {
    await appendFile(metricsLogPath, `${JSON.stringify(record)}\n`)
  } catch (error) {
    // Warn once per process: a broken metrics path otherwise yields empty pricing reports
    // with no signal, while warning per command would drown the run.
    if (commandMetricsWriteWarned) return
    commandMetricsWriteWarned = true
    l.warn(`Could not append to the command metrics log at ${metricsLogPath}; pricing reports will be incomplete`, {
      category: 'pricing',
      metadata: { metricsLogPath, error: serializeDiagnosticError(error) }
    })
  }
}

export const runCommand = async (args: string[], opts?: RunCommandOptions): Promise<RunCommandResult> => {
  const testName = opts?.testName ?? null
  const baseChildArgs = withEmptyTestConfig(args)
  const startTime = Date.now()
  const commandLogPath = process.env['AUTOSHOW_TEST_COMMAND_LOG']
  const metricsLogPath = process.env['AUTOSHOW_TEST_METRICS_LOG']
  const timeoutMs = opts?.timeoutMs ?? SUBPROCESS_TIMEOUT
  const outputRoot = await resolveCommandOutputRoot(baseChildArgs, testName, opts?.env)

  const childArgs = injectGlobalCliFlags(baseChildArgs, outputRoot, opts?.env?.['AUTOSHOW_BIN_DIR']?.trim())
  const cmdStr = `bun ${childArgs.join(' ')}`
  const env = buildChildEnv(opts?.env)

  const caller = parseCallerLocation()
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
      adaptiveRetryAttempts: adaptiveRecords.length,
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

export const fileExists = async (path: string): Promise<boolean> => {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

export const ensurePageImageFixture = async (path = 'input/examples/document/1-document.png'): Promise<void> => {
  await Bun.write(path, Buffer.from(PAGE_IMAGE_PNG_BASE64, 'base64'))
}

const listMatchingOutputDirs = async (titleSuffix: string, outputRoot = OUTPUT_DIR): Promise<string[]> => {
  const sanitizedSuffix = sanitizeOutputSuffix(titleSuffix)

  try {
    const entries = await readdir(outputRoot, { withFileTypes: true })
    return entries
      .filter(entry => entry.isDirectory() && entry.name.endsWith(`_${sanitizedSuffix}`))
      .map(entry => join(outputRoot, entry.name))
  } catch {
    return []
  }
}

const listMatchingOutputDirsRecursive = async (titleSuffix: string, outputRoot: string): Promise<string[]> => {
  const direct = await listMatchingOutputDirs(titleSuffix, outputRoot)

  try {
    const entries = await readdir(outputRoot, { withFileTypes: true })
    const nested = await Promise.all(
      entries
        .filter(entry => entry.isDirectory())
        .map(entry => listMatchingOutputDirs(titleSuffix, join(outputRoot, entry.name)))
    )
    return [...direct, ...nested.flat()]
  } catch {
    return direct
  }
}

export const findLatestDirectory = async (
  titleSuffix: string,
  outputRoot?: string | null
): Promise<string | null> => {
  try {
    const directories = outputRoot
      ? await listMatchingOutputDirs(titleSuffix, outputRoot)
      : await listMatchingOutputDirsRecursive(titleSuffix, OUTPUT_DIR)

    if (directories.length === 0) {
      return null
    }

    const stats = await Promise.all(
      directories.map(async (dir) => {
        const s = await stat(dir)
        return { dir, mtimeMs: s.mtimeMs }
      })
    )

    stats.sort((a, b) => {
      if (a.mtimeMs !== b.mtimeMs) return a.mtimeMs - b.mtimeMs
      return a.dir.localeCompare(b.dir)
    })

    return stats[stats.length - 1]?.dir ?? null
  } catch (error) {
    // Only "the directory isn't there" means "no match". A permissions or ENOTDIR failure
    // used to return null too, which downstream reported as a misleading
    // `Expected output directory for <title>` instead of the real filesystem problem.
    if (hasErrorCode(error, 'ENOENT')) {
      return null
    }
    throw error
  }
}

export const cleanupTestOutput = async (titleSuffix: string): Promise<void> => {
  if (shouldPreserveArtifacts()) {
    return
  }

  try {
    const dirs = await listMatchingOutputDirs(titleSuffix)
    await Promise.all(dirs.map(d => rm(d, { recursive: true, force: true })))
  } catch {
  }
}

export const readConfiguredEnvVar = async (key: string): Promise<string | undefined> => {
  const direct = process.env[key]?.trim()
  if (direct) {
    return direct
  }

  try {
    const text = await Bun.file('.env').text()
    return parseConfiguredEnvValueFromDotEnv(text, key)
  } catch {
  }

  return undefined
}

export const readConfiguredEnvVarSync = (key: string): string | undefined => {
  const direct = process.env[key]?.trim()
  if (direct) {
    return direct
  }

  try {
    const text = readFileSync('.env', 'utf8')
    return parseConfiguredEnvValueFromDotEnv(text, key)
  } catch {
  }

  return undefined
}

export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

export const toRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.filter(isRecord)
  }
  return isRecord(value) ? [value] : []
}
