import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { join } from 'node:path'
import { setupTesseractOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-local/tesseract-setup'
import { setupReverb } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/reverb/reverb'
import {
checkReverbAsrAssets,
reverbDiarizationDir as reverbDiarizationDirFromAssets,
reverbDiarizationEmbeddingDir as reverbDiarizationEmbeddingDirFromAssets,
reverbModelDir as reverbModelDirFromAssets
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/reverb/reverb-assets'
import { convertWhisperModelToCoreml, downloadWhisperModel, fetchWhisperModel, setupWhisper } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisper/whisper'
import { setupWhisperfile } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisperfile/whisperfile'
import { ensureLlamafileBundleDownloaded, resolveLlamafileBundlePath } from '~/cli/commands/process-steps/step-3-write/write-local/llamafile/llamafile-download'
import { DEFAULT_LLAMAFILE_MODEL } from '~/cli/commands/process-steps/step-3-write/write-local/llamafile/llamafile-constants'
import { DEFAULT_WHISPERFILE_MODEL } from '~/cli/commands/setup-and-utilities/models/stt-models'
import { defuddleRuntimeDir, setupDefuddleCli } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-local/defuddle/defuddle-cli'
import { checkLlamaInstalled, runLlamaSetup } from '~/cli/commands/process-steps/step-3-write/write-local/llama/llama'
import { ensureLlamaModelDownloaded } from '~/cli/commands/process-steps/step-3-write/write-local/llama/run-llama'
import { resolveLlamaCacheClearPaths } from '~/cli/commands/process-steps/step-3-write/write-local/llama/llama-model-cache'
import { llamaSetupModelsMetadataPath } from '~/cli/commands/process-steps/step-3-write/write-local/llama/llama-model-metadata'
import { ensureKittenTtsSetup, setupKittenTts } from '~/cli/commands/process-steps/step-4-tts/tts-local/kitten/kitten-tts'
import { hasCachedKittenTtsModel, resolveKittenTtsCacheClearPaths } from '~/cli/commands/process-steps/step-4-tts/tts-local/kitten/kitten-tts-model-cache'
import { SUPPORTED_KITTEN_TTS_MODELS, SUPPORTED_LLAMA_MODELS } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { DEFAULT_KITTEN_TTS_MODEL } from '~/cli/commands/setup-and-utilities/models/tts-models'
import { setupYtDependencies } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-audio/audio'
import { setupCalibreDocumentTools } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-document/calibre'
import { isAcsmAuthorized, runAcsmAuthorization, setupAcsmFulfillment } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-document/acsm'
import { logSetupToolStatus } from '~/cli/commands/setup-and-utilities/setup/setup-logging'
import { formatSetupElapsed, runWithSetupHeartbeat } from '~/cli/commands/setup-and-utilities/setup/setup-heartbeat'
import type { ConcurrentSetupTask, HostedProviderConfigurationSummary, RunOptions, RunResult, SetupPlatform, SetupStepId } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { l as globalLogger, isJsonResultActive } from '~/utils/app-logger/app-logger'
import { createHumanTable, logKeyValueTable, logSingleRowTable } from '~/utils/app-logger/human-table/human-table'
import { withRetry } from '~/utils/retries'
import { isCompactSetupMode, setCompactSetupMode } from '~/utils/setup-output-mode'
import { InfraError, InternalError } from '~/utils/error-handler'
import {
  RUNTIME_BIN_DIR,
  RUNTIME_BUILD_DIR,
  RUNTIME_DIR,
  RUNTIME_TOOLS_DIR,
  acsmCalibrePluginToolDir,
  acsmFulfillManagedBinaryPath,
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
  tesseractBuildDir,
  tesseractManagedBinaryPath,
  tessdataDir,
  ytDlpManagedBinaryPath
} from '~/utils/runtime-paths'
import { listPinnedDependencies } from './dependency-metadata'
import { HOSTED_PROVIDER_ENV_CHECKS, logHostedProviderConfiguration } from './hosted-provider-config'
import { installManagedUv, managedUvxPath, resolveUvCommand } from './setup-download/managed-uv'

const RUNTIME = RUNTIME_DIR

export const whisperBinaryPath = join(RUNTIME, 'bin/whisper-cli')
export const llamaBinaryPath = join(RUNTIME, 'bin/llama-server')
export const whisperLibDir = join(RUNTIME, 'bin/lib')
export const whisperCoremlEnvDir = join(RUNTIME, 'bin/whisper-coreml-env')
export const reverbUvEnvDir = join(RUNTIME, 'bin/reverb')
export const kittenTtsUvEnvDir = join(RUNTIME, 'bin/kitten-tts')
export const whisperBuildDir = join(RUNTIME, 'build/whisper.cpp')
export const whisperModelsDir = join(RUNTIME, 'models/whisper')
export const whisperfileDir = join(RUNTIME, 'bin/whisperfile')
export const whisperfileBinaryPath = (model: string): string => join(whisperfileDir, `whisper-${model}.llamafile`)
const llamaModelsDir = join(RUNTIME, 'models/llama')
export const reverbModelDir = reverbModelDirFromAssets
const reverbDiarizationDir = reverbDiarizationDirFromAssets
const reverbDiarizationEmbeddingDir = reverbDiarizationEmbeddingDirFromAssets
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

export const requireUvCommand = async (): Promise<string> => {
  const command = await resolveUvCommand()
  if (command) return command
  throw InfraError('uv is not available. Run `bun autoshow setup --step uv` to install AutoShow managed uv.', {
    stage: 'setup:uv',
    hints: ['Run `bun autoshow setup --step uv` to install AutoShow managed uv']
  })
}

export const runUvCapture = async (args: string[] = [], options: RunOptions = {}): Promise<RunResult> => {
  const command = await requireUvCommand()
  return await runCapture(command, args, options)
}

export const runUvInherit = async (args: string[] = [], options: RunOptions = {}): Promise<number> => {
  const command = await requireUvCommand()
  return await runInherit(command, args, options)
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

export const supportsCoreML = async (): Promise<boolean> => {
  if (!(detectPlatform() === 'darwin' && detectArchitecture() === 'arm64')) return false
  const result = await runCapture('xcrun', ['--sdk', 'macosx', '--show-sdk-path'], { allowFailure: true })
  return result.exitCode === 0
}

export const setupUv = async (): Promise<void> => {
  const pathUv = Bun.which('uv')
  if (pathUv) {
    return
  }
  const managedUv = await resolveUvCommand()
  if (managedUv && await pathExists(managedUvxPath)) {
    return
  }
  logSetupToolStatus(l, { tool: 'uv', status: 'installing' })
  await withRetry(
    { retryClass: 'setup_download', operationName: 'uv-release' },
    async () => {
      await installManagedUv()
    }
  )
  logSetupToolStatus(l, { tool: 'uv', status: 'installed' })
}

export const defaultWhisperModel = 'tiny'
export const defaultMusicWhisperModel = 'large-v3-turbo'
export const defaultLlamaModel = 'ggml-org/gemma-3-270m-it-GGUF'

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
    mkdir(whisperfileDir, { recursive: true }),
    mkdir(llamaModelsDir, { recursive: true }),
    mkdir(reverbUvEnvDir, { recursive: true }).catch(() => undefined),
    mkdir(reverbModelDir, { recursive: true }).catch(() => undefined),
    mkdir(reverbDiarizationDir, { recursive: true }).catch(() => undefined),
    mkdir(reverbDiarizationEmbeddingDir, { recursive: true }).catch(() => undefined)
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

const TRANSCRIPTION_PROVIDER_ENV_KEYS = [
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'GLM_API_KEY',
  'TOGETHER_API_KEY',
  'XAI_API_KEY',
  'MISTRAL_API_KEY',
  'ELEVENLABS_API_KEY',
  'DEEPGRAM_API_KEY',
  'SONIOX_API_KEY',
  'SPEECHMATICS_API_KEY',
  'REVAI_ACCESS_TOKEN',
  'ASSEMBLYAI_API_KEY',
  'GLADIA_API_KEY',
  'SUPADATA_API_KEY',
  'SCRAPECREATORS_API_KEY',
  'GROQ_API_KEY',
  'DEEPINFRA_API_KEY',
  'HAPPYSCRIBE_API_KEY',
  'HUGGINGFACE_TOKEN'
] as const

const WRITE_PROVIDER_ENV_KEYS = [
  'OPENAI_API_KEY',
  'XAI_API_KEY',
  'GEMINI_API_KEY',
  'GLM_API_KEY',
  'KIMI_API_KEY',
  'TOGETHER_API_KEY',
  'CEREBRAS_API_KEY',
  'ANTHROPIC_API_KEY',
  'GROQ_API_KEY',
  'MINIMAX_API_KEY'
] as const

const TTS_PROVIDER_ENV_KEYS = [
  'OPENAI_API_KEY',
  'ELEVENLABS_API_KEY',
  'GROQ_API_KEY',
  'XAI_API_KEY',
  'MISTRAL_API_KEY',
  'GEMINI_API_KEY',
  'DEEPGRAM_API_KEY',
  'SPEECHIFY_API_KEY',
  'HUME_API_KEY',
  'CARTESIA_API_KEY',
  'MINIMAX_API_KEY'
] as const

const IMAGE_PROVIDER_ENV_KEYS = [
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'XAI_API_KEY',
  'BFL_API_KEY',
  'LUMA_AGENTS_API_KEY',
  'RECRAFT_API_TOKEN',
  'GLM_API_KEY'
] as const

const VIDEO_PROVIDER_ENV_KEYS = [
  'GEMINI_API_KEY',
  'MINIMAX_API_KEY',
  'GLM_API_KEY',
  'XAI_API_KEY',
  'RUNWAYML_API_SECRET',
  'LTXV_API_KEY'
] as const

const MUSIC_PROVIDER_ENV_KEYS = [
  'GEMINI_API_KEY',
  'ELEVENLABS_API_KEY',
  'MINIMAX_API_KEY'
] as const

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

export const downloadKittenTtsModel = async (
  model: string,
  options: { pythonPath?: string } = {}
): Promise<void> => {
  const kittenPython = options.pythonPath ?? `${kittenTtsUvEnvDir}/bin/python`
  if (!await pathExists(kittenPython)) { l.warn(`Kitten TTS venv not found, skipping model download: ${model}`); return }

  // Constructing KittenTTS loads the model in full. On a warm run that was the
  // single most expensive step in setup, spent only to confirm a cache hit.
  if (await hasCachedKittenTtsModel(model)) {
    logSetupToolStatus(l, { tool: 'kitten-tts', status: 'ready', detail: `${model} (cached)` })
    return
  }

  logSetupToolStatus(l, { tool: 'kitten-tts', status: 'downloading', detail: model })
  const result = await runCapture(
    kittenPython,
    ['-c', `from kittentts import KittenTTS; KittenTTS("${model}")`],
    { allowFailure: true }
  )
  if (result.exitCode !== 0) {
    throw InfraError(`Kitten TTS model download failed for ${model}: ${formatCommandFailure(kittenPython, ['-c', 'from kittentts import KittenTTS; KittenTTS("<model>")'], result)}`, { stage: 'setup:kitten-tts' })
  }
  logSetupToolStatus(l, { tool: 'kitten-tts', status: 'ready', detail: model })
}

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

// `runtime/` holds ~77k files, and stat-ing each one cost a noticeable share of
// a warm run. `du` does the same walk in C; the JS walk stays as the fallback
// for hosts without it.
const directorySize = async (root: string): Promise<number> => {
  const result = await runCapture('du', ['-sk', root], { allowFailure: true })
  if (result.exitCode === 0) {
    const kilobytes = Number.parseInt(result.stdout.trim().split(/\s+/)[0] ?? '', 10)
    if (Number.isFinite(kilobytes)) return kilobytes * 1024
  }
  return await walkDirectorySize(root)
}

// runtime/build only ever holds transient source and object trees. Individual
// installers now drop their own tree on success, but an install that predates
// that, or one whose guard short-circuits, leaves the tree behind forever.
// `du -sk` charges an empty directory for its own inode — 8 KiB on APFS — so
// the previous `before === 0` guard never fired and every run reported a table
// for reclaiming nothing. The `walkDirectorySize` fallback sums file sizes only
// and would return 0 for that same tree, so the two size functions disagree on
// exactly the case that matters; a threshold is the fix, not a tighter zero.
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

const logSetupSummary = async (
  startedAtMs: number,
  providerSummary: HostedProviderConfigurationSummary
): Promise<boolean> => {
  const localToolChecks = [
    ['whisper-cli', await pathExists(whisperBinaryPath)] as const,
    ['llama-server', await pathExists(llamaBinaryPath)] as const,
    ['Kitten TTS env', await pathExists(`${kittenTtsUvEnvDir}/bin/python`)] as const,
    ['ffmpeg', hasRuntimeTool('ffmpeg')] as const,
    ['ffprobe', hasRuntimeTool('ffprobe')] as const,
    ['yt-dlp', hasRuntimeTool('yt-dlp')] as const,
    ['mutool', hasRuntimeTool('mutool')] as const,
    ['ebook-convert', hasRuntimeTool('ebook-convert')] as const,
    ['calibre-acsm-fulfill', hasRuntimeTool('calibre-acsm-fulfill')] as const,
    ['tesseract', hasRuntimeTool('tesseract')] as const,
    ['qpdf', hasRuntimeTool('qpdf')] as const
  ]
  const localModelChecks = [
    [`whisper ${defaultWhisperModel}`, await pathExists(`${whisperModelsDir}/ggml-${defaultWhisperModel}.bin`)] as const,
    [`whisper ${defaultMusicWhisperModel}`, await pathExists(`${whisperModelsDir}/ggml-${defaultMusicWhisperModel}.bin`)] as const,
    ['Reverb ASR', await checkReverbAsrAssets()] as const
  ]
  const missingTools = localToolChecks.filter(([, ok]) => !ok).map(([name]) => name)
  const missingModels = localModelChecks.filter(([, ok]) => !ok).map(([name]) => name)
  const acsmAuthorized = await isAcsmAuthorized()
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
        item: 'ACSM authorization',
        status: acsmAuthorized ? 'ready' : 'action needed',
        detail: acsmAuthorized ? 'account activated' : 'bun autoshow setup --step acsm-authorize (required before ACSM fulfillment)'
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
          await fetchWhisperModel(defaultWhisperModel)
          // The music model's download is network-bound and the default model's
          // CoreML conversion is CPU-bound, so they overlap cleanly. The two
          // conversions stay serial — running both would contend for the CPU.
          await runSettledSetupTasks([
            { label: `whisper ${defaultWhisperModel} CoreML`, run: async () => { await convertWhisperModelToCoreml(defaultWhisperModel) } },
            { label: `whisper ${defaultMusicWhisperModel} download`, run: async () => { await fetchWhisperModel(defaultMusicWhisperModel) } }
          ])
          await convertWhisperModelToCoreml(defaultMusicWhisperModel)
        }
      },
      {
        label: 'llama',
        run: async () => {
          await runLlamaSetup()
          if (await checkLlamaInstalled()) {
            await ensureLlamaModelDownloaded(defaultLlamaModel)
          } else { l.warn('llama.cpp not available, skipping model download') }
        }
      },
      { label: 'Reverb', run: setupReverb },
      {
        label: 'document tools',
        // The Setup Summary carries an "ACSM authorization" row, so a full setup
        // does not also warn: someone who never fulfills an .acsm would otherwise
        // see the same warning forever, which is how a real to-do becomes noise.
        run: async () => { await setupCalibreDocumentTools({ printAuthorizeHint: false }) }
      },
      { label: 'OCR', run: setupTesseractOcr },
      {
        label: 'TTS',
        run: async () => {
          await setupKittenTts()
          await downloadKittenTtsModel(DEFAULT_KITTEN_TTS_MODEL)
        }
      }
    ])
  })

  await validateBinary('whisper-cli', whisperBinaryPath, ['--help'])
  await validateBinary('llama-server', llamaBinaryPath, ['--version'])

  await pruneBuildTrees()
  logSetupStepTimings()
  const healthy = await logSetupSummary(startedAtMs, providerSummary)

  l.write('info', 'You can now run: bun autoshow "https://www.youtube.com/watch?v=u1-WHqATSQU"')
  return healthy
}

export const runCompleteSetup = async (): Promise<boolean> => await runFullSetup()

const runSetupTranscription = async (): Promise<void> => {
  await downloadWhisperModel('large-v3-turbo')
  await setupReverb()
  logSetupProviderConfiguration('Transcription Provider Configuration', TRANSCRIPTION_PROVIDER_ENV_KEYS)
  l.write('success', 'Transcription setup complete')
}

const runSetupWrite = async (): Promise<void> => {
  if (!await checkLlamaInstalled()) await runLlamaSetup()
  for (const model of SUPPORTED_LLAMA_MODELS) await ensureLlamaModelDownloaded(model)
  logSetupProviderConfiguration('Write Provider Configuration', WRITE_PROVIDER_ENV_KEYS)
  l.write('success', 'Write setup complete')
}

const runSetupTts = async (): Promise<void> => {
  await ensureKittenTtsSetup()
  for (const model of SUPPORTED_KITTEN_TTS_MODELS) await downloadKittenTtsModel(model)
  logSetupProviderConfiguration('TTS Provider Configuration', TTS_PROVIDER_ENV_KEYS)
  l.write('success', 'TTS setup complete')
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

const computeMedian = (values: number[]): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2) : sorted[mid]!
}

const computeP90 = (values: number[]): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(0.9 * sorted.length) - 1))]!
}

const logBenchmarkResults = (stepLabel: string, runs: number, results: Map<string, number[]>): void => {
  const rows = [...results.entries()].map(([engine, durations]) => {
    const median = computeMedian(durations)
    const p90 = computeP90(durations)
    return {
      engine,
      medianMs: median,
      p90Ms: p90,
      minMs: Math.min(...durations),
      maxMs: Math.max(...durations),
      outliers: durations.filter(v => v > p90).length
    }
  })

  l.write('info', `Setup Benchmark (${stepLabel}, ${runs} run${runs > 1 ? 's' : ''})`, {
    category: 'command',
    humanTable: createHumanTable(rows, ['engine', 'medianMs', 'p90Ms', 'minMs', 'maxMs', 'outliers']),
    metadata: { step: stepLabel, runs, results: rows }
  })
}

const getForceRedownloadPaths = async (step: SetupStepId): Promise<readonly string[]> => {
  const whisperModelPath = `${whisperModelsDir}/ggml-${defaultWhisperModel}.bin`
  const lyricsWhisperModelPath = `${whisperModelsDir}/ggml-${defaultMusicWhisperModel}.bin`
  // The weights live in llama.cpp's own cache outside runtime/, so clearing
  // runtime paths alone leaves a possibly-corrupt GGUF in place and the next
  // "redownload" silently returns from a warm cache.
  const llamaModelPaths = await resolveLlamaCacheClearPaths(defaultLlamaModel)
  // Kitten weights live in the shared HuggingFace cache, also outside runtime/.
  const kittenModelPaths = SUPPORTED_KITTEN_TTS_MODELS.flatMap(resolveKittenTtsCacheClearPaths)
  switch (step) {
    case 'whisper-binary': return [whisperBinaryPath, whisperBuildDir]
    case 'whisper-model': return [whisperModelPath]
    case 'whisperfile': return [whisperfileBinaryPath(DEFAULT_WHISPERFILE_MODEL)]
    case 'llama-binary': return [llamaBinaryPath, llamaSetupModelsMetadataPath, ...llamaModelPaths]
    case 'llamafile': return [resolveLlamafileBundlePath(DEFAULT_LLAMAFILE_MODEL)]
    case 'reverb': return [reverbModelDir, reverbDiarizationDir, reverbDiarizationEmbeddingDir]
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
      resolveLlamafileBundlePath(DEFAULT_LLAMAFILE_MODEL),
      llamaBinaryPath,
      llamaSetupModelsMetadataPath,
      ...llamaModelPaths,
      reverbModelDir,
      reverbDiarizationDir,
      reverbDiarizationEmbeddingDir,
      reverbUvEnvDir,
      kittenTtsUvEnvDir,
      ...kittenModelPaths,
      whisperCoremlEnvDir,
      defuddleRuntimeDir,
      ytDlpManagedBinaryPath,
      ffmpegManagedBinaryPath,
      ffprobeManagedBinaryPath,
      ffmpegBuildDir,
      lameBuildDir,
      mutoolManagedBinaryPath,
      ebookConvertManagedBinaryPath,
      acsmFulfillManagedBinaryPath,
      acsmCalibrePluginToolDir,
      tesseractManagedBinaryPath,
      tesseractBuildDir,
      tessdataDir,
      qpdfBuildDir,
      RUNTIME_TOOLS_DIR
    ]
    case 'yt-dlp': return [ytDlpManagedBinaryPath, ffmpegManagedBinaryPath, ffprobeManagedBinaryPath, ffmpegBuildDir, ffmpegToolDir, lameBuildDir, lameToolDir]
    case 'calibre': return [mutoolManagedBinaryPath, mupdfBuildDir, mupdfToolDir, ebookConvertManagedBinaryPath, calibreToolDir, acsmFulfillManagedBinaryPath, acsmCalibrePluginToolDir]
    case 'acsm': return [acsmFulfillManagedBinaryPath, acsmCalibrePluginToolDir]
    case 'acsm-authorize': return []
    case 'tts': return [kittenTtsUvEnvDir, ...kittenModelPaths]
    case 'uv': case 'transcription': case 'write': case 'image': case 'video': return []
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
    case 'uv': await setupUv(); return true
    case 'yt-dlp': await setupYtDependencies(); return true
    case 'whisper-binary': await setupWhisper(); return true
    case 'whisper-model': await downloadWhisperModel(defaultWhisperModel); return true
    case 'whisperfile': await setupWhisperfile(DEFAULT_WHISPERFILE_MODEL); return true
    case 'llama-binary': await runLlamaSetup(); return true
    case 'llamafile': await ensureLlamafileBundleDownloaded(DEFAULT_LLAMAFILE_MODEL); return true
    case 'reverb': await setupReverb(); return true
    case 'defuddle': await setupDefuddleCli(); return true
    case 'calibre': await setupCalibreDocumentTools(); return true
    case 'acsm': await setupAcsmFulfillment(); return true
    case 'acsm-authorize': await runAcsmAuthorization(); return true
    case 'transcription': await runSetupTranscription(); return true
    case 'write': await runSetupWrite(); return true
    case 'tts': await runSetupTts(); return true
    case 'image': await runSetupImage(); return true
    case 'video': await runSetupVideo(); return true
    case 'music': await runSetupMusic(); return true
    default: { const exhaustive: never = step; throw InternalError(`Unknown setup step: ${exhaustive}`, { stage: 'setup:run' }) }
  }
}

export const runSetupStep = async (step: SetupStepId, options?: { forceRedownload?: boolean, repeat?: number }): Promise<boolean> => {
  const repeat = options?.repeat ?? 1
  await ensureRuntimeDirs()

  if (repeat <= 1) {
    await applyRunOptions(step, options)
    return await executeStepOnce(step)
  }

  const label = 'auto'
  const timings = new Map<string, number[]>([[label, []]])
  let healthy = true
  for (let i = 0; i < repeat; i++) {
    await applyRunOptions(step, options)
    const start = Date.now()
    healthy = await executeStepOnce(step) && healthy
    const duration = Date.now() - start
    timings.get(label)!.push(duration)
    l.write('info', `Run ${i + 1}/${repeat} (${label}): ${duration}ms`)
  }

  logBenchmarkResults(step, repeat, timings)
  return healthy
}
