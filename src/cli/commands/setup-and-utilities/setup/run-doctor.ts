import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveYtDlpBinaryInfo } from '~/cli/commands/process-steps/shared/shared-yt-dlp-binary'
import { inspectYtDlpAuthState } from '~/cli/commands/process-steps/shared/shared-yt-dlp-options'
import { formatReverbAsrAssetPaths, formatReverbDiarizationAssetPaths, getMissingReverbAsrFiles, getMissingReverbDiarizationFiles } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/reverb/reverb-assets'
import { readDefuddleCliReadiness } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-local/defuddle/defuddle-cli'
import { hasSetupManagedLlamaModel, llamaSetupModelsMetadataPath, readLlamaSetupModelMetadata } from '~/cli/commands/process-steps/step-3-write/write-local/llama/llama-model-metadata'
import { listLlamaCacheEntries, resolveLlamaCacheDir } from '~/cli/commands/process-steps/step-3-write/write-local/llama/llama-model-cache'
import { hasCachedKittenTtsModel, resolveHuggingFaceCacheDir } from '~/cli/commands/process-steps/step-4-tts/tts-local/kitten/kitten-tts-model-cache'
import { DEFAULT_KITTEN_TTS_MODEL } from '~/cli/commands/setup-and-utilities/models/tts-models'
import { loadConfig, resolveConfigPath } from '~/cli/commands/setup-and-utilities/config/config-loader'
import type { AutoshowConfig, CheckResult, DoctorCheck, DoctorProbes, DoctorReport, DoctorSection, DoctorSeverity, DoctorStatus, ManagedArtifactToolId, RunResult } from '~/types'
import { loadEnvFile } from '~/utils/cli-utils'
import * as l from '~/utils/app-logger/app-logger'
import { createHumanTable } from '~/utils/app-logger/human-table/human-table'
import { getHostedProviderConfiguredPaths, HOSTED_PROVIDER_ENV_CHECKS } from './hosted-provider-config'
import { defaultLlamaModel, defaultWhisperModel, kittenTtsUvEnvDir, llamaBinaryPath, reverbUvEnvDir, runCapture, whisperBinaryPath, whisperModelsDir } from './run-complete-setup'
import { resolveUvCommand } from './setup-download/managed-uv'
import {
  acsmCalibrePluginAccountDir,
  acsmFulfillManagedBinaryPath,
  ebookConvertManagedBinaryPath,
  englishTrainedDataPath,
  ffmpegManagedBinaryPath,
  ffprobeManagedBinaryPath,
  getConfiguredBinDir,
  mutoolManagedBinaryPath,
  qpdfManagedBinaryPath,
  resolveTessdataPrefix,
  tesseractManagedBinaryPath,
  tessdataHocrConfigPath,
  ytDlpManagedBinaryPath
} from '~/utils/runtime-paths'
import type { RuntimeToolId } from '~/types'
import { ACSM_ACCOUNT_REQUIRED_FILES, ACSM_FULFILL_COMMAND } from '~/cli/commands/process-steps/step-1-download/document/acsm-fulfillment'
import { validateManagedArtifact } from './setup-download/managed-artifact'

const hasPath = async (path: string): Promise<boolean> => {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

const listNames = async (path: string): Promise<string[]> => {
  try {
    return await readdir(path)
  } catch {
    return []
  }
}

const directoryHasAnyFiles = async (root: string): Promise<boolean> => {
  try {
    const entries = await readdir(root, { withFileTypes: true })
    for (const entry of entries) {
      const path = join(root, entry.name)
      if (entry.isFile()) return true
      if (entry.isDirectory() && await directoryHasAnyFiles(path)) return true
    }
    return false
  } catch {
    return false
  }
}

const createDoctorProbes = (overrides: Partial<DoctorProbes> = {}): DoctorProbes => ({
  env: process.env as Record<string, string | undefined>,
  which: (command) => Bun.which(command) ?? undefined,
  pathExists: hasPath,
  listDirectory: listNames,
  directoryHasFiles: directoryHasAnyFiles,
  run: async (command, args) => await runCapture(command, args, { allowFailure: true }),
  resolveYtDlpBinaryInfo,
  resolveUvCommand,
  readDefuddleCliReadiness,
  resolveConfigPath,
  loadConfig,
  inspectYtDlpAuthState,
  hasSetupManagedLlamaModel,
  readLlamaSetupModelMetadata,
  listLlamaCacheEntries,
  hasCachedKittenTtsModel,
  validateManagedArtifact,
  ...overrides
})

const check = (
  status: DoctorStatus,
  label: string,
  detail: string,
  options: { severity?: DoctorSeverity, nextStep?: string } = {}
): DoctorCheck => ({
  label,
  status,
  detail,
  severity: options.severity ?? (status === 'WARN' ? 'warn' : 'info'),
  ...(options.nextStep ? { nextStep: options.nextStep } : {})
})

const checkCommand = (
  probes: DoctorProbes,
  label: string,
  command: string,
  options: { nextStep?: string, severity?: DoctorSeverity } = {}
): DoctorCheck => {
  const found = probes.which(command)
  return found
    ? check('OK', label, found)
    : check('MISSING', label, 'not found', {
      severity: options.severity ?? 'warn',
      ...(options.nextStep ? { nextStep: options.nextStep } : {})
    })
}

const DOCTOR_RUNTIME_TOOLS: Partial<Record<RuntimeToolId, { managedPath: string }>> = {
  ffmpeg: { managedPath: ffmpegManagedBinaryPath },
  ffprobe: { managedPath: ffprobeManagedBinaryPath },
  'yt-dlp': { managedPath: ytDlpManagedBinaryPath },
  mutool: { managedPath: mutoolManagedBinaryPath },
  'ebook-convert': { managedPath: ebookConvertManagedBinaryPath },
  'calibre-acsm-fulfill': { managedPath: acsmFulfillManagedBinaryPath },
  tesseract: { managedPath: tesseractManagedBinaryPath },
  qpdf: { managedPath: qpdfManagedBinaryPath }
}

const resolveDoctorRuntimeTool = async (
  probes: DoctorProbes,
  id: RuntimeToolId
): Promise<{ path: string, source: 'override' | 'managed' | 'path' } | undefined> => {
  const metadata = DOCTOR_RUNTIME_TOOLS[id]
  const overrideDir = getConfiguredBinDir()?.trim()
  if (overrideDir) {
    const overridePath = join(overrideDir, id)
    if (await probes.pathExists(overridePath)) return { path: overridePath, source: 'override' }
  }
  if (metadata && await probes.pathExists(metadata.managedPath)) return { path: metadata.managedPath, source: 'managed' }
  if (process.platform !== 'darwin' || id === 'calibre-acsm-fulfill') {
    const pathBinary = probes.which(id)
    if (pathBinary) return { path: pathBinary, source: 'path' }
  }
  return undefined
}

const checkRuntimeToolVersion = async (
  probes: DoctorProbes,
  label: string,
  id: RuntimeToolId,
  args: string[],
  options: { nextStep: string, okExitCodes?: number[], managedArtifactTool?: ManagedArtifactToolId }
): Promise<DoctorCheck> => {
  const resolved = await resolveDoctorRuntimeTool(probes, id)
  if (!resolved) {
    return check('MISSING', label, 'not found', {
      severity: 'warn',
      nextStep: options.nextStep
    })
  }

  let sourceDetail: string = resolved.source
  let expectedManagedVersion: string | undefined
  if (resolved.source === 'managed' && options.managedArtifactTool) {
    const validation = await probes.validateManagedArtifact(options.managedArtifactTool)
    if (!validation.healthy) {
      return check('WARN', label, `${resolved.path} (managed) has unhealthy provenance: ${validation.reason}`, {
        nextStep: options.nextStep
      })
    }
    sourceDetail = validation.distribution === 'source'
      ? `managed source ${validation.version} ${validation.platform}/${validation.architecture}`
      : `managed prebuilt ${validation.version}-${validation.revision} ${validation.platform}/${validation.architecture}`
    expectedManagedVersion = validation.version
  }

  const result = await probes.run(resolved.path, args)
  const okExitCodes = options.okExitCodes ?? [0]
  if (okExitCodes.includes(result.exitCode)) {
    const detail = result.stdout.trim() || result.stderr.trim() || resolved.path
    if (expectedManagedVersion && !`${result.stdout}\n${result.stderr}`.includes(expectedManagedVersion)) {
      return check('WARN', label, `${resolved.path} (${sourceDetail}) did not report expected version ${expectedManagedVersion}`, {
        nextStep: options.nextStep
      })
    }
    return check('OK', label, `${resolved.path} (${sourceDetail})${detail ? `: ${detail}` : ''}`)
  }

  return check('WARN', label, `${resolved.path} (${sourceDetail}) failed ${args.join(' ')}: ${formatRunIssue(result)}`, {
    nextStep: options.nextStep
  })
}

const checkUv = async (probes: DoctorProbes): Promise<DoctorCheck> => {
  const resolved = await probes.resolveUvCommand()
  return resolved
    ? check('OK', 'uv', resolved)
    : check('MISSING', 'uv', 'not found', {
      severity: 'warn',
      nextStep: 'bun autoshow setup --step uv'
    })
}

const envIsSet = (probes: DoctorProbes, envVar: string): boolean => {
  const value = probes.env[envVar]
  return typeof value === 'string' && value.trim().length > 0
}

const reverbSetupNextStep = (probes: DoctorProbes): string =>
  envIsSet(probes, 'HUGGINGFACE_TOKEN')
    ? 'bun autoshow setup --step reverb'
    : 'set HUGGINGFACE_TOKEN, then run bun autoshow setup --step reverb'

const formatRunIssue = (result: RunResult): string => {
  const details = result.stderr.trim() || result.stdout.trim() || `exit code ${result.exitCode}`
  return details.length > 300 ? `${details.slice(0, 300)}...` : details
}

const checkTesseractEnglishData = async (probes: DoctorProbes): Promise<DoctorCheck> => {
  const resolved = await resolveDoctorRuntimeTool(probes, 'tesseract')
  if (!resolved) {
    return check('MISSING', 'Tesseract eng data', 'tesseract not found', {
      severity: 'warn',
      nextStep: 'bun autoshow setup'
    })
  }

  const tessdataPrefix = resolveTessdataPrefix()
  if (resolved.source === 'managed' && !await probes.pathExists(englishTrainedDataPath)) {
    return check('MISSING', 'Tesseract eng data', `${englishTrainedDataPath} not found`, {
      severity: 'warn',
      nextStep: 'bun autoshow setup'
    })
  }
  if (resolved.source === 'managed' && !await probes.pathExists(tessdataHocrConfigPath)) {
    return check('MISSING', 'Tesseract eng data', `${tessdataHocrConfigPath} not found`, {
      severity: 'warn',
      nextStep: 'bun autoshow setup'
    })
  }

  const result = await probes.run(resolved.path, ['--list-langs'])
  if (result.exitCode !== 0) {
    return check('WARN', 'Tesseract eng data', `could not list languages: ${formatRunIssue(result)}`, {
      nextStep: 'bun autoshow setup'
    })
  }

  const langs = `${result.stdout}\n${result.stderr}`
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  return langs.includes('eng')
    ? check('OK', 'Tesseract eng data', `eng available (${resolved.source}, TESSDATA_PREFIX=${tessdataPrefix})`)
    : check('MISSING', 'Tesseract eng data', 'eng not listed by tesseract --list-langs', {
      severity: 'warn',
      nextStep: 'bun autoshow setup'
    })
}

// `calibre-acsm-fulfill --version` short-circuits inside the wrapper before the
// activation guard, so a version probe reports OK for an install that cannot
// fulfill anything. Check the account files the wrapper actually requires.
const checkAcsmAuthorization = async (probes: DoctorProbes): Promise<DoctorCheck> => {
  if (!await probes.pathExists(acsmFulfillManagedBinaryPath)) {
    return check('MISSING', 'ACSM authorization', 'calibre-acsm-fulfill not installed', {
      severity: 'warn',
      nextStep: 'bun autoshow setup --step acsm'
    })
  }

  const missing: string[] = []
  for (const name of ACSM_ACCOUNT_REQUIRED_FILES) {
    if (!await probes.pathExists(join(acsmCalibrePluginAccountDir, name))) {
      missing.push(name)
    }
  }

  return missing.length === 0
    ? check('OK', 'ACSM authorization', `account activated in ${acsmCalibrePluginAccountDir}`)
    : check('MISSING', 'ACSM authorization', `missing ${missing.join(', ')} in ${acsmCalibrePluginAccountDir}`, {
      severity: 'warn',
      nextStep: 'bun autoshow setup --step acsm-authorize'
    })
}

const hasFilter = (filtersOutput: string, filterName: string): boolean =>
  filtersOutput.split('\n').some((line) => line.trim().split(/\s+/).includes(filterName))

const checkMusicRenderer = async (probes: DoctorProbes): Promise<DoctorCheck> => {
  const ffmpeg = await resolveDoctorRuntimeTool(probes, 'ffmpeg')
  if (!ffmpeg) {
    return check('MISSING', 'music lyric-video renderer', 'ffmpeg not found', {
      severity: 'warn',
      nextStep: 'bun autoshow setup --step yt-dlp'
    })
  }

  const filters = await probes.run(ffmpeg.path, ['-hide_banner', '-filters'])
  if (filters.exitCode === 0 && hasFilter(filters.stdout, 'ass')) {
    return check('OK', 'music lyric-video renderer', 'ffmpeg ass filter available')
  }

  const pango = probes.which('pango-view')
  const convert = probes.which('convert')
  if (pango && convert) {
    return check('OK', 'music lyric-video renderer', `fallback renderer available: ${pango}, ${convert}`)
  }

  return check(
    'MISSING',
    'music lyric-video renderer',
    filters.exitCode === 0
      ? 'ffmpeg lacks ass filter and fallback requires pango-view plus ImageMagick convert'
      : `could not inspect ffmpeg filters and fallback requires pango-view plus ImageMagick convert: ${formatRunIssue(filters)}`,
    {
      severity: 'warn',
      nextStep: 'install ffmpeg with libass support, or install pango-view plus ImageMagick convert'
    }
  )
}

const collectSystemBuildToolChecks = async (probes: DoctorProbes): Promise<DoctorSection> => ({
  title: 'System/build tools',
  checks: [
    await checkUv(probes),
    checkCommand(probes, 'cmake', 'cmake', { nextStep: 'install cmake with your system package manager' }),
    await checkMusicRenderer(probes)
  ]
})

const fromLegacyCheck = (legacy: CheckResult, options: { nextStep: string }): DoctorCheck => {
  if (legacy.ok) {
    return check('OK', legacy.label, legacy.detail)
  }
  return check(
    legacy.detail.toLowerCase().includes('failed') ? 'WARN' : 'MISSING',
    legacy.label,
    legacy.detail,
    { severity: 'warn', nextStep: options.nextStep }
  )
}

const checkManagedBinary = async (
  probes: DoctorProbes,
  label: string,
  path: string,
  args: string[],
  options: { nextStep: string, okExitCodes?: number[] }
): Promise<DoctorCheck> => {
  if (!await probes.pathExists(path)) {
    return check('MISSING', label, `${path} not found`, {
      severity: 'warn',
      nextStep: options.nextStep
    })
  }

  const result = await probes.run(path, args)
  const okExitCodes = options.okExitCodes ?? [0]
  if (okExitCodes.includes(result.exitCode)) {
    const detail = result.stdout.trim() || result.stderr.trim() || path
    return check('OK', label, detail.length > 0 ? detail : path)
  }

  return check('WARN', label, `${path} failed ${args.join(' ')}: ${formatRunIssue(result)}`, {
    nextStep: options.nextStep
  })
}

const checkPythonImportRuntime = async (
  probes: DoctorProbes,
  label: string,
  envDir: string,
  importCode: string,
  nextStep: string
): Promise<DoctorCheck> => {
  const python = `${envDir}/bin/python`
  if (!await probes.pathExists(python)) {
    return check('MISSING', label, `${python} not found`, {
      severity: 'warn',
      nextStep
    })
  }

  const result = await probes.run(python, ['-c', importCode])
  return result.exitCode === 0
    ? check('OK', label, `${python} imports required packages`)
    : check('WARN', label, `${python} import check failed: ${formatRunIssue(result)}`, {
      nextStep
    })
}

const collectManagedRuntimeChecks = async (probes: DoctorProbes): Promise<DoctorSection> => ({
  title: 'Managed local runtimes',
  checks: [
    await checkRuntimeToolVersion(probes, 'yt-dlp', 'yt-dlp', ['--version'], {
      nextStep: 'bun autoshow setup --step yt-dlp'
    }),
    await checkRuntimeToolVersion(probes, 'ffmpeg', 'ffmpeg', ['-version'], {
      nextStep: 'bun autoshow setup --step yt-dlp'
    }),
    await checkRuntimeToolVersion(probes, 'ffprobe', 'ffprobe', ['-version'], {
      nextStep: 'bun autoshow setup --step yt-dlp'
    }),
    await checkRuntimeToolVersion(probes, 'mutool', 'mutool', ['-v'], {
      nextStep: 'bun autoshow setup --step calibre',
      okExitCodes: [0, 1],
      managedArtifactTool: 'mupdf'
    }),
    await checkRuntimeToolVersion(probes, 'ebook-convert', 'ebook-convert', ['--version'], {
      nextStep: 'bun autoshow setup --step calibre'
    }),
    await checkRuntimeToolVersion(probes, ACSM_FULFILL_COMMAND, ACSM_FULFILL_COMMAND, ['--version'], {
      nextStep: 'bun autoshow setup --step acsm'
    }),
    await checkRuntimeToolVersion(probes, 'tesseract', 'tesseract', ['--version'], {
      nextStep: 'bun autoshow setup'
    }),
    await checkTesseractEnglishData(probes),
    await checkRuntimeToolVersion(probes, 'qpdf', 'qpdf', ['--version'], {
      nextStep: 'bun autoshow setup --step calibre',
      managedArtifactTool: 'qpdf'
    }),
    await checkAcsmAuthorization(probes),
    fromLegacyCheck(await probes.readDefuddleCliReadiness(), { nextStep: 'bun autoshow setup --step defuddle' }),
    await checkManagedBinary(probes, 'runtime/bin/whisper-cli', whisperBinaryPath, ['--help'], {
      nextStep: 'bun autoshow setup --step whisper-binary'
    }),
    await checkManagedBinary(probes, 'runtime/bin/llama-server', llamaBinaryPath, ['--version'], {
      nextStep: 'bun autoshow setup --step llama-binary',
      okExitCodes: [0, 1]
    }),
    await checkPythonImportRuntime(
      probes,
      'Reverb Python env',
      reverbUvEnvDir,
      'import wenet, pyannote, torch',
      reverbSetupNextStep(probes)
    ),
    await checkPythonImportRuntime(
      probes,
      'Kitten TTS Python env',
      kittenTtsUvEnvDir,
      'from kittentts import KittenTTS; import soundfile',
      'bun autoshow setup --step tts'
    )
  ]
})

const checkModelFile = async (
  probes: DoctorProbes,
  label: string,
  path: string,
  nextStep: string
): Promise<DoctorCheck> =>
  await probes.pathExists(path)
    ? check('OK', label, path)
    : check('MISSING', label, `${path} not found`, { severity: 'warn', nextStep })

const collectInstalledWhisperModelsCheck = async (probes: DoctorProbes): Promise<DoctorCheck> => {
  const entries = await probes.listDirectory(whisperModelsDir)
  const modelFiles = entries
    .filter(name => /^ggml-.+\.bin$/.test(name))
    .sort()

  return check(
    'INFO',
    'installed whisper model files',
    modelFiles.length > 0 ? modelFiles.join(', ') : `none found in ${whisperModelsDir}`
  )
}

const collectLlamaManagedModelsCheck = async (probes: DoctorProbes): Promise<DoctorCheck> => {
  const metadata = await probes.readLlamaSetupModelMetadata()
  const models = Object.keys(metadata.models).sort()
  return check(
    'INFO',
    'llama setup-managed models',
    models.length > 0 ? models.join(', ') : `none recorded in ${llamaSetupModelsMetadataPath}`
  )
}

const checkReverbAssets = async (probes: DoctorProbes): Promise<DoctorCheck> => {
  const missing = await getMissingReverbAsrFiles(probes.pathExists)

  return missing.length === 0
    ? check('OK', 'Reverb ASR files', formatReverbAsrAssetPaths())
    : check('MISSING', 'Reverb ASR files', `missing ${missing.join(', ')}`, {
      severity: 'warn',
      nextStep: reverbSetupNextStep(probes)
    })
}

const checkReverbDiarization = async (probes: DoctorProbes): Promise<DoctorCheck> => {
  const missing = await getMissingReverbDiarizationFiles(probes.pathExists)

  return missing.length === 0
    ? check('OK', 'Reverb diarization cache', formatReverbDiarizationAssetPaths())
    : check('MISSING', 'Reverb diarization cache', `missing ${missing.join(', ')}`, {
      severity: 'warn',
      nextStep: reverbSetupNextStep(probes)
    })
}

// The marker records that setup ran, not that weights survived; the weights live
// in llama.cpp's own cache where nothing in runtime/ can vouch for them.
const checkLlamaModelReadiness = async (probes: DoctorProbes, model: string): Promise<DoctorCheck> => {
  const hasMarker = await probes.hasSetupManagedLlamaModel(model)
  const cachedWeights = await probes.listLlamaCacheEntries(model)
  const gguf = cachedWeights.filter((path) => path.endsWith('.gguf'))

  if (gguf.length > 0) {
    return check('OK', `llama model ${model}`, gguf.join(', '))
  }

  return check(
    'MISSING',
    `llama model ${model}`,
    hasMarker
      ? `setup-managed marker in ${llamaSetupModelsMetadataPath} but no weights in ${resolveLlamaCacheDir()}`
      : `no weights in ${resolveLlamaCacheDir()} and no marker in ${llamaSetupModelsMetadataPath}`,
    {
      severity: 'warn',
      nextStep: `bun autoshow setup --models ${model}`
    }
  )
}

// Like the llama weights, these live in a shared cache outside runtime/, so
// nothing under runtime/ can vouch for them.
const checkKittenTtsModelReadiness = async (probes: DoctorProbes, model: string): Promise<DoctorCheck> =>
  await probes.hasCachedKittenTtsModel(model)
    ? check('OK', `Kitten TTS model ${model}`, `cached in ${resolveHuggingFaceCacheDir()}`)
    : check('MISSING', `Kitten TTS model ${model}`, `not cached in ${resolveHuggingFaceCacheDir()}`, {
      severity: 'warn',
      nextStep: 'bun autoshow setup --step tts'
    })

const collectLocalModelAssetChecks = async (probes: DoctorProbes): Promise<DoctorSection> => ({
  title: 'Local model assets',
  checks: [
    await checkModelFile(
      probes,
      `default whisper model ${defaultWhisperModel}`,
      `${whisperModelsDir}/ggml-${defaultWhisperModel}.bin`,
      'bun autoshow setup --step whisper-model'
    ),
    await checkModelFile(
      probes,
      'music whisper model large-v3-turbo',
      `${whisperModelsDir}/ggml-large-v3-turbo.bin`,
      'bun autoshow setup'
    ),
    await collectInstalledWhisperModelsCheck(probes),
    await checkReverbAssets(probes),
    await checkReverbDiarization(probes),
    await checkLlamaModelReadiness(probes, defaultLlamaModel),
    await collectLlamaManagedModelsCheck(probes),
    await checkKittenTtsModelReadiness(probes, DEFAULT_KITTEN_TTS_MODEL)
  ]
})

const buildHostedProviderEnvChecks = (
  env: Record<string, string | undefined>,
  config?: AutoshowConfig
): DoctorCheck[] =>
  HOSTED_PROVIDER_ENV_CHECKS.map((provider) => {
    const value = env[provider.envVar]
    const set = typeof value === 'string' && value.trim().length > 0
    const configuredPaths = getHostedProviderConfiguredPaths(config, provider.configPaths)
    const label = `${provider.envVar} (${provider.label})`

    if (set) {
      return check('OK', label, 'set')
    }

    if (configuredPaths.length > 0) {
      return check('MISSING', label, `not set (configured: ${configuredPaths.join(', ')})`, {
        severity: 'warn',
        nextStep: `export ${provider.envVar}=...`
      })
    }

    return check('MISSING', label, 'not set (optional)', { severity: 'info' })
  })

const collectHostedProviderChecks = (
  probes: DoctorProbes,
  config?: AutoshowConfig
): DoctorSection => ({
  title: 'Hosted provider configuration',
  checks: buildHostedProviderEnvChecks(probes.env, config)
})

const collectConfigChecks = async (
  probes: DoctorProbes
): Promise<{ checks: DoctorCheck[], config?: AutoshowConfig }> => {
  const checks: DoctorCheck[] = []
  const configPath = await probes.resolveConfigPath()
  const configExists = await probes.pathExists(configPath)

  checks.push(configExists
    ? check('OK', 'config file', configPath)
    : check('INFO', 'config file', `${configPath} (not found)`, { severity: 'info' }))

  if (!configExists) {
    return { checks, config: {} }
  }

  try {
    const config = await probes.loadConfig(configPath)
    checks.push(check('OK', 'config valid', 'parseable JSON'))
    return { checks, config }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    checks.push(check('WARN', 'config valid', message, {
      nextStep: `fix ${configPath}`
    }))
    return { checks }
  }
}

const collectYoutubeCookieChecks = async (probes: DoctorProbes): Promise<DoctorCheck[]> => {
  const youtubeStatus = await probes.inspectYtDlpAuthState()
  const checks: DoctorCheck[] = [
    check('INFO', 'YouTube cookies mode', youtubeStatus.configuredMode)
  ]

  if (youtubeStatus.configuredMode === 'cookies-file') {
    const cookieDetail = youtubeStatus.resolvedCookiesPath ?? youtubeStatus.cookiesPath ?? 'not configured'
    checks.push(youtubeStatus.cookiesReadable === true
      ? check('OK', 'YouTube cookies file', cookieDetail)
      : check('MISSING', 'YouTube cookies file', cookieDetail, {
        severity: 'warn',
        nextStep: 'docs/cookies.md'
      }))
  } else if (youtubeStatus.configuredMode === 'cookies-from-browser') {
    checks.push(check('OK', 'YouTube cookies source', 'browser import via --cookies-from-browser'))
  } else {
    checks.push(check('INFO', 'YouTube cookies source', 'not configured'))
  }

  if (youtubeStatus.warning) {
    checks.push(check('WARN', 'YouTube cookies warning', youtubeStatus.warning, {
      nextStep: 'docs/cookies.md'
    }))
  }

  return checks
}

const collectConfigAndCookieChecks = async (
  probes: DoctorProbes
): Promise<{ section: DoctorSection, config?: AutoshowConfig }> => {
  const configResult = await collectConfigChecks(probes)
  const youtubeChecks = await collectYoutubeCookieChecks(probes)
  return {
    section: {
      title: 'Config and YouTube cookies',
      checks: [...configResult.checks, ...youtubeChecks]
    },
    ...(configResult.config ? { config: configResult.config } : {})
  }
}

export const collectDoctorNextSteps = (sections: readonly DoctorSection[]): string[] => {
  const steps = new Set<string>()
  for (const section of sections) {
    for (const item of section.checks) {
      if (item.severity === 'warn' && item.status !== 'OK' && item.nextStep) {
        steps.add(item.nextStep)
      }
    }
  }
  return [...steps]
}

const hasDoctorWarnings = (sections: readonly DoctorSection[]): boolean =>
  sections.some(section => section.checks.some(item => item.severity === 'warn' && item.status !== 'OK'))

export const collectDoctorReport = async (
  probeOverrides: Partial<DoctorProbes> = {}
): Promise<DoctorReport> => {
  const probes = createDoctorProbes(probeOverrides)
  const configAndCookies = await collectConfigAndCookieChecks(probes)
  const sections = [
    await collectSystemBuildToolChecks(probes),
    await collectManagedRuntimeChecks(probes),
    await collectLocalModelAssetChecks(probes),
    collectHostedProviderChecks(probes, configAndCookies.config),
    configAndCookies.section
  ]
  const hasWarnings = hasDoctorWarnings(sections)

  return {
    sections,
    hasWarnings,
    nextSteps: collectDoctorNextSteps(sections)
  }
}

const sectionHasWarnings = (section: DoctorSection): boolean =>
  section.checks.some(item => item.severity === 'warn' && item.status !== 'OK')

const logDoctorSection = (section: DoctorSection): void => {
  l.write(sectionHasWarnings(section) ? 'warn' : 'info', section.title, {
    category: 'command',
    humanTable: createHumanTable(
      section.checks.map((item) => ({
        status: item.status,
        check: item.label,
        detail: item.detail
      })),
      ['status', 'check', 'detail']
    )
  })
}

export const runDoctor = async (): Promise<void> => {
  await loadEnvFile()
  const report = await collectDoctorReport()

  for (const section of report.sections) {
    logDoctorSection(section)
  }

  l.write(report.hasWarnings ? 'warn' : 'success', 'Setup Doctor Summary', {
    category: 'command',
    humanTable: createHumanTable([
      {
        status: report.hasWarnings ? 'WARN' : 'OK',
        check: 'overall',
        detail: report.hasWarnings ? 'one or more local checks need attention' : 'no warning-level issues found'
      }
    ], ['status', 'check', 'detail'])
  })

  if (report.nextSteps.length > 0) {
    l.write('info', 'Setup Next Steps', {
      category: 'command',
      humanTable: createHumanTable(
        report.nextSteps.map((step, index) => ({
          step: index + 1,
          action: step
        })),
        ['step', 'action']
      )
    })
  }
}
