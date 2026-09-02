import { readFileSync } from 'node:fs'
import { mkdir, readdir, rm, appendFile, copyFile } from 'node:fs/promises'
import { statPath as stat } from '~/utils/bun-file-io'
import { basename, dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path'
import { parseCommandOutputText } from '../test-runner/utils'
import {
  acquireAdaptiveProviderLease,
  classifyAdaptivePressure,
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
import { hasErrorCode } from '~/utils/error-handler'
import { l } from '~/utils/app-logger/app-logger'
import { isRecord } from '~/utils/value-helpers'
import { pathExists } from '~/utils/filesystem'
import { childEnv } from '~/utils/child-env'
import { HOSTED_PROVIDER_ENV_CHECKS } from '~/cli/commands/setup-and-utilities/setup/hosted-provider-config'
import { consumeBoundedTextStream } from '~/utils/bounded-text-stream'

const TEST_OUTPUT_ROOT = 'output/test-output'
const MAX_TEST_COMMAND_STREAM_BYTES = 64 * 1024 * 1024

const sanitizeOutputRootSegment = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'run'

export const testWorkerScratchSegment = (
  workerId = process.env['BUN_TEST_WORKER_ID'],
  pid = process.pid
): string => {
  const normalizedWorkerId = workerId?.trim()
  return normalizedWorkerId
    ? `w${sanitizeOutputRootSegment(normalizedWorkerId)}-p${pid}`
    : `p${pid}`
}

const resolveTestOutputDir = (): string => {
  const artifactsDir = process.env['AUTOSHOW_TEST_ARTIFACTS_DIR']?.trim()
  if (artifactsDir) {
    return join(artifactsDir, 'outputs', testWorkerScratchSegment())
  }

  const explicit = process.env['AUTOSHOW_TEST_OUTPUT_DIR']?.trim()
  if (explicit) {
    return explicit
  }

  return join(TEST_OUTPUT_ROOT, 'local', testWorkerScratchSegment())
}

export const OUTPUT_DIR = resolveTestOutputDir()
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
    const exists = await pathExists(srcPath)
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

const resolveCliSpawnArgs = (args: string[], forceSource = false): string[] => {
  const bundle = process.env['AUTOSHOW_TEST_CLI_BUNDLE']?.trim()
  if (!forceSource && bundle && args[0] === CLI_SOURCE_ENTRY) {
    return [bundle, ...args.slice(1)]
  }
  return args
}

let commandOutputCounter = 0
let commandMetricsWriteWarned = false
const BASE_CHILD_ENV = childEnv({
  allow: [
    ...HOSTED_PROVIDER_ENV_CHECKS.map(provider => provider.envVar),
    'AUTOSHOW_PROJECT_ROOT',
    'AUTOSHOW_TEST_CLI_BUNDLE'
  ]
})

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
    adaptivePressureSignals: number
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
    adaptivePressureSignals: parts.adaptivePressureSignals,
  }

  try {
    await appendFile(metricsLogPath, `${JSON.stringify(record)}\n`)
  } catch (error) {
    if (commandMetricsWriteWarned) return
    commandMetricsWriteWarned = true
    l.warn(`Could not append to the command metrics log at ${metricsLogPath}; pricing reports will be incomplete`, {
      category: 'pricing',
      metadata: { metricsLogPath }, error: error
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

  const childArgs = injectGlobalCliFlags(baseChildArgs, outputRoot, opts?.binDir?.trim())
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

export { pathExists as fileExists }

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
    if (hasErrorCode(error, 'ENOENT')) {
      return null
    }
    throw error
  }
}

export const cleanupOutputDir = async (dir: string | null | undefined): Promise<void> => {
  if (!dir || shouldPreserveArtifacts()) {
    return
  }
  await rm(dir, { recursive: true, force: true }).catch(() => {})
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

export { isRecord }

export const toRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.filter(isRecord)
  }
  return isRecord(value) ? [value] : []
}
