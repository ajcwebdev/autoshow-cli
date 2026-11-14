import { requireRenderingPrerequisites } from './rendering-readiness'
import { readdir } from 'node:fs/promises'
import { statPath as stat } from '~/utils/bun-file-io'
import type { DirectoryEntry } from '~/types'
import { join } from 'node:path'
import { setupTesseractOcr } from '~/cli/commands/text/ocr/ocr-local/tesseract-setup'
import { setupWhisperfile } from '~/cli/commands/stt/local/whisperfile/whisperfile'
import { DEFAULT_WHISPERFILE_MODEL } from '~/cli/commands/setup-and-utilities/models/stt-models'
import { defuddleRuntimeDir, setupDefuddleCli } from '~/cli/commands/text/url/url-local/defuddle/defuddle-cli'
import { setupYtDependencies } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-audio/audio'
import { setupCalibreDocumentTools } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-document/calibre'
import { formatSetupElapsed, runWithSetupHeartbeat } from '~/cli/commands/setup-and-utilities/setup/setup-heartbeat'
import type { ConcurrentSetupTask, HostedProviderConfigurationSummary, RunOptions, RunResult, SetupLifecycleOperations, SetupPlatform, SetupRunOptions, SetupStepId } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { isJsonResultActive, isLogLevelEnabled } from '~/utils/app-logger/app-logger'
import { isCompactSetupMode, setCompactSetupMode } from '~/utils/setup-output-mode'
import { extractErrorHints, InfraError, InternalError, serializeDiagnosticError } from '~/utils/error-handler'
import {
  RUNTIME_BIN_DIR,
  RUNTIME_DIR,
  RUNTIME_TOOLS_DIR,
  calibreToolDir,
  ebookConvertManagedBinaryPath,
  ffmpegBuildDir,
  ffmpegManagedBinaryPath,
  ffmpegToolDir,
  ffprobeManagedBinaryPath,
  hasRuntimeTool,
  lameBuildDir,
  lameToolDir,
  mupdfBuildDir,
  mupdfToolDir,
  mutoolManagedBinaryPath,
  qpdfBuildDir,
  qpdfManagedBinaryPath,
  qpdfToolDir,
  tesseractBuildDir,
  tesseractManagedBinaryPath,
  tessdataDir,
  ytDlpManagedBinaryPath
} from '~/utils/runtime-paths'
import { listPinnedDependencies } from './dependency-metadata'
import { getHostedProviderEnvKeysForConfigPrefix, HOSTED_PROVIDER_ENV_CHECKS, logHostedProviderConfiguration, setupProviderSummaryEnvironment } from './hosted-provider-config'
import { beginSetupPerformanceRun, finishSetupPerformanceRun } from './setup-performance'
import { pathExists } from '~/utils/filesystem'
import { childEnv } from '~/utils/child-env'
import { readBoundedTextStream } from '~/utils/bounded-capture'
import { ensureManagedBuildTools } from './setup-download/managed-build-tools'
import { ensureManagedRenderingDependencies } from './setup-download/managed-native-dependencies'
import { ensureManagedAlignmentRuntime, ensureManagedBunRuntime, ensureManagedDenoRuntime } from './setup-download/managed-js-runtime'
import { ensureRuntimeDirectory, ensureRuntimeStateDirectories } from '~/utils/runtime-state'
import { ensureManagedLinuxRendering, ensureManagedLinuxToolchain } from './setup-download/managed-linux-tools'
import { migrateLegacyRuntimeState } from '~/utils/runtime-state-migration'
import { ensureProjectRuntimeDependencies } from '~/tools/project-runtime-dependencies'

const RUNTIME = RUNTIME_DIR

export const whisperfileDir = join(RUNTIME, 'bin/whisperfile')
export const whisperfileBinaryPath = (model: string): string => join(whisperfileDir, `whisper-${model}.llamafile`)
const readStream = async (stream: ReadableStream<Uint8Array> | null): Promise<string> => {
  const capture = await readBoundedTextStream(stream)
  return capture.truncated ? `[setup output truncated; ${capture.omittedBytes} bytes omitted]\n${capture.text}` : capture.text
}

const fmtCmd = (command: string, args: string[]): string => [command, ...args].join(' ').trim()
const SETUP_OUTPUT_TAIL_LINES = 40
const SETUP_OUTPUT_TAIL_CHARS = 6000

const formatSetupOutputTail = (stdout: string, stderr: string): string => {
  const combined = [
    stderr.trim().length > 0 ? `stderr:\n${stderr.trim()}` : '',
    stdout.trim().length > 0 ? `stdout:\n${stdout.trim()}` : ''
  ].filter(Boolean).join('\n\n')

  if (combined.trim().length === 0) {
    return ''
  }

  const lines = combined.split('\n')
  const lineTail = lines.slice(-SETUP_OUTPUT_TAIL_LINES).join('\n')
  return lineTail.length > SETUP_OUTPUT_TAIL_CHARS
    ? lineTail.slice(lineTail.length - SETUP_OUTPUT_TAIL_CHARS)
    : lineTail
}

const formatCommandFailure = (command: string, args: string[], result: RunResult): string => {
  const tail = formatSetupOutputTail(result.stdout, result.stderr)
  return tail.length > 0
    ? `Command failed (${fmtCmd(command, args)}): exit code ${result.exitCode}\n${tail}`
    : `Command failed (${fmtCmd(command, args)}): exit code ${result.exitCode}`
}

const shouldUseCompactSetup = (): boolean => isCompactSetupMode()

const shouldUseVerboseHumanOutput = (): boolean =>
  isLogLevelEnabled('debug') && !isJsonResultActive()

const shouldStreamCompactSetupOutput = (): boolean =>
  shouldUseCompactSetup()
  && shouldUseVerboseHumanOutput()

const formatTaskFailureReason = (reason: unknown): string =>
  reason instanceof Error ? reason.message : String(reason)

const setupStepTimings: { label: string, durationMs: number, ok: boolean }[] = []

const getSetupStepTimings = (): readonly { label: string, durationMs: number, ok: boolean }[] =>
  setupStepTimings

const runSettledSetupTasks = async (tasks: readonly ConcurrentSetupTask[]): Promise<void> => {
  const results = await Promise.allSettled(tasks.map(async (task) => await task.run()))
  const failures = results.flatMap((result, index) => {
    if (result.status === 'fulfilled') return []
    return [{
      label: tasks[index]?.label ?? `task ${index + 1}`,
      reason: result.reason as unknown
    }]
  })

  if (failures.length === 0) return

  throw InfraError(
    [
      'Setup tasks failed:',
      ...failures.map(({ label, reason }) => `- ${label}: ${formatTaskFailureReason(reason)}`)
    ].join('\n'),
    {
      stage: 'setup:tasks',
      retryable: false,
      hints: failures.flatMap(({ reason }) => extractErrorHints(reason)),
      cause: new AggregateError(failures.map(({ reason }) => reason), 'Setup tasks failed'),
      metadata: {
        failures: failures.map(({ label, reason }) => ({
          label,
          error: serializeDiagnosticError(reason)
        }))
      }
    }
  )
}

export const runConcurrentSetupTasks = async (tasks: readonly ConcurrentSetupTask[]): Promise<void> => {
  await runSettledSetupTasks(tasks.map((task) => ({
    label: task.label,
    run: async () => {
      const startedAt = Date.now()
      return await runWithSetupHeartbeat(task.label, startedAt, async () => {
        try {
          const value = await task.run()
          setupStepTimings.push({ label: task.label, durationMs: Date.now() - startedAt, ok: true })
          return value
        } catch (error) {
          setupStepTimings.push({ label: task.label, durationMs: Date.now() - startedAt, ok: false })
          throw error
        }
      })
    }
  })))
}

export const runCapture = async (command: string, args: string[] = [], options: RunOptions = {}): Promise<RunResult> => {
  const proc = Bun.spawn([command, ...args], {
    ...(options.cwd ? { cwd: options.cwd } : {}),
    env: childEnv({ set: options.env }),
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    readStream(proc.stdout), readStream(proc.stderr), proc.exited
  ])
  const result: RunResult = { stdout, stderr, exitCode }
  if (exitCode !== 0 && !options.allowFailure) {
    throw InfraError(formatCommandFailure(command, args, result), { stage: 'setup:run' })
  }
  return result
}

export const runInherit = async (command: string, args: string[] = [], options: RunOptions = {}): Promise<number> => {
  if (shouldUseCompactSetup() && !shouldStreamCompactSetupOutput()) {
    const result = await runCapture(command, args, { ...options, allowFailure: true })
    if (result.exitCode !== 0 && !options.allowFailure) {
      throw InfraError(formatCommandFailure(command, args, result), { stage: 'setup:run' })
    }
    return result.exitCode
  }

  const proc = Bun.spawn([command, ...args], {
    ...(options.cwd ? { cwd: options.cwd } : {}),
    env: childEnv({ set: options.env }),
    stdin: 'inherit', stdout: 'inherit', stderr: 'inherit'
  })
  const exitCode = await proc.exited
  if (exitCode !== 0 && !options.allowFailure) {
    throw InfraError(`Command failed (${fmtCmd(command, args)}): exit code ${exitCode}`, { stage: 'setup:run' })
  }
  return exitCode
}

export const commandExists = (command: string): boolean => {
  const resolved = Bun.which(command)
  return typeof resolved === 'string' && resolved.length > 0
}

export const detectPlatform = (): SetupPlatform => {
  if (process.platform === 'darwin') return 'darwin'
  if (process.platform === 'linux') return 'linux'
  return 'unknown'
}

const defaultMusicWhisperfileModel = 'small.en'

const withCompactSetup = async (fn: () => Promise<void>): Promise<void> => {
  const previous = isCompactSetupMode()
  setCompactSetupMode(true)
  try { await fn() } finally {
    setCompactSetupMode(previous)
  }
}

const ensureRuntimeDirs = async (): Promise<void> => {
  await Promise.all([
    ensureRuntimeDirectory(RUNTIME_BIN_DIR),
    ensureRuntimeDirectory(RUNTIME_TOOLS_DIR),
    ensureRuntimeDirectory(whisperfileDir)
  ])
}

const logPinnedVersions = async (): Promise<void> => {
  const formatVersion = (value: string): string =>
    /^[a-f0-9]{40}$/i.test(value) ? value.slice(0, 12) : value
  const pinned = await listPinnedDependencies()
  l.write('info', `Using ${pinned.length} pinned dependency versions`, {
    category: 'command',
    metadata: { dependencies: pinned.map(({ name, version }) => ({ name, version: formatVersion(version) })) }
  })
}

const TRANSCRIPTION_PROVIDER_ENV_KEYS = getHostedProviderEnvKeysForConfigPrefix('defaults.extract.stt.')

const MUSIC_PROVIDER_ENV_KEYS = getHostedProviderEnvKeysForConfigPrefix('defaults.music.')

const ALL_PROVIDER_ENV_KEYS = HOSTED_PROVIDER_ENV_CHECKS.map(check => check.envVar)

const logSetupProviderConfiguration = (
  title: string,
  envVars: readonly string[] = ALL_PROVIDER_ENV_KEYS
): HostedProviderConfigurationSummary =>
  logHostedProviderConfiguration({
    env: setupProviderSummaryEnvironment(process.env),
    title,
    envVars,
    mode: shouldUseVerboseHumanOutput() ? 'all' : 'missing'
  })

const walkDirectorySize = async (root: string): Promise<number> => {
  let total = 0
  const walk = async (dir: string): Promise<void> => {
    let entries: DirectoryEntry[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name === '.DS_Store') continue
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(path)
      } else if (entry.isFile()) {
        try {
          total += (await stat(path)).size
        } catch {
        }
      }
    }
  }
  await walk(root)
  return total
}

const directorySize = async (root: string): Promise<number> => await walkDirectorySize(root)

const logSetupStepTimings = (): void => {
  const timings = [...getSetupStepTimings()].sort((a, b) => b.durationMs - a.durationMs)
  if (timings.length === 0) return

  l.write('info', `Setup timings recorded for ${timings.length} concurrent steps`, {
    category: 'command',
    metadata: { timings }
  })
}

const logDetailedSetupPerformance = (
  result: Awaited<ReturnType<typeof finishSetupPerformanceRun>>
): void => {
  if (!result || !shouldUseVerboseHumanOutput()) return
  const rows = result.artifact.phases.map((phase) => ({
    component: phase.component,
    phase: phase.phase,
    durationMs: phase.durationMs,
    startedOffsetMs: phase.startedOffsetMs,
    status: phase.ok ? 'ok' : 'failed'
  }))
  l.write('debug', `Setup build phase timings: ${rows.length} phases`, {
    category: 'command',
    metadata: {
      artifactPath: result.artifactPath,
      topology: result.artifact.topology,
      compileOverlaps: result.artifact.compileOverlaps,
      phases: result.artifact.phases
    }
  })
}

const logSetupSummary = async (
  startedAtMs: number,
  providerSummary: HostedProviderConfigurationSummary
): Promise<boolean> => {
  const localToolChecks = [
    ['ffmpeg', hasRuntimeTool('ffmpeg')] as const,
    ['ffprobe', hasRuntimeTool('ffprobe')] as const,
    ['yt-dlp', hasRuntimeTool('yt-dlp')] as const,
    ['mutool', hasRuntimeTool('mutool')] as const,
    ['ebook-convert', hasRuntimeTool('ebook-convert')] as const,
    ['tesseract', hasRuntimeTool('tesseract')] as const,
    ['qpdf', hasRuntimeTool('qpdf')] as const
  ]
  const localModelChecks = [
    [`whisperfile ${DEFAULT_WHISPERFILE_MODEL}`, await pathExists(whisperfileBinaryPath(DEFAULT_WHISPERFILE_MODEL))] as const
  ]
  const missingTools = localToolChecks.filter(([, ok]) => !ok).map(([name]) => name)
  const missingModels = localModelChecks.filter(([, ok]) => !ok).map(([name]) => name)
  const runtimeBytes = await directorySize(RUNTIME_DIR)
  const healthy = missingTools.length === 0 && missingModels.length === 0

  l.write(healthy ? 'info' : 'warn', `Setup ${healthy ? 'ready' : 'incomplete'} in ${formatSetupElapsed(Date.now() - startedAtMs)}; ${providerSummary.configured}/${providerSummary.total} hosted providers configured`, {
    category: 'command',
    metadata: { elapsedMs: Date.now() - startedAtMs, runtimeBytes, runtimeDir: RUNTIME_DIR, missingTools, missingModels, hostedProviders: providerSummary, next: 'bun autoshow setup --doctor' }
  })

  return healthy
}

const runSetupToolchain = async (options: SetupRunOptions): Promise<void> => {
  if (!Bun.isStandaloneExecutable) await ensureProjectRuntimeDependencies()
  await runConcurrentSetupTasks([
    { label: 'managed build tools', run: async () => {
      if (detectPlatform() === 'linux') await ensureManagedLinuxToolchain(options)
      else await ensureManagedBuildTools(options)
    } },
    { label: 'managed Bun', run: async () => { await ensureManagedBunRuntime(options) } },
    { label: 'managed downloader runtime', run: async () => { await ensureManagedDenoRuntime(options) } }
  ])
}

const setupManagedRendering = async (options: SetupRunOptions): Promise<void> => {
  if (detectPlatform() === 'linux') await ensureManagedLinuxRendering(options)
  else await ensureManagedRenderingDependencies(options)
}

const runFullSetup = async (options: SetupRunOptions = {}, overrides: Partial<SetupLifecycleOperations> = {}): Promise<boolean> => {
  const operations: SetupLifecycleOperations = {
    toolchain: runSetupToolchain, media: setupYtDependencies, documents: setupCalibreDocumentTools,
    ocr: setupTesseractOcr, rendering: setupManagedRendering, defuddle: setupDefuddleCli,
    alignment: ensureManagedAlignmentRuntime, whisperfile: setupWhisperfile,
    migrateState: async () => { await migrateLegacyRuntimeState() },
    verifyRendering: requireRenderingPrerequisites, summarize: logSetupSummary,
    ...overrides
  }
  const startedAtMs = Date.now()
  setupStepTimings.length = 0
  const dependencyVersions = Object.fromEntries(
    (await listPinnedDependencies()).map(({ name, version }) => [name, version])
  )
  beginSetupPerformanceRun({
    topology: 'managed-dependency-graph-v2',
    dependencyVersions
  })
  let healthy = false

  try {
    l.write('info', 'Starting complete AutoShow setup', { category: 'command' })
    await logPinnedVersions()
    await ensureRuntimeDirs()
    await ensureRuntimeStateDirectories()
    await operations.migrateState()

    const providerSummary = logSetupProviderConfiguration('Hosted Provider Configuration')

    await withCompactSetup(async () => {
      await operations.toolchain(options)
      await runConcurrentSetupTasks([
        { label: 'media tools', run: async () => { await operations.media(options) } },
        { label: 'Defuddle', run: async () => { await operations.defuddle(options) } },
        {
          label: 'Whisperfile',
          run: async () => {
            await operations.whisperfile(DEFAULT_WHISPERFILE_MODEL, options)
          }
        },
        { label: 'document tools', run: async () => { await operations.documents(options) } },
        { label: 'OCR', run: async () => { await operations.ocr(options) } },
        { label: 'rendering dependencies', run: async () => { await operations.rendering(options) } },
        { label: 'alignment runtime', run: async () => { await operations.alignment(options) } }
      ])
    })

    await operations.verifyRendering()
    logSetupStepTimings()
    healthy = await operations.summarize(startedAtMs, providerSummary)

    l.write('info', 'You can now run: bun autoshow extract "https://www.youtube.com/watch?v=u1-WHqATSQU"', { category: 'command' })
    return healthy
  } finally {
    try {
      const performanceResult = await finishSetupPerformanceRun({
        healthy,
        stepTimings: getSetupStepTimings()
      })
      logDetailedSetupPerformance(performanceResult)
    } catch (error) {
      l.warn(`Could not write setup performance artifact: ${error instanceof Error ? error.message : String(error)}`, {
      category: 'artifact',
      error: error
    })
    }
  }
}

export const runCompleteSetup = async (options: SetupRunOptions = {}, operations: Partial<SetupLifecycleOperations> = {}): Promise<boolean> => await runFullSetup(options, operations)

const runSetupTranscription = async (options: SetupRunOptions): Promise<void> => {
  await setupYtDependencies(options)
  await setupWhisperfile(DEFAULT_WHISPERFILE_MODEL, options)
  logSetupProviderConfiguration('Transcription Provider Configuration', TRANSCRIPTION_PROVIDER_ENV_KEYS)
  l.write('info', 'Transcription setup complete', { category: 'command' })
}

const runSetupRendering = async (options: SetupRunOptions): Promise<void> => {
  await setupYtDependencies(options)
  await setupManagedRendering(options)
  await requireRenderingPrerequisites()
}

const runSetupMusic = async (options: SetupRunOptions): Promise<void> => {
  logSetupProviderConfiguration('Music Provider Configuration', MUSIC_PROVIDER_ENV_KEYS)
  await runSetupRendering(options)
  await setupWhisperfile(defaultMusicWhisperfileModel, options)
  l.write('info', 'Music setup complete', { category: 'command' })
}

export const getForceRedownloadPaths = async (step: SetupStepId): Promise<readonly string[]> => {
  switch (step) {
    case 'transcription':
    case 'whisperfile': return [whisperfileBinaryPath(DEFAULT_WHISPERFILE_MODEL)]
    case 'defuddle': return [defuddleRuntimeDir]
    case 'music': return [whisperfileBinaryPath(defaultMusicWhisperfileModel)]
    case 'toolchain': return [join(RUNTIME_TOOLS_DIR, 'build-tools'), join(RUNTIME_TOOLS_DIR, 'bun'), join(RUNTIME_TOOLS_DIR, 'deno')]
    case 'ocr': return [tesseractManagedBinaryPath, tesseractBuildDir, tessdataDir, join(RUNTIME_TOOLS_DIR, 'tesseract')]
    case 'rendering': return [ffmpegManagedBinaryPath, ffprobeManagedBinaryPath, ffmpegToolDir, join(RUNTIME_TOOLS_DIR, 'native')]
    case 'alignment': return [join(RUNTIME_TOOLS_DIR, 'stt-alignment')]
    case 'all': return [
      whisperfileBinaryPath(DEFAULT_WHISPERFILE_MODEL),
      defuddleRuntimeDir,
      ytDlpManagedBinaryPath,
      ffmpegManagedBinaryPath,
      ffprobeManagedBinaryPath,
      ffmpegBuildDir,
      lameBuildDir,
      mutoolManagedBinaryPath,
      ebookConvertManagedBinaryPath,
      tesseractManagedBinaryPath,
      tesseractBuildDir,
      tessdataDir,
      qpdfManagedBinaryPath,
      qpdfBuildDir,
      qpdfToolDir,
      RUNTIME_TOOLS_DIR
    ]
    case 'yt-dlp': return [ytDlpManagedBinaryPath, ffmpegManagedBinaryPath, ffprobeManagedBinaryPath, ffmpegBuildDir, ffmpegToolDir, lameBuildDir, lameToolDir]
    case 'calibre': return [mutoolManagedBinaryPath, mupdfBuildDir, mupdfToolDir, qpdfManagedBinaryPath, qpdfBuildDir, qpdfToolDir, ebookConvertManagedBinaryPath, calibreToolDir]
    default: { const exhaustive: never = step; throw InternalError(`Unknown setup step: ${exhaustive}`, { stage: 'setup:run' }) }
  }
}

const executeStepOnce = async (step: SetupStepId, options: SetupRunOptions): Promise<boolean> => {
  switch (step) {
    case 'all': return await runCompleteSetup(options)
    case 'toolchain': return true
    case 'yt-dlp': await setupYtDependencies(options); return true
    case 'whisperfile': await setupWhisperfile(DEFAULT_WHISPERFILE_MODEL, options); return true
    case 'defuddle': await setupDefuddleCli(options); return true
    case 'calibre': await setupCalibreDocumentTools(options); return true
    case 'ocr': await setupTesseractOcr(options); return true
    case 'rendering': await runSetupRendering(options); return true
    case 'alignment': await ensureManagedAlignmentRuntime(options); return true
    case 'transcription': await runSetupTranscription(options); return true
    case 'music': await runSetupMusic(options); return true
    default: { const exhaustive: never = step; throw InternalError(`Unknown setup step: ${exhaustive}`, { stage: 'setup:run' }) }
  }
}

export const runSetupStep = async (step: SetupStepId, options: SetupRunOptions = {}): Promise<boolean> => {
  if (step === 'all') return await runCompleteSetup(options)
  await ensureRuntimeDirs()
  await ensureRuntimeStateDirectories()
  await migrateLegacyRuntimeState()
  await runSetupToolchain(options)
  return await executeStepOnce(step, options)
}
