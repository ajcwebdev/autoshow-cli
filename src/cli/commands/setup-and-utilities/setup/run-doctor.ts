import { verifyWhisperfileArtifact } from '~/cli/commands/stt/local/whisperfile/whisperfile-integrity'
import { WHISPERFILE_ARTIFACTS } from '~/cli/commands/stt/local/whisperfile/whisperfile-artifacts'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveYtDlpBinaryInfo } from '~/cli/commands/command-shared/shared-yt-dlp-binary'
import { inspectYtDlpAuthState } from '~/cli/commands/command-shared/shared-yt-dlp-options'
import { defuddleRuntimeDir } from '~/cli/commands/text/url/url-local/defuddle/defuddle-cli'
import { loadConfig, resolveConfigPath } from '~/cli/commands/setup-and-utilities/config-command/config-loader'
import type { AutoshowConfig, DoctorCheck, DoctorProbes, DoctorReport, DoctorSection, DoctorSeverity, DoctorStatus, DoctorToolProvenance, ManagedArtifactToolId, RunResult, RuntimeToolId } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { getHostedProviderConfiguredPaths, getMissingConfiguredHostedProviderCredentials, HOSTED_PROVIDER_ENV_CHECKS } from './hosted-provider-config'
import { whisperfileBinaryPath, whisperfileDir } from './run-complete-setup'
import { DEFAULT_WHISPERFILE_MODEL } from '../models/stt-models'
import {
  ebookConvertManagedBinaryPath,
  assertRuntimeContainedPath,
  englishTrainedDataPath,
  ffmpegManagedBinaryPath,
  ffprobeManagedBinaryPath,
  getConfiguredBinDir,
  getRuntimeToolManagedPath,
  mutoolManagedBinaryPath,
  qpdfManagedBinaryPath,
  resolveTessdataPrefix,
  resolveRuntimeToolInfo,
  tesseractManagedBinaryPath,
  tessdataHocrConfigPath,
  ytDlpManagedBinaryPath
} from '~/utils/runtime-paths'
import { pathExists } from '~/utils/filesystem'
import { AppUsageError } from '~/utils/error-handler'
import { hintsForMissingEnv, resolveCredential } from '~/utils/validate/env-utils'
import { isSupportedBunVersion, SUPPORTED_BUN_VERSION } from '~/utils/bun-version'
import { inspectTesseractEnglishData } from '~/utils/tesseract-language-data'
import { createDoctorToolProvenance } from './doctor-tool-provenance'
import { canSandboxDoctorProcesses, runReadOnlyDoctorProcess } from './doctor-read-only-process'
import { RUNTIME_FONT_CACHE_DIR } from '~/utils/runtime-state'
import { validateReadOnlyEnglishData } from './doctor-english-data'
import { supportsImageMagickTiffRead } from './rendering-readiness'

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
      if (entry.name === '.DS_Store') continue
      const path = join(root, entry.name)
      if (entry.isFile()) return true
      if (entry.isDirectory() && await directoryHasAnyFiles(path)) return true
    }
    return false
  } catch {
    return false
  }
}

const createDoctorProbes = (overrides: Partial<DoctorProbes> = {}): DoctorProbes => {
  const provenance = createDoctorToolProvenance()
  const modelChecks = new Map<string, Promise<DoctorToolProvenance>>()
  return {
  bunVersion: Bun.version,
  platform: process.platform,
  env: process.env as Record<string, string | undefined>,
  which: (command) => Bun.which(command) ?? undefined,
  pathExists: pathExists,
  listDirectory: listNames,
  directoryHasFiles: directoryHasAnyFiles,
  executeReadOnlyTools: canSandboxDoctorProcesses(),
  validateTesseractData: validateReadOnlyEnglishData,
  ...provenance,
  validateWhisperfile: async (model, path) => {
    const key = `${model}:${path}`
    let result = modelChecks.get(key)
    if (!result) {
      result = (async (): Promise<DoctorToolProvenance> => {
        try {
          assertRuntimeContainedPath(path)
          const expected = WHISPERFILE_ARTIFACTS[model]
          if (!expected) return { healthy: false, reason: 'No pinned artifact is registered for this Whisperfile model.' }
          await verifyWhisperfileArtifact(path, expected)
          if (((await stat(path)).mode & 0o111) === 0) return { healthy: false, reason: 'Pinned Whisperfile artifact is not executable.' }
          return { healthy: true, detail: 'Pinned model bytes and executable permissions verified; executable probe omitted in read-only diagnostics.' }
        } catch (error) { return { healthy: false, reason: error instanceof Error ? error.message : String(error) } }
      })()
      modelChecks.set(key, result)
    }
    return await result
  },
  run: runReadOnlyDoctorProcess,
  resolveTessdataPrefix,
  resolveYtDlpBinaryInfo,
  readDefuddleCliReadiness: async () => {
    const result = await provenance.validateDefuddleRuntime()
    return result.healthy
      ? { label: 'defuddle', status: 'OK', detail: result.detail, severity: 'info' }
      : { label: 'defuddle', status: await pathExists(defuddleRuntimeDir) ? 'WARN' : 'MISSING', detail: result.reason, severity: 'warn', nextStep: 'bun autoshow setup --step defuddle' }
  },
  resolveConfigPath,
  loadConfig: async path => await loadConfig(path, { allowLegacyFallback: true }),
  inspectYtDlpAuthState,
  validateManagedArtifact: async tool => {
    const id = tool === 'mupdf' ? 'mutool' : 'qpdf'
    const result = await provenance.validateRuntimeTool(id, getRuntimeToolManagedPath(id))
    return result.healthy && result.version
      ? { healthy: true, distribution: 'source', version: result.version, platform: 'darwin', architecture: process.arch }
      : { healthy: false, reason: result.healthy ? 'Managed source identity has no pinned version.' : result.reason }
  },
  ...overrides
  }
}

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

const DOCTOR_RUNTIME_TOOLS: Partial<Record<RuntimeToolId, { managedPath: string }>> = {
  ffmpeg: { managedPath: ffmpegManagedBinaryPath },
  ffprobe: { managedPath: ffprobeManagedBinaryPath },
  'yt-dlp': { managedPath: ytDlpManagedBinaryPath },
  mutool: { managedPath: mutoolManagedBinaryPath },
  'ebook-convert': { managedPath: ebookConvertManagedBinaryPath },
  tesseract: { managedPath: tesseractManagedBinaryPath },
  qpdf: { managedPath: qpdfManagedBinaryPath }
}

const resolveDoctorRuntimeTool = async (
  probes: DoctorProbes,
  id: RuntimeToolId
): Promise<{ path: string, source: 'override' | 'managed' | 'path' } | undefined> => {
  if (probes.pathExists === pathExists) return resolveRuntimeToolInfo(id)
  const metadata = DOCTOR_RUNTIME_TOOLS[id]
  const overrideDir = getConfiguredBinDir()?.trim()
  if (overrideDir) {
    const overridePath = join(overrideDir, id)
    if (await probes.pathExists(overridePath)) return { path: overridePath, source: 'override' }
  }
  const managedPath = metadata?.managedPath ?? getRuntimeToolManagedPath(id)
  if (await probes.pathExists(managedPath)) return { path: managedPath, source: 'managed' }
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

  const provenance = await probes.validateRuntimeTool(id, resolved.path)
  if (!provenance.healthy) return check('WARN', label, `${resolved.path} has unhealthy provenance: ${provenance.reason}`, { nextStep: options.nextStep })

  let sourceDetail: string = resolved.source
  let expectedManagedVersion: string | undefined = provenance.version
  if (resolved.source === 'managed' && options.managedArtifactTool && probes.platform === 'darwin') {
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

  if (!probes.executeReadOnlyTools || id === 'ebook-convert' || (id === 'yt-dlp' && probes.platform === 'darwin')) return check('OK', label, `${resolved.path} (${sourceDetail}); ${provenance.detail}; executable probe deferred to mutating setup`)

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

const formatRunIssue = (result: RunResult): string => {
  const details = result.stderr.trim() || result.stdout.trim() || `exit code ${result.exitCode}`
  return details.length > 300 ? `${details.slice(0, 300)}...` : details
}

const checkTesseractEnglishData = async (probes: DoctorProbes): Promise<DoctorCheck> => {
  const resolved = await resolveDoctorRuntimeTool(probes, 'tesseract')
  if (!resolved) {
    return check('MISSING', 'Tesseract eng data', 'tesseract not found', {
      severity: 'warn',
      nextStep: 'bun autoshow setup --step ocr'
    })
  }

  const provenance = await probes.validateRuntimeTool('tesseract', resolved.path)
  if (!provenance.healthy) return check('WARN', 'Tesseract eng data', `Managed OCR provenance is invalid: ${provenance.reason}`, { nextStep: 'bun autoshow setup --step ocr' })

  if (probes.platform === 'darwin' && resolved.source === 'managed' && !await probes.pathExists(englishTrainedDataPath)) {
    return check('MISSING', 'Tesseract eng data', `${englishTrainedDataPath} not found`, {
      severity: 'warn',
      nextStep: 'bun autoshow setup --step ocr'
    })
  }

  if (probes.platform === 'darwin' && resolved.source === 'managed' && !await probes.pathExists(tessdataHocrConfigPath)) {
    return check('MISSING', 'Tesseract eng data', `${tessdataHocrConfigPath} not found`, {
      severity: 'warn',
      nextStep: 'bun autoshow setup --step ocr'
    })
  }
  try {
    const prefix = probes.resolveTessdataPrefix()
    const data = await probes.validateTesseractData(prefix)
    if (!data.healthy) return check('WARN', 'Tesseract eng data', data.reason, { nextStep: 'bun autoshow setup --step ocr' })
    if (!probes.executeReadOnlyTools) return check('OK', 'Tesseract eng data', data.detail)
    const result = await inspectTesseractEnglishData(async args => await probes.run(resolved.path, args, {
      env: { TESSDATA_PREFIX: prefix }
    }))
    return result.status === 'ready'
      ? check('OK', 'Tesseract eng data', `eng initialized (${resolved.source}, TESSDATA_PREFIX=${prefix ?? 'Tesseract packaged default'})`)
      : check(result.status === 'missing' ? 'MISSING' : 'WARN', 'Tesseract eng data', result.detail, {
        severity: 'warn',
        nextStep: 'bun autoshow setup --step ocr'
      })
  } catch (error) {
    return check('WARN', 'Tesseract eng data', error instanceof Error ? error.message : String(error), {
      severity: 'warn',
      nextStep: 'bun autoshow setup --step ocr'
    })
  }
}

const hasFilter = (filtersOutput: string, filterName: string): boolean =>
  filtersOutput.split('\n').some((line) => line.trim().split(/\s+/).includes(filterName))

const checkMusicRenderer = async (probes: DoctorProbes): Promise<DoctorCheck> => {
  const ffmpeg = await resolveDoctorRuntimeTool(probes, 'ffmpeg')
  if (!ffmpeg) {
    return check('MISSING', 'music lyric-video renderer', 'ffmpeg not found', {
      severity: 'warn',
      nextStep: 'bun autoshow setup --step rendering'
    })
  }

  const provenance = await probes.validateRuntimeTool('ffmpeg', ffmpeg.path)
  if (!provenance.healthy) return check('WARN', 'music lyric-video renderer', `Managed media provenance is invalid: ${provenance.reason}`, { nextStep: 'bun autoshow setup --step rendering' })
  if (!probes.executeReadOnlyTools) return check('OK', 'music lyric-video renderer', `${provenance.detail}; rendering capabilities are checked during mutating setup.`)

  const filters = await probes.run(ffmpeg.path, ['-hide_banner', '-filters'])
  if (filters.exitCode === 0 && hasFilter(filters.stdout, 'ass')) {
    return check('OK', 'music lyric-video renderer', 'ffmpeg ass filter available')
  }

  const pango = await resolveDoctorRuntimeTool(probes, 'pango-view')
  const convert = await resolveDoctorRuntimeTool(probes, 'magick') ?? await resolveDoctorRuntimeTool(probes, 'convert')
  if (pango && convert) {
    const [pangoProvenance, imageProvenance] = await Promise.all([
      probes.validateRuntimeTool('pango-view', pango.path),
      probes.validateRuntimeTool(convert.path.endsWith('/convert') ? 'convert' : 'magick', convert.path)
    ])
    if (!pangoProvenance.healthy || !imageProvenance.healthy) return check('WARN', 'music lyric-video renderer', `Managed fallback provenance is invalid: ${!pangoProvenance.healthy ? pangoProvenance.reason : !imageProvenance.healthy ? imageProvenance.reason : ''}`, { nextStep: 'bun autoshow setup --step rendering' })
    const [pangoVersion, imageVersion] = await Promise.all([
      probes.run(pango.path, ['--version']), probes.run(convert.path, ['-version'])
    ])
    if (pangoVersion.exitCode === 0 && imageVersion.exitCode === 0) return check('OK', 'music lyric-video renderer', `managed fallback renderer available: ${pango.path}, ${convert.path}`)
  }

  return check(
    'MISSING',
    'music lyric-video renderer',
    filters.exitCode === 0
      ? 'ffmpeg lacks ass filter and fallback requires pango-view plus ImageMagick convert'
      : `could not inspect ffmpeg filters and fallback requires pango-view plus ImageMagick convert: ${formatRunIssue(filters)}`,
    {
      severity: 'warn',
      nextStep: 'bun autoshow setup --step rendering'
    }
  )
}

const checkBunRuntime = (runtimeVersion: string): DoctorCheck =>
  isSupportedBunVersion(runtimeVersion)
    ? check('OK', 'Bun runtime', `${runtimeVersion} (supported)`)
    : check('WARN', 'Bun runtime', `${runtimeVersion} installed; ${SUPPORTED_BUN_VERSION} required`, {
      nextStep: `install Bun ${SUPPORTED_BUN_VERSION}`
    })

const checkImageMagickReadiness = async (probes: DoctorProbes): Promise<DoctorCheck> => {
  const imageMagick = await resolveDoctorRuntimeTool(probes, 'magick') ?? await resolveDoctorRuntimeTool(probes, 'convert')
  if (!imageMagick) return check('MISSING', 'ImageMagick sheets and TIFF', 'Managed ImageMagick is missing', { severity: 'warn', nextStep: 'bun autoshow setup --step rendering' })
  const provenance = await probes.validateRuntimeTool(imageMagick.path.endsWith('/convert') ? 'convert' : 'magick', imageMagick.path)
  if (!provenance.healthy) return check('WARN', 'ImageMagick sheets and TIFF', `Managed image provenance is invalid: ${provenance.reason}`, { nextStep: 'bun autoshow setup --step rendering' })
  if (!probes.executeReadOnlyTools) return check('OK', 'ImageMagick sheets and TIFF', `${provenance.detail}; image codec capabilities are checked during mutating setup.`)
  const formats = await probes.run(imageMagick.path, ['-list', 'format'])
  return formats.exitCode === 0 && supportsImageMagickTiffRead(formats.stdout)
    ? check('OK', 'ImageMagick sheets and TIFF', `${imageMagick.path} (${imageMagick.source}), TIFF reading available`)
    : check('WARN', 'ImageMagick sheets and TIFF', 'Managed ImageMagick does not report TIFF reading support', { nextStep: 'bun autoshow setup --step rendering' })
}

const checkManagedFonts = async (probes: DoctorProbes): Promise<DoctorCheck> => {
  const fontconfig = await resolveDoctorRuntimeTool(probes, 'fc-match')
  if (!fontconfig) return check('MISSING', 'Managed rendering fonts', 'Managed Fontconfig is missing', { severity: 'warn', nextStep: 'bun autoshow setup --step rendering' })
  const provenance = await probes.validateRuntimeTool('fc-match', fontconfig.path)
  if (!provenance.healthy) return check('WARN', 'Managed rendering fonts', `Managed font provenance is invalid: ${provenance.reason}`, { nextStep: 'bun autoshow setup --step rendering' })
  const configuration = await probes.validateRenderingConfiguration()
  if (!configuration.healthy) return check('WARN', 'Managed rendering fonts', `Managed rendering resources are invalid: ${configuration.reason}`, { nextStep: 'bun autoshow setup --step rendering' })
  if (!probes.executeReadOnlyTools) return check('OK', 'Managed rendering fonts', `${configuration.detail}; font matching is checked during mutating setup.`)
  if (!await probes.directoryHasFiles(RUNTIME_FONT_CACHE_DIR)) return check('WARN', 'Managed rendering fonts', 'Managed font cache is absent; font matching was not executed because diagnostics cannot populate caches.', { nextStep: 'bun autoshow setup --step rendering' })
  const font = await probes.run(fontconfig.path, ['-f', '%{family}', 'DejaVu Sans'])
  return font.exitCode === 0 && font.stdout.includes('DejaVu Sans')
    ? check('OK', 'Managed rendering fonts', `${fontconfig.path} (${fontconfig.source}), DejaVu Sans available`)
    : check('WARN', 'Managed rendering fonts', 'Managed DejaVu Sans is unavailable', { nextStep: 'bun autoshow setup --step rendering' })
}

const collectSystemBuildToolChecks = async (probes: DoctorProbes): Promise<DoctorSection> => ({
  title: 'Managed tools and rendering',
  checks: [
    checkBunRuntime(probes.bunVersion),
    ...(probes.platform === 'darwin' ? [await checkRuntimeToolVersion(probes, 'Managed CMake', 'cmake', ['--version'], { nextStep: 'bun autoshow setup --step toolchain' })] : []),
    await checkRuntimeToolVersion(probes, 'Managed Bun worker', 'bun', ['--version'], { nextStep: 'bun autoshow setup --step toolchain' }),
    await checkRuntimeToolVersion(probes, 'Downloader JavaScript runtime', 'deno', ['--version'], { nextStep: 'bun autoshow setup --step toolchain' }),
    await checkMusicRenderer(probes),
    await checkImageMagickReadiness(probes),
    await checkManagedFonts(probes)
  ]
})

const checkWhisperfileBinary = async (
  probes: DoctorProbes,
  label: string,
  path: string,
  options: { nextStep: string }
): Promise<DoctorCheck> => {
  if (!await probes.pathExists(path)) {
    return check('MISSING', label, `${path} not found`, {
      severity: 'warn',
      nextStep: options.nextStep
    })
  }

  const model = label.startsWith('whisperfile ') ? label.slice('whisperfile '.length) : DEFAULT_WHISPERFILE_MODEL
  const provenance = await probes.validateWhisperfile(model, path)
  return provenance.healthy ? check('OK', label, provenance.detail) : check('WARN', label, provenance.reason, { nextStep: options.nextStep })
}

const collectManagedRuntimeChecks = async (probes: DoctorProbes): Promise<DoctorSection> => {
  const defuddle = await probes.readDefuddleCliReadiness()
  const alignment = await probes.validateAlignmentRuntime()
  const project = await probes.validateProjectDependencies()
  return {
    title: 'Managed local runtimes',
    checks: [
      project.healthy
        ? check('OK', 'Source project dependencies', project.detail)
        : check('WARN', 'Source project dependencies', project.reason, { nextStep: 'bun install --frozen-lockfile' }),
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
      await checkRuntimeToolVersion(probes, 'tesseract', 'tesseract', ['--version'], {
        nextStep: 'bun autoshow setup --step ocr'
      }),
      await checkTesseractEnglishData(probes),
      await checkRuntimeToolVersion(probes, 'qpdf', 'qpdf', ['--version'], {
        nextStep: 'bun autoshow setup --step calibre',
        managedArtifactTool: 'qpdf'
      }),
      defuddle.status === 'OK' || defuddle.nextStep
        ? defuddle
        : { ...defuddle, nextStep: 'bun autoshow setup --step defuddle' },
      alignment.healthy
        ? check('OK', 'Local alignment runtime', alignment.detail)
        : check('WARN', 'Local alignment runtime', alignment.reason, { nextStep: 'bun autoshow setup --step alignment' }),
      await checkWhisperfileBinary(probes, 'whisperfile tiny', whisperfileBinaryPath(DEFAULT_WHISPERFILE_MODEL), {
        nextStep: 'bun autoshow setup --step whisperfile'
      })
    ]
  }
}

const checkModelFile = async (
  probes: DoctorProbes,
  label: string,
  path: string,
  nextStep: string
): Promise<DoctorCheck> =>
  await probes.pathExists(path)
    ? check('OK', label, path)
    : check('MISSING', label, `${path} not found`, { severity: 'warn', nextStep })

const collectInstalledWhisperfileModelsCheck = async (probes: DoctorProbes): Promise<DoctorCheck> => {
  const entries = await probes.listDirectory(whisperfileDir)
  const modelFiles = entries
    .filter(name => /^whisper-.+\.llamafile$/.test(name))
    .sort()

  return check(
    'INFO',
    'installed whisperfile model files',
    modelFiles.length > 0 ? modelFiles.join(', ') : `none found in ${whisperfileDir}`
  )
}

const collectLocalModelAssetChecks = async (probes: DoctorProbes): Promise<DoctorSection> => ({
  title: 'Local model assets',
  checks: [
    await checkModelFile(
      probes,
      `default whisperfile model ${DEFAULT_WHISPERFILE_MODEL}`,
      whisperfileBinaryPath(DEFAULT_WHISPERFILE_MODEL),
      'bun autoshow setup --step whisperfile'
    ),
    await collectInstalledWhisperfileModelsCheck(probes)
  ]
})

const buildHostedProviderEnvChecks = (
  env: Record<string, string | undefined>,
  config?: AutoshowConfig
): DoctorCheck[] =>
  HOSTED_PROVIDER_ENV_CHECKS.map((provider) => {
    const set = resolveCredential(provider.providerId, 'observe', { env }).available
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
        nextStep: 'docs/commands/00-setup-and-utilities/cookies.md'
      }))
  } else if (youtubeStatus.configuredMode === 'cookies-from-browser') {
    checks.push(check('OK', 'YouTube cookies source', 'browser import via bun autoshow setup --cookies-from-browser'))
  } else {
    checks.push(check('INFO', 'YouTube cookies source', 'not configured — bun autoshow setup --cookies-from-browser chrome'))
  }

  if (youtubeStatus.warning) {
    checks.push(check('WARN', 'YouTube cookies warning', youtubeStatus.warning, {
      nextStep: 'docs/commands/00-setup-and-utilities/cookies.md'
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
  const missingConfiguredCredentialEnvVars = getMissingConfiguredHostedProviderCredentials(
    probes.env,
    configAndCookies.config
  ).map(provider => provider.envVar)
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
    missingConfiguredCredentialEnvVars,
    nextSteps: collectDoctorNextSteps(sections)
  }
}

const logDoctorSection = (section: DoctorSection): void => {
  const warnings = section.checks.filter(item => item.severity === 'warn' && item.status !== 'OK')
  l.debug(`${section.title}: ${section.checks.length - warnings.length}/${section.checks.length} checks passed`, {
    category: 'command',
    metadata: { section: section.title, checks: section.checks }
  })
  for (const item of warnings) {
    l.write('warn', `${section.title}: ${item.label} ${item.status} — ${item.detail}`, {
      category: 'command',
      metadata: { section: section.title, check: item }
    })
  }
}

export const runDoctor = async (
  options: { strict?: boolean, probeOverrides?: Partial<DoctorProbes> } = {}
): Promise<DoctorReport> => {
  const report = await collectDoctorReport(options.probeOverrides)

  for (const section of report.sections) {
    logDoctorSection(section)
  }

  const totalChecks = report.sections.reduce((total, section) => total + section.checks.length, 0)
  const warningChecks = report.sections.flatMap(section => section.checks).filter(item => item.severity === 'warn' && item.status !== 'OK').length
  l.write(report.hasWarnings ? 'warn' : 'info', `Setup doctor: ${totalChecks - warningChecks}/${totalChecks} checks passed, ${warningChecks} warnings`, {
    category: 'command',
    metadata: { hasWarnings: report.hasWarnings, totalChecks, warningChecks }
  })

  if (report.nextSteps.length > 0) {
    l.write('info', `${report.nextSteps.length} setup next steps available`, {
      category: 'command',
      metadata: { nextSteps: report.nextSteps }
    })
  }

  if (options.strict && report.hasWarnings) {
    const missing = report.missingConfiguredCredentialEnvVars
    throw new AppUsageError(missing.length > 0 ? `Credential check failed: configured defaults require ${missing.join(', ')}.` : 'Strict doctor failed: resolve the reported configuration, cookie, runtime or model readiness warnings.', {
      hints: [...missing.flatMap(hintsForMissingEnv), ...report.nextSteps],
        stage: 'setup:doctor',
        retryable: false,
        metadata: { missingCredentialEnvVars: missing }
    })
  }

  return report
}
