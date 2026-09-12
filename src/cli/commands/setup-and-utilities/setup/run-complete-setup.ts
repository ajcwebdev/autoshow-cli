import { requireRenderingPrerequisites } from './rendering-readiness'
import { mkdir, readdir, rm } from 'node:fs/promises'
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
import type { ConcurrentSetupTask, HostedProviderConfigurationSummary, RunOptions, RunResult, SetupPlatform, SetupStepId } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { isJsonResultActive, isLogLevelEnabled } from '~/utils/app-logger/app-logger'
import { isCompactSetupMode, setCompactSetupMode } from '~/utils/setup-output-mode'
import { extractErrorHints, InfraError, InternalError, serializeDiagnosticError } from '~/utils/error-handler'
import {
  RUNTIME_BIN_DIR,
  RUNTIME_BUILD_DIR,
  RUNTIME_DIR,
  RUNTIME_TOOLS_DIR,
  calibreToolDir,
  ebookConvertManagedBinaryPath,
  ffmpegBuildDir,
  ffmpegManagedBinaryPath,
  ffmpegToolDir,
  ffprobeManagedBinaryPath,
  getFfmpegBinary,
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
import { getHostedProviderEnvKeysForConfigPrefix, HOSTED_PROVIDER_ENV_CHECKS, logHostedProviderConfiguration } from './hosted-provider-config'
import { beginSetupPerformanceRun, finishSetupPerformanceRun } from './setup-performance'
import { pathExists } from '~/utils/filesystem'
import { childEnv } from '~/utils/child-env'

const RUNTIME = RUNTIME_DIR

export const whisperfileDir = join(RUNTIME, 'bin/whisperfile')
export const whisperfileBinaryPath = (model: string): string => join(whisperfileDir, `whisper-${model}.llamafile`)
const readStream = async (stream: ReadableStream<Uint8Array> | null | undefined): Promise<string> =>
  stream ? await new Response(stream).text() : ''

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
    mkdir(RUNTIME_BIN_DIR, { recursive: true }),
    mkdir(RUNTIME_TOOLS_DIR, { recursive: true }),
    mkdir(whisperfileDir, { recursive: true })
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
    title,
    envVars,
    mode: shouldUseVerboseHumanOutput() ? 'all' : 'missing'
  })

const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GiB`
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MiB`
  return `${bytes} B`
}

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

const RECLAIMED_BUILD_TREE_MIN_BYTES = 10 * 1024 * 1024

export const shouldReportReclaimedBuildTrees = (bytes: number): boolean =>
  bytes >= RECLAIMED_BUILD_TREE_MIN_BYTES

const pruneBuildTrees = async (): Promise<void> => {
  const before = await directorySize(RUNTIME_BUILD_DIR)

  await rm(RUNTIME_BUILD_DIR, { recursive: true, force: true })
  await mkdir(RUNTIME_BUILD_DIR, { recursive: true })

  if (!shouldReportReclaimedBuildTrees(before)) return

  l.write('info', `Reclaimed ${formatBytes(before)} from setup build trees`, {
    category: 'artifact',
    metadata: { path: RUNTIME_BUILD_DIR, reclaimedBytes: before }
  })
}

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

const runFullSetup = async (): Promise<boolean> => {
  const startedAtMs = Date.now()
  setupStepTimings.length = 0
  const dependencyVersions = Object.fromEntries(
    (await listPinnedDependencies()).map(({ name, version }) => [name, version])
  )
  beginSetupPerformanceRun({
    topology: 'ungated-source-builds-v1',
    dependencyVersions
  })
  let healthy = false

  try {
    l.write('info', 'Starting complete AutoShow setup', { category: 'command' })
    await logPinnedVersions()
    await ensureRuntimeDirs()

    const providerSummary = logSetupProviderConfiguration('Hosted Provider Configuration')

    await withCompactSetup(async () => {
      await runConcurrentSetupTasks([
        { label: 'media tools', run: setupYtDependencies },
        { label: 'Defuddle', run: setupDefuddleCli },
        {
          label: 'Whisperfile',
          run: async () => {
            await setupWhisperfile(DEFAULT_WHISPERFILE_MODEL)
          }
        },
        { label: 'document tools', run: setupCalibreDocumentTools },
        { label: 'OCR', run: setupTesseractOcr }
      ])
    })

    await requireRenderingPrerequisites()
    await pruneBuildTrees()
    logSetupStepTimings()
    healthy = await logSetupSummary(startedAtMs, providerSummary)

    l.write('info', 'You can now run: bun autoshow "https://www.youtube.com/watch?v=u1-WHqATSQU"', { category: 'command' })
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

export const runCompleteSetup = async (): Promise<boolean> => await runFullSetup()

const runSetupTranscription = async (): Promise<void> => {
  await setupWhisperfile(DEFAULT_WHISPERFILE_MODEL)
  logSetupProviderConfiguration('Transcription Provider Configuration', TRANSCRIPTION_PROVIDER_ENV_KEYS)
  l.write('info', 'Transcription setup complete', { category: 'command' })
}

const runSetupMusic = async (): Promise<void> => {
  logSetupProviderConfiguration('Music Provider Configuration', MUSIC_PROVIDER_ENV_KEYS)
  const requiredTools = ['ffmpeg', 'ffprobe'] as const
  const missing = requiredTools.filter((tool) => !hasRuntimeTool(tool))
  if (missing.length > 0) {
    throw InfraError(
      `Music lyric-video setup: missing required tools: ${missing.join(', ')}. Install them via your system package manager or run: bun autoshow setup`,
      {
        stage: 'setup:music',
        hints: ["Run 'bun autoshow setup' to install yt-dlp and other dependencies"]
      }
    )
  }

  const ffmpegFilters = await runCapture(getFfmpegBinary(), ['-hide_banner', '-filters'], { allowFailure: true })
  const hasAssFilter = ffmpegFilters.exitCode === 0
    && ffmpegFilters.stdout.split('\n').some((line) => line.trim().split(/\s+/).includes('ass'))
  const hasFallbackRenderer = commandExists('pango-view') && (commandExists('magick') || commandExists('convert'))
  if (!hasAssFilter && !hasFallbackRenderer) {
    throw InfraError(
      'Music lyric-video setup: ffmpeg does not expose the ass filter, and the fallback renderer is unavailable. Install pango-view plus ImageMagick, or use an ffmpeg build with ass support.',
      { stage: 'setup:music' }
    )
  }

  await setupWhisperfile(defaultMusicWhisperfileModel)
  l.write('info', 'Music setup complete', { category: 'command' })
}

export const getForceRedownloadPaths = async (step: SetupStepId): Promise<readonly string[]> => {
  switch (step) {
    case 'transcription':
    case 'whisperfile': return [whisperfileBinaryPath(DEFAULT_WHISPERFILE_MODEL)]
    case 'defuddle': return [defuddleRuntimeDir]
    case 'music': return [whisperfileBinaryPath(defaultMusicWhisperfileModel)]
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

const applyRunOptions = async (step: SetupStepId, options?: { forceRedownload?: boolean }): Promise<void> => {
  if (!options?.forceRedownload) return
  const paths = await getForceRedownloadPaths(step)
  if (paths.length === 0) return
  await Promise.all(paths.map(p => rm(p, { recursive: true, force: true })))
  l.write('info', `Cleared ${paths.length} artifacts for forced ${step} redownload`, {
    category: 'artifact',
    metadata: { step, clearedArtifacts: paths.length, paths }
  })
}

const executeStepOnce = async (step: SetupStepId): Promise<boolean> => {
  switch (step) {
    case 'all': return await runCompleteSetup()
    case 'yt-dlp': await setupYtDependencies(); return true
    case 'whisperfile': await setupWhisperfile(DEFAULT_WHISPERFILE_MODEL); return true
    case 'defuddle': await setupDefuddleCli(); return true
    case 'calibre': await setupCalibreDocumentTools(); return true
    case 'transcription': await runSetupTranscription(); return true
    case 'music': await runSetupMusic(); return true
    default: { const exhaustive: never = step; throw InternalError(`Unknown setup step: ${exhaustive}`, { stage: 'setup:run' }) }
  }
}

export const runSetupStep = async (step: SetupStepId, options?: { forceRedownload?: boolean }): Promise<boolean> => {
  await ensureRuntimeDirs()
  await applyRunOptions(step, options)
  return await executeStepOnce(step)
}
