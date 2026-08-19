import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { join } from 'node:path'
import { setupTesseractOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-local/tesseract-setup'
import { downloadWhisperModel, setupWhisper } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisper/whisper'
import { setupWhisperfile } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisperfile/whisperfile'
import { DEFAULT_WHISPERFILE_MODEL } from '~/cli/commands/setup-and-utilities/models/stt-models'
import { defuddleRuntimeDir, setupDefuddleCli } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-local/defuddle/defuddle-cli'
import { setupYtDependencies } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-audio/audio'
import { setupCalibreDocumentTools } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-document/calibre'
import { logSetupToolStatus } from '~/cli/commands/setup-and-utilities/setup/setup-logging'
import { formatSetupElapsed, runWithSetupHeartbeat } from '~/cli/commands/setup-and-utilities/setup/setup-heartbeat'
import type { ConcurrentSetupTask, HostedProviderConfigurationSummary, RunOptions, RunResult, SetupPlatform, SetupStepId } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { l as globalLogger, isJsonResultActive } from '~/utils/app-logger/app-logger'
import { createHumanTable, logKeyValueTable, logSingleRowTable } from '~/utils/app-logger/human-table/human-table'
import { isCompactSetupMode, setCompactSetupMode } from '~/utils/setup-output-mode'
import { InfraError, InternalError } from '~/utils/error-handler'
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

const RUNTIME = RUNTIME_DIR

export const whisperBinaryPath = join(RUNTIME, 'bin/whisper-cli')
export const whisperLibDir = join(RUNTIME, 'bin/lib')
export const whisperBuildDir = join(RUNTIME, 'build/whisper.cpp')
export const whisperModelsDir = join(RUNTIME, 'models/whisper')
export const whisperfileDir = join(RUNTIME, 'bin/whisperfile')
export const whisperfileBinaryPath = (model: string): string => join(whisperfileDir, `whisper-${model}.llamafile`)
const mergeEnv = (env?: Record<string, string | undefined>): Record<string, string | undefined> =>
  env ? { ...(process.env as Record<string, string | undefined>), ...env } : process.env as Record<string, string | undefined>

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
  globalLogger.config.minLevel === 'debug' && !isJsonResultActive()

const shouldStreamCompactSetupOutput = (): boolean =>
  shouldUseCompactSetup()
  && shouldUseVerboseHumanOutput()

const formatTaskFailureReason = (reason: unknown): string =>
  reason instanceof Error ? reason.message : String(reason)

// Each concurrent task announces its start and its finish but nothing in
// between, so a source build that takes minutes is indistinguishable from a
// hang. Recording per-task durations at least makes the cost visible afterwards.
const setupStepTimings: { label: string, durationMs: number, ok: boolean }[] = []

export const getSetupStepTimings = (): readonly { label: string, durationMs: number, ok: boolean }[] =>
  setupStepTimings

// Runs tasks concurrently and aggregates every failure instead of surfacing only
// the first. Shared with nested groups that must not record their own timings.
export const runSettledSetupTasks = async (tasks: readonly ConcurrentSetupTask[]): Promise<void> => {
  const results = await Promise.allSettled(tasks.map(async (task) => await task.run()))
  const failures = results.flatMap((result, index) => {
    if (result.status === 'fulfilled') return []
    return [{
      label: tasks[index]?.label ?? `task ${index + 1}`,
      reason: result.reason as unknown
    }]
  })

  if (failures.length === 0) return

  throw new AggregateError(
    failures.map(({ reason }) => reason),
    [
      'Setup tasks failed:',
      ...failures.map(({ label, reason }) => `- ${label}: ${formatTaskFailureReason(reason)}`)
    ].join('\n')
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
    env: mergeEnv(options.env),
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
    env: mergeEnv(options.env),
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

export const pathExists = async (path: string): Promise<boolean> => {
  try { await stat(path); return true } catch { return false }
}

export const detectPlatform = (): SetupPlatform => {
  if (process.platform === 'darwin') return 'darwin'
  if (process.platform === 'linux') return 'linux'
  return 'unknown'
}

export const detectArchitecture = (): string => {
  if (process.arch === 'x64') return 'x86_64'
  if (process.arch === 'arm64') return 'arm64'
  return process.arch
}

export const defaultWhisperModel = 'tiny'
export const defaultMusicWhisperModel = 'large-v3-turbo'

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
    mkdir(whisperBuildDir, { recursive: true }),
    mkdir(whisperModelsDir, { recursive: true }),
    mkdir(whisperfileDir, { recursive: true })
  ])
}

// Iterates the pinned set rather than restating a subset of it, so a dependency
// that is pinned and built (leptonica, lame, tessdata) cannot be built silently.
const logPinnedVersions = async (): Promise<void> => {
  const formatVersion = (value: string): string =>
    /^[a-f0-9]{40}$/i.test(value) ? value.slice(0, 12) : value
  const pinned = await listPinnedDependencies()
  logKeyValueTable(
    l,
    'Pinned Versions',
    pinned.map(({ name, version }) => [name, formatVersion(version)] as [string, string]),
    { category: 'command', keyLabel: 'dependency', valueLabel: 'version' }
  )
}

const validateBinary = async (name: string, path: string, args: string[]): Promise<void> => {
  if (!await pathExists(path)) { l.warn(`${name}: not found at ${path}`); return }
  try {
    const result = await runCapture(path, args, { allowFailure: true })
    if (result.exitCode === 0 || result.exitCode === 1) {
      logSetupToolStatus(l, { tool: name, status: 'ready', detail: path })
    } else l.warn(`${name}: installed but exited ${result.exitCode} (may still work)`)
  } catch (err) {
    l.warn(`${name}: could not execute — ${err instanceof Error ? err.message : String(err)}`)
  }
}

const TRANSCRIPTION_PROVIDER_ENV_KEYS = getHostedProviderEnvKeysForConfigPrefix('defaults.extract.stt.')

const WRITE_PROVIDER_ENV_KEYS = getHostedProviderEnvKeysForConfigPrefix('defaults.llm.')

const TTS_PROVIDER_ENV_KEYS = getHostedProviderEnvKeysForConfigPrefix('defaults.post.tts.')

const IMAGE_PROVIDER_ENV_KEYS = getHostedProviderEnvKeysForConfigPrefix('defaults.post.image.')

const VIDEO_PROVIDER_ENV_KEYS = getHostedProviderEnvKeysForConfigPrefix('defaults.post.video.')

const MUSIC_PROVIDER_ENV_KEYS = getHostedProviderEnvKeysForConfigPrefix('defaults.post.music.')

const ALL_PROVIDER_ENV_KEYS = HOSTED_PROVIDER_ENV_CHECKS.map(check => check.envVar)

const logSetupProviderConfiguration = (
  title: string,
  envVars: readonly string[] = ALL_PROVIDER_ENV_KEYS
): HostedProviderConfigurationSummary =>
  logHostedProviderConfiguration(l, {
    title,
    envVars,
    mode: shouldUseVerboseHumanOutput() ? 'all' : 'missing'
  })

// Binary units so the reported figure matches what `du -h` prints for the same
// directory; a decimal figure next to a du-shaped path invites a false mismatch.
const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GiB`
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MiB`
  return `${bytes} B`
}

const walkDirectorySize = async (root: string): Promise<number> => {
  let total = 0
  const walk = async (dir: string): Promise<void> => {
    let entries: Dirent[]
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
          // Raced with cleanup; a missing file contributes nothing.
        }
      }
    }
  }
  await walk(root)
  return total
}

const directorySize = async (root: string): Promise<number> => await walkDirectorySize(root)

type ReclaimableWhisperCoremlArtifact = {
  path: string
  bytes: number
}

export const collectReclaimableWhisperCoremlArtifacts = async (options: {
  coremlEnvDir?: string
  modelsDir?: string
} = {}): Promise<ReclaimableWhisperCoremlArtifact[]> => {
  const coremlEnvDir = options.coremlEnvDir ?? join(RUNTIME_BIN_DIR, 'whisper-coreml-env')
  const modelsDir = options.modelsDir ?? whisperModelsDir
  const paths: string[] = []

  if (await pathExists(coremlEnvDir)) paths.push(coremlEnvDir)

  try {
    const encoderPackages = (await readdir(modelsDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && (entry.name.endsWith('.mlmodelc') || entry.name.endsWith('.mlpackage')))
      .map((entry) => join(modelsDir, entry.name))
      .sort()
    paths.push(...encoderPackages)
  } catch {
    // A fresh install has no Whisper model directory yet.
  }

  return await Promise.all(paths.map(async (path) => ({
    path,
    bytes: await directorySize(path)
  })))
}

const logReclaimableWhisperCoremlArtifacts = async (): Promise<void> => {
  const artifacts = await collectReclaimableWhisperCoremlArtifacts()
  if (artifacts.length === 0) return

  l.write('info', 'Reclaimable Legacy Whisper CoreML Artifacts', {
    category: 'artifact',
    humanTable: createHumanTable(
      artifacts.map(({ path, bytes }) => ({
        path,
        reclaimable: formatBytes(bytes),
        action: 'safe to delete'
      })),
      ['path', 'reclaimable', 'action']
    ),
    metadata: {
      artifacts,
      totalBytes: artifacts.reduce((total, artifact) => total + artifact.bytes, 0)
    }
  })
}

// runtime/build only ever holds transient source and object trees. Individual
// installers now drop their own tree on success, but an install that predates
// that, or one whose guard short-circuits, leaves the tree behind forever.
// The threshold keeps trivial leftovers (empty scaffolding, stray manifests)
// from producing a reclaim table that reports nothing worth reclaiming.
const RECLAIMED_BUILD_TREE_MIN_BYTES = 10 * 1024 * 1024

export const shouldReportReclaimedBuildTrees = (bytes: number): boolean =>
  bytes >= RECLAIMED_BUILD_TREE_MIN_BYTES

const pruneBuildTrees = async (): Promise<void> => {
  const before = await directorySize(RUNTIME_BUILD_DIR)

  await rm(RUNTIME_BUILD_DIR, { recursive: true, force: true })
  await mkdir(RUNTIME_BUILD_DIR, { recursive: true })

  if (!shouldReportReclaimedBuildTrees(before)) return

  logSingleRowTable(l, 'Reclaimed Build Trees', {
    path: RUNTIME_BUILD_DIR,
    reclaimed: formatBytes(before)
  }, { category: 'artifact', columns: ['path', 'reclaimed'] })
}

const logSetupStepTimings = (): void => {
  const timings = [...getSetupStepTimings()].sort((a, b) => b.durationMs - a.durationMs)
  if (timings.length === 0) return

  // Wall clock, not work: these tasks run concurrently and contend for CPU and
  // I/O, so a task's duration here can be an order of magnitude above what the
  // same task costs when run alone via `--step`.
  l.write('info', 'Setup Step Timings (concurrent wall clock)', {
    category: 'command',
    humanTable: createHumanTable(
      timings.map(({ label, durationMs, ok }) => ({
        step: label,
        status: ok ? 'ok' : 'failed',
        wallClockMs: durationMs
      })),
      ['step', 'status', 'wallClockMs']
    ),
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
  l.write('debug', 'Setup Build Phase Timings', {
    category: 'command',
    humanTable: createHumanTable(rows, ['component', 'phase', 'durationMs', 'startedOffsetMs', 'status']),
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
    ['whisper-cli', await pathExists(whisperBinaryPath)] as const,
    ['ffmpeg', hasRuntimeTool('ffmpeg')] as const,
    ['ffprobe', hasRuntimeTool('ffprobe')] as const,
    ['yt-dlp', hasRuntimeTool('yt-dlp')] as const,
    ['mutool', hasRuntimeTool('mutool')] as const,
    ['ebook-convert', hasRuntimeTool('ebook-convert')] as const,
    ['tesseract', hasRuntimeTool('tesseract')] as const,
    ['qpdf', hasRuntimeTool('qpdf')] as const
  ]
  const localModelChecks = [
    [`whisper ${defaultWhisperModel}`, await pathExists(`${whisperModelsDir}/ggml-${defaultWhisperModel}.bin`)] as const,
    [`whisper ${defaultMusicWhisperModel}`, await pathExists(`${whisperModelsDir}/ggml-${defaultMusicWhisperModel}.bin`)] as const
  ]
  const missingTools = localToolChecks.filter(([, ok]) => !ok).map(([name]) => name)
  const missingModels = localModelChecks.filter(([, ok]) => !ok).map(([name]) => name)
  const runtimeBytes = await directorySize(RUNTIME_DIR)
  const healthy = missingTools.length === 0 && missingModels.length === 0

  l.write(healthy ? 'success' : 'warn', 'Setup Summary', {
    category: 'command',
    humanTable: createHumanTable([
      {
        item: 'elapsed',
        status: formatSetupElapsed(Date.now() - startedAtMs),
        detail: ''
      },
      {
        item: 'disk',
        status: formatBytes(runtimeBytes),
        detail: `${RUNTIME_DIR} (model and tool caches also live outside this directory)`
      },
      {
        item: 'local tools',
        status: missingTools.length === 0 ? 'ready' : 'missing',
        detail: missingTools.length === 0 ? 'all checked tools available' : missingTools.join(', ')
      },
      {
        item: 'local models',
        status: missingModels.length === 0 ? 'ready' : 'missing',
        detail: missingModels.length === 0 ? 'default local assets available' : missingModels.join(', ')
      },
      {
        // "present" rather than "configured": this only proves the variable is
        // non-empty, never that the key is valid.
        item: 'hosted providers',
        status: `${providerSummary.configured}/${providerSummary.total} present`,
        detail: providerSummary.missing === 0 ? 'all env vars set' : `${providerSummary.missing} missing`
      },
      {
        item: 'validation',
        status: 'next',
        detail: 'bun autoshow setup --doctor'
      }
    ], ['item', 'status', 'detail'])
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
    l.write('info', 'Starting complete AutoShow setup')
    await logPinnedVersions()
    await ensureRuntimeDirs()

    const providerSummary = logSetupProviderConfiguration('Hosted Provider Configuration')

    await withCompactSetup(async () => {
      await runConcurrentSetupTasks([
        { label: 'media tools', run: setupYtDependencies },
        { label: 'Defuddle', run: setupDefuddleCli },
        {
          label: 'Whisper',
          run: async () => {
            await setupWhisper()
            await downloadWhisperModel(defaultWhisperModel)
            await downloadWhisperModel(defaultMusicWhisperModel)
          }
        },
        { label: 'document tools', run: setupCalibreDocumentTools },
        { label: 'OCR', run: setupTesseractOcr }
      ])
    })

    await validateBinary('whisper-cli', whisperBinaryPath, ['--help'])

    await pruneBuildTrees()
    await logReclaimableWhisperCoremlArtifacts()
    logSetupStepTimings()
    healthy = await logSetupSummary(startedAtMs, providerSummary)

    l.write('info', 'You can now run: bun autoshow "https://www.youtube.com/watch?v=u1-WHqATSQU"')
    return healthy
  } finally {
    try {
      const performanceResult = await finishSetupPerformanceRun({
        healthy,
        stepTimings: getSetupStepTimings()
      })
      logDetailedSetupPerformance(performanceResult)
    } catch (error) {
      l.warn(`Could not write setup performance artifact: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

export const runCompleteSetup = async (): Promise<boolean> => await runFullSetup()

const runSetupTranscription = async (): Promise<void> => {
  await downloadWhisperModel('large-v3-turbo')
  logSetupProviderConfiguration('Transcription Provider Configuration', TRANSCRIPTION_PROVIDER_ENV_KEYS)
  l.write('success', 'Transcription setup complete')
}

const runSetupWrite = async (): Promise<void> => {
  logSetupProviderConfiguration('Write Provider Configuration', WRITE_PROVIDER_ENV_KEYS)
  l.write('success', 'Write setup complete (all write providers are API-based)')
}

const runSetupTts = async (): Promise<void> => {
  logSetupProviderConfiguration('TTS Provider Configuration', TTS_PROVIDER_ENV_KEYS)
  l.write('success', 'TTS setup complete (all TTS providers are API-based)')
}

const runSetupImage = async (): Promise<void> => {
  logSetupProviderConfiguration('Image Provider Configuration', IMAGE_PROVIDER_ENV_KEYS)
  l.write('success', 'Image setup complete (all image providers are API-based)')
}

const runSetupVideo = async (): Promise<void> => {
  logSetupProviderConfiguration('Video Provider Configuration', VIDEO_PROVIDER_ENV_KEYS)
  l.write('success', 'Video setup complete (all video providers are API-based)')
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
  const hasFallbackRenderer = commandExists('pango-view') && commandExists('convert')
  if (!hasAssFilter && !hasFallbackRenderer) {
    throw InfraError(
      'Music lyric-video setup: ffmpeg does not expose the ass filter, and the fallback renderer is unavailable. Install pango-view plus ImageMagick, or use an ffmpeg build with ass support.',
      { stage: 'setup:music' }
    )
  }

  await setupWhisper()
  await downloadWhisperModel('large-v3-turbo')
  l.write('success', 'Music setup complete')
}

export const getForceRedownloadPaths = async (step: SetupStepId): Promise<readonly string[]> => {
  const whisperModelPath = `${whisperModelsDir}/ggml-${defaultWhisperModel}.bin`
  const lyricsWhisperModelPath = `${whisperModelsDir}/ggml-${defaultMusicWhisperModel}.bin`
  switch (step) {
    case 'whisper-binary': return [whisperBinaryPath, whisperBuildDir]
    case 'whisper-model': return [whisperModelPath]
    case 'whisperfile': return [whisperfileBinaryPath(DEFAULT_WHISPERFILE_MODEL)]
    case 'defuddle': return [defuddleRuntimeDir]
    case 'music': return [whisperBinaryPath, whisperBuildDir, lyricsWhisperModelPath]
    // 'all' is the union of every step above plus the managed tool trees, so the
    // documented "reinstall everything" hatch does not quietly keep artifacts.
    case 'all': return [
      whisperBinaryPath,
      whisperBuildDir,
      whisperModelPath,
      lyricsWhisperModelPath,
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
    case 'tts': return []
    case 'transcription': case 'write': case 'image': case 'video': return []
    default: { const exhaustive: never = step; throw InternalError(`Unknown setup step: ${exhaustive}`, { stage: 'setup:run' }) }
  }
}

const applyRunOptions = async (step: SetupStepId, options?: { forceRedownload?: boolean }): Promise<void> => {
  if (!options?.forceRedownload) return
  const paths = await getForceRedownloadPaths(step)
  if (paths.length === 0) return
  await Promise.all(paths.map(p => rm(p, { recursive: true, force: true })))
  logSingleRowTable(l, 'Force Redownload', {
    step,
    clearedArtifacts: paths.length
  }, { category: 'artifact', columns: ['step', 'clearedArtifacts'] })
}

// Returns whether the step left the install in a healthy state. Only the full
// setup produces a verdict; focused steps throw on failure instead.
const executeStepOnce = async (step: SetupStepId): Promise<boolean> => {
  switch (step) {
    case 'all': return await runCompleteSetup()
    case 'yt-dlp': await setupYtDependencies(); return true
    case 'whisper-binary': await setupWhisper(); return true
    case 'whisper-model': await downloadWhisperModel(defaultWhisperModel); return true
    case 'whisperfile': await setupWhisperfile(DEFAULT_WHISPERFILE_MODEL); return true
    case 'defuddle': await setupDefuddleCli(); return true
    case 'calibre': await setupCalibreDocumentTools(); return true
    case 'transcription': await runSetupTranscription(); return true
    case 'write': await runSetupWrite(); return true
    case 'tts': await runSetupTts(); return true
    case 'image': await runSetupImage(); return true
    case 'video': await runSetupVideo(); return true
    case 'music': await runSetupMusic(); return true
    default: { const exhaustive: never = step; throw InternalError(`Unknown setup step: ${exhaustive}`, { stage: 'setup:run' }) }
  }
}

export const runSetupStep = async (step: SetupStepId, options?: { forceRedownload?: boolean }): Promise<boolean> => {
  await ensureRuntimeDirs()
  await applyRunOptions(step, options)
  return await executeStepOnce(step)
}
