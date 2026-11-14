import { withProcessLock } from '~/utils/process-lock'
import { cp, mkdir, readdir, realpath, rename, rm, symlink } from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'
import { readDependencyUrlAndSha256, readDependencyVersion } from '~/cli/commands/setup-and-utilities/setup/dependency-metadata'
import { runCapture, runInherit } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { pathExists } from '~/utils/filesystem'
import { downloadFile } from '~/cli/commands/setup-and-utilities/setup/setup-download/download'
import { installDmgApp } from '~/cli/commands/setup-and-utilities/setup/setup-download/dmg'
import { recordSetupPerformancePhase } from '~/cli/commands/setup-and-utilities/setup/setup-performance'
import {
  assertPortableQpdfDynamicLibraryClosure,
  buildLibjpegTurboCmakeArguments,
  buildQpdfCmakeArguments,
  buildQpdfSourceEnvironment,
  QPDF_SOURCE_RECIPE_STAMP,
  resolveQpdfSourceBuildLayout
} from '~/cli/commands/setup-and-utilities/setup/setup-download/qpdf-source-build'
import { buildMupdfMakeArguments } from '~/cli/commands/setup-and-utilities/setup/setup-download/mupdf-source-build'
import {
  createManagedToolStagingDirectory,
  promoteManagedToolDirectory,
  recoverManagedToolDirectory,
  resolveSourceDeploymentTarget,
  validateManagedSourceArtifact,
  writeManagedSourceArtifactManifest
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact'
import type { DownloadFlowId, ManagedArtifactDependency, ManagedArtifactSource, ManagedDynamicLibraryClosureResult, ManagedSourceRecipe, ManagedSourcePayloadFile } from '~/types'
import { InfraError } from '~/utils/error-handler'
import { logicalCpuCount } from '~/utils/logical-cpu-count'
import { makeExecutable } from '~/utils/filesystem'
import * as l from '~/utils/app-logger/app-logger'
import { sha256File } from './managed-source-artifact'
import { collectManagedSourcePayload, isContainedManagedPath, managedSourcePayloadIssue } from './managed-artifact-payload'
import { ensureManagedBuildTools, managedBuildToolPath } from './managed-build-tools'
import {
  ensureManagedNativeDependency,
  managedNativeBuildEnv,
  nativeDependencyPrefix,
  normalizeManagedNativeMetadata,
  readManagedNativeDependencyIdentity,
  type NativeDependencyName
} from './managed-native-dependencies'
import { assertManagedDynamicLibraryClosure } from './managed-artifact-closure'
import { extractTarGzFile } from './tar-gz'
import { getRuntimeCachePath } from '~/utils/runtime-state'
import { managedToolchainNoticePlan } from './managed-toolchain-distribution-policy'
import {
  ebookConvertManagedBinaryPath,
  englishTrainedDataPath,
  ffmpegBuildDir,
  ffmpegInstalledBinaryPath,
  ffmpegManagedBinaryPath,
  ffmpegToolDir,
  ffprobeInstalledBinaryPath,
  ffprobeManagedBinaryPath,
  lameBuildDir,
  lameToolDir,
  leptonicaBuildDir,
  leptonicaToolDir,
  mupdfBuildDir,
  mupdfToolDir,
  mutoolInstalledBinaryPath,
  mutoolManagedBinaryPath,
  qpdfBuildDir,
  qpdfInstalledBinaryPath,
  qpdfManagedBinaryPath,
  qpdfToolDir,
  calibreAppPath,
  calibreToolDir,
  assertRuntimeContainedPath,
  toProjectDisplayPath,
  tessdataDir,
  tesseractBuildDir,
  tesseractManagedBinaryPath,
  tesseractToolDir,
  ytDlpManagedBinaryPath
} from '~/utils/runtime-paths'

const resolveSetupSourceBuildParallelJobs = (): number => Math.min(logicalCpuCount(), 8)
const preserveStagedFailure = (stagingDir: string, error: unknown): never => {
  l.warn('Managed staged installation was preserved after failure', {
    category: 'artifact', metadata: { stagingDir: toProjectDisplayPath(stagingDir) }
  })
  throw error
}
export type ManagedMacosInstallOptions = { forceRedownload?: boolean }
const leptonicaCmakeConfigDir = join(leptonicaToolDir, 'lib/cmake/leptonica')
const tesseractInstalledTessdataDir = join(tesseractToolDir, 'share/tessdata')
const managedTessdataSupportDirs = ['configs', 'tessconfigs'] as const
const clearDynamicLibraryOverrides = 'unset DYLD_LIBRARY_PATH DYLD_FALLBACK_LIBRARY_PATH DYLD_FRAMEWORK_PATH DYLD_FALLBACK_FRAMEWORK_PATH DYLD_INSERT_LIBRARIES DYLD_ROOT_PATH DYLD_VERSIONED_LIBRARY_PATH DYLD_VERSIONED_FRAMEWORK_PATH DYLD_FORCE_FLAT_NAMESPACE DYLD_BIND_AT_LAUNCH'

const ensureParentDir = async (path: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true })
}

const recreateDir = async (path: string): Promise<void> => {
  assertRuntimeContainedPath(path)
  await rm(path, { recursive: true, force: true })
  await mkdir(path, { recursive: true })
}

const createSymlinkShim = async (target: string, linkPath: string): Promise<void> => {
  assertRuntimeContainedPath(target)
  assertRuntimeContainedPath(linkPath)
  await ensureParentDir(linkPath)
  const tempPath = `${linkPath}.tmp-${crypto.randomUUID()}`
  try {
    await symlink(relative(dirname(linkPath), target), tempPath)
    await rename(tempPath, linkPath)
  } finally {
    await rm(tempPath, { force: true })
  }
}

const writeExecutableScript = async (path: string, content: string): Promise<void> => {
  assertRuntimeContainedPath(path)
  await ensureParentDir(path)
  const tempPath = `${path}.tmp-${crypto.randomUUID()}`
  try {
    await Bun.write(tempPath, content)
    await makeExecutable(tempPath)
    await rename(tempPath, path)
  } finally {
    await rm(tempPath, { force: true })
  }
}

export const buildManagedTesseractWrapperScript = (): string => `#!/bin/sh
${clearDynamicLibraryOverrides}
tesseract_runtime_dir=$(CDPATH= cd -P "$(/usr/bin/dirname "$0")/.." && pwd -P) || exit 1
export TESSDATA_PREFIX="$tesseract_runtime_dir/tools/tessdata"
exec "$tesseract_runtime_dir/tools/tesseract/bin/tesseract" "$@"
`

export const buildManagedQpdfWrapperScript = (
  installedBinaryPath = qpdfInstalledBinaryPath
): string => {
  const relativeBinary = relative(dirname(dirname(dirname(dirname(installedBinaryPath)))), installedBinaryPath)
  return `#!/bin/sh
${clearDynamicLibraryOverrides}
qpdf_runtime_dir=$(CDPATH= cd -P "$(/usr/bin/dirname "$0")/.." && pwd -P) || exit 1
exec "$qpdf_runtime_dir/${relativeBinary}" "$@"
`
}

const assertManagedSourceInstallAt = async (
  tool: 'mupdf' | 'qpdf',
  toolDir: string
): Promise<string> => {
  const validation = await validateManagedSourceArtifact(tool, { toolDir })
  if (!validation.healthy) {
    throw InfraError(`Managed ${tool} provenance validation failed: ${validation.reason}`, {
      stage: `setup:${tool}`
    })
  }

  const binaryPath = join(toolDir, tool === 'mupdf' ? 'bin/mutool' : 'bin/qpdf')
  const args = tool === 'mupdf' ? ['-v'] : ['--version']
  const okExitCodes = tool === 'mupdf' ? [0, 1] : [0]
  const result = await runCapture(binaryPath, args, { allowFailure: true })
  const output = `${result.stdout}\n${result.stderr}`
  if (!okExitCodes.includes(result.exitCode) || !output.includes(validation.version)) {
    throw InfraError(
      `Managed ${tool} failed its ${args.join(' ')} version check for ${validation.version}`,
      { stage: `setup:${tool}` }
    )
  }
  return validation.version
}

export const hasHealthyManagedSourceInstall = async (tool: 'mupdf' | 'qpdf'): Promise<boolean> => {
  try {
    const version = await assertManagedSourceInstallAt(tool, tool === 'mupdf' ? mupdfToolDir : qpdfToolDir)
    const managedPath = tool === 'mupdf' ? mutoolManagedBinaryPath : qpdfManagedBinaryPath
    const args = tool === 'mupdf' ? ['-v'] : ['--version']
    const okExitCodes = tool === 'mupdf' ? [0, 1] : [0]
    const result = await runCapture(managedPath, args, { allowFailure: true })
    if (!okExitCodes.includes(result.exitCode) || !`${result.stdout}\n${result.stderr}`.includes(version)) return false
    return true
  } catch {
    return false
  }
}

const hasValidManagedSourcePayload = async (tool: 'mupdf' | 'qpdf'): Promise<boolean> => {
  try {
    await assertManagedSourceInstallAt(tool, tool === 'mupdf' ? mupdfToolDir : qpdfToolDir)
    return true
  } catch {
    return false
  }
}

const nativeCodecDependencies = ['zlib', 'libpng', 'libjpeg-turbo', 'libtiff'] as const satisfies readonly NativeDependencyName[]
const ffmpegNativeDependencies = ['libass', 'x264', 'zlib'] as const satisfies readonly NativeDependencyName[]

export const ensureManagedMacosSourceDependencies = async (
  nativeDependencies: readonly NativeDependencyName[],
  sourceInstallers: readonly ((options: ManagedMacosInstallOptions) => Promise<void>)[],
  options: ManagedMacosInstallOptions = {},
  services = { buildTools: ensureManagedBuildTools, nativeDependency: ensureManagedNativeDependency }
): Promise<void> => {
  await services.buildTools(options)
  await Promise.all(nativeDependencies.map(name => services.nativeDependency(name, options)))
  for (const install of sourceInstallers) await install(options)
}

export const MANAGED_FFMPEG_BUILD_FLAGS = [
  '--disable-doc', '--disable-debug', '--disable-ffplay', '--disable-autodetect',
  '--enable-gpl', '--enable-libmp3lame', '--enable-libass', '--enable-libx264',
  '--enable-zlib', '--enable-securetransport', '--enable-audiotoolbox', '--enable-videotoolbox', '--pkg-config-flags=--static'
] as const

export const MANAGED_LEPTONICA_BUILD_FLAGS = [
  '-DCMAKE_BUILD_TYPE=Release', '-DBUILD_SHARED_LIBS=OFF',
  '-DCMAKE_FIND_USE_PACKAGE_REGISTRY=OFF', '-DCMAKE_FIND_USE_SYSTEM_PACKAGE_REGISTRY=OFF',
  '-DENABLE_WEBP=OFF', '-DENABLE_OPENJPEG=OFF', '-DBUILD_PROG=OFF', '-DSW_BUILD=OFF'
] as const

export const MANAGED_TESSERACT_BUILD_FLAGS = [
  '-DCMAKE_BUILD_TYPE=Release', '-DBUILD_SHARED_LIBS=OFF', '-DBUILD_TESTS=OFF',
  '-DCMAKE_FIND_USE_PACKAGE_REGISTRY=OFF', '-DCMAKE_FIND_USE_SYSTEM_PACKAGE_REGISTRY=OFF',
  '-DBUILD_TRAINING_TOOLS=OFF', '-DOPENMP_BUILD=OFF', '-DGRAPHICS_DISABLED=ON'
] as const

const lameRecipe: ManagedSourceRecipe = {
  binaryRelativePath: 'lib/libmp3lame.a', sourceNames: ['lame'],
  buildFlags: ['--disable-shared', '--enable-static', '--disable-frontend', '--disable-gtktest', '--disable-debug']
}
const ffmpegRecipe: ManagedSourceRecipe = {
  binaryRelativePath: 'bin/ffmpeg', requiredPaths: ['bin/ffprobe'], sourceNames: ['ffmpeg'], buildFlags: MANAGED_FFMPEG_BUILD_FLAGS
}
const leptonicaRecipe: ManagedSourceRecipe = {
  binaryRelativePath: 'lib/libleptonica.a', requiredPaths: ['lib/cmake/leptonica/LeptonicaConfig.cmake'],
  sourceNames: ['leptonica'], buildFlags: MANAGED_LEPTONICA_BUILD_FLAGS
}
const tesseractRecipe: ManagedSourceRecipe = {
  binaryRelativePath: 'bin/tesseract', requiredPaths: ['share/tessdata/configs/hocr', 'share/tessdata/tessconfigs/batch'],
  sourceNames: ['tesseract'], buildFlags: MANAGED_TESSERACT_BUILD_FLAGS
}
const nativeRecipeRevision = 'runtime-native-static-v3'

export type ManagedMacosToolId = 'ffmpeg' | 'ffprobe' | 'tesseract' | 'leptonica' | 'lame' | 'calibre' | 'ebook-convert' | 'mupdf' | 'mutool' | 'qpdf' | 'yt-dlp'
export type ManagedMacosToolValidation = {
  healthy: true
  distribution: 'source' | 'upstream-binary'
  version: string
  platform: 'darwin'
  architecture: string
  unavailableComponents?: ManagedDynamicLibraryClosureResult['unavailableComponents']
} | { healthy: false, reason: string }

type ManagedCalibrePackageManifest = ManagedDynamicLibraryClosureResult & {
  schemaVersion: 1, tool: 'calibre', distribution: 'upstream-binary', version: string,
  sha256: string, url: string, architecture: string, platform: 'darwin', payload: ManagedSourcePayloadFile[]
}

const calibreClosureMatches = (manifest: Partial<ManagedDynamicLibraryClosureResult>, closure: ManagedDynamicLibraryClosureResult): boolean =>
  JSON.stringify(manifest.inertRunpaths) === JSON.stringify(closure.inertRunpaths)
  && JSON.stringify(manifest.unavailableComponents) === JSON.stringify(closure.unavailableComponents)
  && JSON.stringify(manifest.absentFrameworks) === JSON.stringify(closure.absentFrameworks)

const readMacosVersionWithoutExecution = async (): Promise<string> => {
  const plist = await Bun.file('/System/Library/CoreServices/SystemVersion.plist').text()
  const version = plist.match(/<key>ProductVersion<\/key>\s*<string>([0-9]+(?:\.[0-9]+){1,2})<\/string>/)?.[1]
  if (!version) throw InfraError('Could not read the host macOS version from its system version record', { stage: 'setup:managed-artifact' })
  return version
}

export const validateManagedMacosTool = async (
  tool: ManagedMacosToolId,
  options: { execute?: typeof runCapture } = {}
): Promise<ManagedMacosToolValidation> => {
  try {
    const macosVersion = await readMacosVersionWithoutExecution()
    const identity = tool === 'ffprobe' ? 'ffmpeg' : tool === 'ebook-convert' ? 'calibre' : tool === 'mutool' ? 'mupdf' : tool
    const version = await readDependencyVersion(identity)
    if (!version) return { healthy: false, reason: `Missing pinned version for ${identity}` }
    if (identity === 'calibre') {
      assertRuntimeContainedPath(calibreToolDir)
      assertRuntimeContainedPath(ebookConvertManagedBinaryPath)
      const { url, sha256 } = await readDependencyUrlAndSha256('calibre')
      const manifest = await Bun.file(join(calibreToolDir, '.autoshow-managed-artifact.json')).json() as Partial<ManagedCalibrePackageManifest>
      if (manifest.schemaVersion !== 1 || manifest.tool !== 'calibre' || manifest.distribution !== 'upstream-binary' || manifest.version !== version || manifest.sha256 !== sha256 || manifest.url !== url || manifest.architecture !== process.arch || manifest.platform !== 'darwin' || !Array.isArray(manifest.payload) || !Array.isArray(manifest.inertRunpaths) || !Array.isArray(manifest.unavailableComponents) || !Array.isArray(manifest.absentFrameworks)) {
        return { healthy: false, reason: 'Calibre package provenance does not match its pinned download/platform' }
      }
      const issue = managedSourcePayloadIssue(manifest.payload, await collectManagedSourcePayload(calibreToolDir))
      if (issue) return { healthy: false, reason: issue }
      const closure = await inspectManagedCalibreApplication(calibreAppPath, sha256, options)
      if (!calibreClosureMatches(manifest, closure)) return { healthy: false, reason: 'Calibre CLI closure receipt does not match the verified package' }
      if (await Bun.file(ebookConvertManagedBinaryPath).text() !== buildManagedCalibreWrapperScript(closure.inertRunpaths, closure.unavailableComponents, closure.absentFrameworks)) return { healthy: false, reason: 'Calibre entrypoint does not match its managed wrapper' }
      return { healthy: true, distribution: 'upstream-binary', version, platform: 'darwin', architecture: process.arch, unavailableComponents: closure.unavailableComponents }
    }
    if (identity === 'yt-dlp') {
      assertRuntimeContainedPath(ytDlpManagedBinaryPath)
      const { sha256 } = await readDependencyUrlAndSha256('yt-dlp')
      if (await sha256File(ytDlpManagedBinaryPath) !== sha256) return { healthy: false, reason: 'yt-dlp binary does not match its pinned download' }
      return { healthy: true, distribution: 'upstream-binary', version, platform: 'darwin', architecture: process.arch }
    }
    const source = identity === 'ffmpeg' ? { toolDir: ffmpegToolDir, recipe: ffmpegRecipe, dependencies: await ffmpegDependencyIdentities() }
      : identity === 'tesseract' ? { toolDir: tesseractToolDir, recipe: tesseractRecipe, dependencies: await tesseractDependencyIdentities() }
      : identity === 'leptonica' ? { toolDir: leptonicaToolDir, recipe: leptonicaRecipe, dependencies: await nativeDependencyIdentities(nativeCodecDependencies) }
      : identity === 'lame' ? { toolDir: lameToolDir, recipe: lameRecipe, dependencies: [] }
      : { toolDir: identity === 'mupdf' ? mupdfToolDir : qpdfToolDir }
    assertRuntimeContainedPath(source.toolDir)
    const validation = await validateManagedSourceArtifact(identity, {
      ...source, macosVersion,
      ...('recipe' in source ? {
        expectedSources: await readPinnedSources(source.recipe!.sourceNames), expectedDependencies: source.dependencies,
        expectedRecipeRevision: nativeRecipeRevision
      } : {})
    })
    if (!validation.healthy) return validation
    if (identity === 'ffmpeg') {
      if (await realpath(ffmpegManagedBinaryPath) !== await realpath(ffmpegInstalledBinaryPath) || await realpath(ffprobeManagedBinaryPath) !== await realpath(ffprobeInstalledBinaryPath)) return { healthy: false, reason: 'FFmpeg entrypoints do not resolve to their managed payload' }
    } else if (identity === 'tesseract') {
      if (await Bun.file(tesseractManagedBinaryPath).text() !== buildManagedTesseractWrapperScript()) return { healthy: false, reason: 'Tesseract entrypoint does not match its managed wrapper' }
      const expectedData = await readDependencyUrlAndSha256('tessdataEng')
      assertRuntimeContainedPath(englishTrainedDataPath)
      if (await sha256File(englishTrainedDataPath) !== expectedData.sha256) return { healthy: false, reason: 'Tesseract English data does not match its pinned download' }
      for (const path of ['configs/hocr', 'tessconfigs/batch']) {
        assertRuntimeContainedPath(join(tessdataDir, path))
        if (await sha256File(join(tessdataDir, path)) !== await sha256File(join(tesseractInstalledTessdataDir, path))) return { healthy: false, reason: `Tesseract support asset does not match its managed payload: ${path}` }
      }
    } else if (identity === 'qpdf') {
      if (await Bun.file(qpdfManagedBinaryPath).text() !== buildManagedQpdfWrapperScript()) return { healthy: false, reason: 'qpdf entrypoint does not match its managed wrapper' }
    } else if (identity === 'mupdf') {
      if (await realpath(mutoolManagedBinaryPath) !== await realpath(mutoolInstalledBinaryPath)) return { healthy: false, reason: 'MuPDF entrypoint does not resolve to its managed payload' }
    }
    return { healthy: true, distribution: 'source', version, platform: 'darwin', architecture: process.arch }
  } catch (error) { return { healthy: false, reason: error instanceof Error ? error.message : String(error) } }
}

const readPinnedSources = async (names: readonly string[]): Promise<ManagedArtifactSource[]> => await Promise.all(names.map(async name => {
  const version = await readDependencyVersion(name)
  if (!version) throw InfraError(`Missing pinned source version for ${name}`, { stage: 'setup:macos-tools' })
  return { name, version, ...await readDependencyUrlAndSha256(name) }
}))

const sourceDependencyIdentity = async (name: string, toolDir: string): Promise<ManagedArtifactDependency> => ({
  name,
  version: (await readDependencyVersion(name)) ?? 'unknown',
  manifestSha256: await sha256File(join(toolDir, '.autoshow-managed-artifact.json'))
})

const nativeDependencyIdentities = async (names: readonly NativeDependencyName[]): Promise<ManagedArtifactDependency[]> =>
  await Promise.all(names.map(name => readManagedNativeDependencyIdentity(name)))

const validateSourceRecipe = async (name: string, toolDir: string, recipe: ManagedSourceRecipe, dependencies: ManagedArtifactDependency[] = []): Promise<void> => {
  const result = await validateManagedSourceArtifact(name, {
    toolDir, recipe, expectedSources: await readPinnedSources(recipe.sourceNames), expectedDependencies: dependencies,
    expectedRecipeRevision: nativeRecipeRevision
  })
  if (!result.healthy) throw InfraError(`Managed ${name} is not reusable: ${result.reason}`, { stage: `setup:${name}` })
}

const hasSourceRecipe = async (name: string, toolDir: string, recipe: ManagedSourceRecipe, dependencies: ManagedArtifactDependency[] = []): Promise<boolean> => {
  try { await validateSourceRecipe(name, toolDir, recipe, dependencies); return true } catch { return false }
}

const writeSourceRecipe = async (name: string, toolDir: string, recipe: ManagedSourceRecipe, dependencies: ManagedArtifactDependency[] = []): Promise<void> => {
  await writeManagedSourceArtifactManifest({
    tool: name, toolDir, recipe, sources: await readPinnedSources(recipe.sourceNames), dependencies,
    recipeRevision: nativeRecipeRevision, deploymentTarget: await resolveSourceDeploymentTarget()
  })
}

const copySourceNotices = async (sourceDir: string, toolDir: string, name: string): Promise<void> => {
  const destination = join(toolDir, 'licenses', name)
  await mkdir(destination, { recursive: true })
  let copiedLicense = false
  for (const candidate of ['COPYING', 'COPYING.GPLv2', 'COPYING.GPLv3', 'COPYING.LGPLv2.1', 'COPYING.LGPLv3', 'LICENSE', 'LICENSE.md', 'LICENSE.txt', 'leptonica-license.txt', 'README', 'README.md']) {
    const source = join(sourceDir, candidate)
    if (!await pathExists(source)) continue
    await cp(source, join(destination, candidate))
    if (/COPYING|LICENSE|license/.test(candidate)) copiedLicense = true
  }
  if (!copiedLicense) throw InfraError(`Managed ${name} source archive did not contain its expected license notice`, { stage: `setup:${name}` })
}

const copyApprovedToolchainNotices = async (tool: 'mupdf' | 'qpdf', sourceRoots: Record<string, string>, toolDir: string): Promise<void> => {
  for (const entry of managedToolchainNoticePlan(tool)) {
    const sourceRoot = sourceRoots[entry.source]
    if (!sourceRoot) throw InfraError(`Missing ${entry.source} source root for ${tool} notices`, { stage: `setup:${tool}` })
    const destination = join(toolDir, entry.packagePath)
    await mkdir(dirname(destination), { recursive: true })
    if (entry.mode === 'copy') {
      const sourcePath = entry.sourcePaths[0]
      if (!sourcePath) throw InfraError(`Missing ${entry.source} notice source path`, { stage: `setup:${tool}` })
      await cp(join(sourceRoot, sourcePath), destination)
    } else {
      const chunks: Uint8Array[] = []
      for (const sourcePath of entry.sourcePaths) {
        chunks.push(new TextEncoder().encode(`=== ${entry.source}/${sourcePath} ===\n`), await Bun.file(join(sourceRoot, sourcePath)).bytes(), new TextEncoder().encode('\n\n'))
      }
      const combined = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.byteLength, 0))
      let offset = 0
      for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength }
      await Bun.write(destination, combined)
    }
  }
}

const copyDestdirInstall = async (buildRoot: string, destination: string, stagingDir: string): Promise<void> => {
  const installRoot = join(buildRoot, `install-root-${crypto.randomUUID()}`)
  let copied = false
  try {
    await mkdir(installRoot, { recursive: true })
    await runInherit('/usr/bin/make', ['install', `DESTDIR=${installRoot}`], { cwd: buildRoot })
    await cp(join(installRoot, destination.replace(/^\/+/, '')), stagingDir, { recursive: true })
    copied = true
  } finally { if (copied) await rm(installRoot, { recursive: true, force: true }) }
}

const sourceStampPath = (buildDir: string): string => join(buildDir, '.autoshow-source-sha256')

export const prepareManagedSourceBuild = async (componentRoot: string): Promise<string | undefined> => {
  assertRuntimeContainedPath(componentRoot)
  await mkdir(dirname(componentRoot), { recursive: true })
  let preserved: string | undefined
  if (await pathExists(componentRoot)) {
    preserved = join(dirname(componentRoot), `.${basename(componentRoot)}.interrupted-source-${crypto.randomUUID()}`)
    assertRuntimeContainedPath(preserved)
    // Move the complete attempt as one tree so file metadata and relative link
    // relationships survive, and later successful cleanup cannot remove it.
    await rename(componentRoot, preserved)
    l.write('info', 'Previous native source workspace was preserved', { category: 'artifact', metadata: { path: toProjectDisplayPath(preserved) } })
  }
  await mkdir(componentRoot, { recursive: true })
  return preserved
}

const hasExtractedSource = async (buildDir: string, sha256: string): Promise<boolean> => {
  const stamp = sourceStampPath(buildDir)
  if (!await pathExists(stamp)) return false
  return (await Bun.file(stamp).text()).trim() === sha256
}

const downloadSource = async (
  name: string,
  buildDir: string,
  flowId: DownloadFlowId,
  forceRedownload = false
): Promise<void> => {
  assertRuntimeContainedPath(buildDir)
  const { url, sha256 } = await readDependencyUrlAndSha256(name)
  const sourceCached = !forceRedownload && await hasExtractedSource(buildDir, sha256)
  await recordSetupPerformancePhase(name, 'archive-preparation', async () => {
    if (sourceCached) return

    const cachedArchive = getRuntimeCachePath('source-archives', `${name}-${sha256}.tar.gz`)
    const archiveValid = !forceRedownload && await pathExists(cachedArchive) && await sha256File(cachedArchive) === sha256
    if (!archiveValid) await downloadFile({ url, sha256, destination: cachedArchive, flowId })
    await mkdir(buildDir, { recursive: true })
    await extractTarGzFile(cachedArchive, { destination: buildDir, stripComponents: 1 })
    await Bun.write(sourceStampPath(buildDir), `${sha256}\n`)
  }, { sourceCached })
}

const discardBuildTree = async (buildDir: string): Promise<void> => {
  assertRuntimeContainedPath(buildDir)
  await rm(buildDir, { recursive: true, force: true })
}

export const installManagedYtDlpMacos = async (options: ManagedMacosInstallOptions = {}): Promise<void> =>
  withProcessLock(`setup-yt-dlp-${ytDlpManagedBinaryPath}`, async () => await installManagedYtDlpMacosUnlocked(options))

const installManagedYtDlpMacosUnlocked = async (options: ManagedMacosInstallOptions): Promise<void> => {
  assertRuntimeContainedPath(ytDlpManagedBinaryPath)
  const { url, sha256 } = await readDependencyUrlAndSha256('yt-dlp')
  if (!options.forceRedownload && await pathExists(ytDlpManagedBinaryPath) && await sha256File(ytDlpManagedBinaryPath) === sha256) return
  await ensureParentDir(ytDlpManagedBinaryPath)
  const stagingPath = `${ytDlpManagedBinaryPath}.incoming-${crypto.randomUUID()}`
  try {
  await downloadFile({
    url,
    sha256,
    destination: stagingPath,
    flowId: 'yt-dlp-binary'
  })
    await makeExecutable(stagingPath)
    const checked = await runCapture(stagingPath, ['--version'], { allowFailure: true })
    const version = await readDependencyVersion('yt-dlp')
    if (checked.exitCode !== 0 || !version || !checked.stdout.includes(version)) throw InfraError('Managed yt-dlp failed its pinned version check', { stage: 'setup:yt-dlp' })
    await rename(stagingPath, ytDlpManagedBinaryPath)
  } finally { await rm(stagingPath, { force: true }) }
}

const installManagedLameMacos = async (options: ManagedMacosInstallOptions): Promise<void> => withProcessLock(`setup-lame-${lameBuildDir}`, async () => {
  await recoverManagedToolDirectory(lameToolDir)
  if (!options.forceRedownload && await hasSourceRecipe('lame', lameToolDir, lameRecipe)) return
  await prepareManagedSourceBuild(lameBuildDir)
  await downloadSource('lame', lameBuildDir, 'lame-source', options.forceRedownload)
  const env = managedNativeBuildEnv([])
  await recordSetupPerformancePhase('lame', 'configure-generate', async () => {
    await runInherit('./configure', [`--prefix=${lameToolDir}`, ...lameRecipe.buildFlags], { cwd: lameBuildDir, env })
  })
  const jobs = resolveSetupSourceBuildParallelJobs()
  await recordSetupPerformancePhase('lame', 'compile-link', async () => {
    await runInherit('/usr/bin/make', ['-j', String(jobs)], { cwd: lameBuildDir, env })
  }, { parallelJobs: jobs })
  const stagingDir = await createManagedToolStagingDirectory(lameToolDir)
  try {
    await copyDestdirInstall(lameBuildDir, lameToolDir, stagingDir)
    await copySourceNotices(lameBuildDir, stagingDir, 'lame')
    await normalizeManagedNativeMetadata(stagingDir, lameToolDir)
    await writeSourceRecipe('lame', stagingDir, lameRecipe)
    await promoteManagedToolDirectory({
      stagingDir, destinationDir: lameToolDir,
      validateStaging: async toolDir => await validateSourceRecipe('lame', toolDir, lameRecipe)
    })
  } catch (error) { preserveStagedFailure(stagingDir, error) }
  await discardBuildTree(lameBuildDir)
})

export const assertManagedFfmpegCapabilities = async (binaryPath: string, execute = runCapture): Promise<void> => {
  const [filters, encoders] = await Promise.all([
    execute(binaryPath, ['-hide_banner', '-filters'], { allowFailure: true }),
    execute(binaryPath, ['-hide_banner', '-encoders'], { allowFailure: true })
  ])
  if (filters.exitCode !== 0 || !/^\s*\S+\s+ass\s/m.test(filters.stdout)) {
    throw InfraError('Managed FFmpeg is missing the ass subtitle-rendering filter', { stage: 'setup:ffmpeg' })
  }
  for (const encoder of ['libmp3lame', 'libx264', 'aac']) {
    if (encoders.exitCode !== 0 || !new RegExp(`\\s${encoder}\\s`).test(encoders.stdout)) {
      throw InfraError(`Managed FFmpeg is missing the ${encoder} encoder`, { stage: 'setup:ffmpeg' })
    }
  }
  const encoded = await execute(binaryPath, [
    '-hide_banner', '-nostdin', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=64x64:r=1',
    '-frames:v', '1', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-f', 'null', '-'
  ], { allowFailure: true })
  if (encoded.exitCode !== 0) throw InfraError(`Managed FFmpeg failed a software H.264 encode: ${encoded.stderr.trim()}`, { stage: 'setup:ffmpeg' })
}

const ffmpegDependencyIdentities = async (): Promise<ManagedArtifactDependency[]> => [
  await sourceDependencyIdentity('lame', lameToolDir), ...await nativeDependencyIdentities(ffmpegNativeDependencies)
]

const validateFfmpegInstall = async (toolDir: string, dependencies: ManagedArtifactDependency[]): Promise<void> => {
  await validateSourceRecipe('ffmpeg', toolDir, ffmpegRecipe, dependencies)
  const binaries = [join(toolDir, 'bin/ffmpeg'), join(toolDir, 'bin/ffprobe')]
  await assertManagedDynamicLibraryClosure(binaries)
  await assertManagedFfmpegCapabilities(binaries[0]!)
  const probe = await runCapture(binaries[1]!, ['-version'], { allowFailure: true })
  if (probe.exitCode !== 0) throw InfraError('Managed ffprobe failed its version check', { stage: 'setup:ffmpeg' })
}

export const hasManagedFfmpegBuild = async (): Promise<boolean> => {
  try {
    await validateFfmpegInstall(ffmpegToolDir, await ffmpegDependencyIdentities())
    return await realpath(ffmpegManagedBinaryPath) === await realpath(ffmpegInstalledBinaryPath)
      && await realpath(ffprobeManagedBinaryPath) === await realpath(ffprobeInstalledBinaryPath)
  } catch { return false }
}

export const installManagedFfmpegMacos = async (options: ManagedMacosInstallOptions = {}): Promise<void> =>
  withProcessLock(`setup-ffmpeg-${ffmpegBuildDir}`, async () => await installManagedFfmpegMacosUnlocked(options))

const installManagedFfmpegMacosUnlocked = async (options: ManagedMacosInstallOptions): Promise<void> => {
  await recoverManagedToolDirectory(ffmpegToolDir)
  await ensureManagedMacosSourceDependencies(ffmpegNativeDependencies, [installManagedLameMacos], options)
  const dependencies = await ffmpegDependencyIdentities()
  if (!options.forceRedownload && await hasSourceRecipe('ffmpeg', ffmpegToolDir, ffmpegRecipe, dependencies)) {
    await validateFfmpegInstall(ffmpegToolDir, dependencies)
    await createSymlinkShim(ffmpegInstalledBinaryPath, ffmpegManagedBinaryPath)
    await createSymlinkShim(ffprobeInstalledBinaryPath, ffprobeManagedBinaryPath)
    return
  }
  await prepareManagedSourceBuild(ffmpegBuildDir)
  await downloadSource('ffmpeg', ffmpegBuildDir, 'ffmpeg-source', options.forceRedownload)
  const env = managedNativeBuildEnv(ffmpegNativeDependencies)
  const includeFlags = `${env['CPPFLAGS'] ?? ''} -I${join(lameToolDir, 'include')}`.trim()
  const linkFlags = `${env['LDFLAGS'] ?? ''} -L${join(lameToolDir, 'lib')}`.trim()
  await recordSetupPerformancePhase('ffmpeg', 'configure-generate', async () => {
    await runInherit('./configure', [
      `--prefix=${ffmpegToolDir}`, ...MANAGED_FFMPEG_BUILD_FLAGS,
      `--pkg-config=${managedBuildToolPath('pkgconf')}`,
      `--extra-cflags=${includeFlags}`, `--extra-ldflags=${linkFlags}`
    ], { cwd: ffmpegBuildDir, env })
  })
  const jobs = resolveSetupSourceBuildParallelJobs()
  await recordSetupPerformancePhase('ffmpeg', 'compile-link', async () => {
    await runInherit('/usr/bin/make', ['-j', String(jobs)], { cwd: ffmpegBuildDir, env })
  }, { parallelJobs: jobs })
  const stagingDir = await createManagedToolStagingDirectory(ffmpegToolDir)
  try {
    await copyDestdirInstall(ffmpegBuildDir, ffmpegToolDir, stagingDir)
    await copySourceNotices(ffmpegBuildDir, stagingDir, 'ffmpeg')
    await normalizeManagedNativeMetadata(stagingDir, ffmpegToolDir)
    await writeSourceRecipe('ffmpeg', stagingDir, ffmpegRecipe, dependencies)
    await promoteManagedToolDirectory({
      stagingDir, destinationDir: ffmpegToolDir,
      validateStaging: async toolDir => await validateFfmpegInstall(toolDir, dependencies),
      activate: async () => {
        await createSymlinkShim(ffmpegInstalledBinaryPath, ffmpegManagedBinaryPath)
        await createSymlinkShim(ffprobeInstalledBinaryPath, ffprobeManagedBinaryPath)
      },
      rollbackActivation: async hadPreviousInstall => {
        if (!hadPreviousInstall) await Promise.all([ffmpegManagedBinaryPath, ffprobeManagedBinaryPath].map(path => rm(path, { force: true })))
      }
    })
  } catch (error) { preserveStagedFailure(stagingDir, error) }
  await discardBuildTree(ffmpegBuildDir)
}

export const installManagedMupdfMacos = async (options: ManagedMacosInstallOptions = {}): Promise<void> => withProcessLock(`setup-mupdf-${mupdfBuildDir}`, async () => await installManagedMupdfMacosUnlocked(options))

const installManagedMupdfMacosUnlocked = async (options: ManagedMacosInstallOptions): Promise<void> => {
  await recoverManagedToolDirectory(mupdfToolDir)
  if (!options.forceRedownload && await hasValidManagedSourcePayload('mupdf')) {
    await createSymlinkShim(mutoolInstalledBinaryPath, mutoolManagedBinaryPath)
    return
  }
  await prepareManagedSourceBuild(mupdfBuildDir)
  await downloadSource('mupdf', mupdfBuildDir, 'mupdf-source', options.forceRedownload)
  const deploymentTarget = await resolveSourceDeploymentTarget()
  const jobs = resolveSetupSourceBuildParallelJobs()
  await recordSetupPerformancePhase('mupdf', 'compile-link', async () => {
    await runInherit('make', buildMupdfMakeArguments(jobs), {
      cwd: mupdfBuildDir,
      env: { ...managedNativeBuildEnv([]), MACOSX_DEPLOYMENT_TARGET: deploymentTarget }
    })
  }, { parallelJobs: jobs })
  await recordSetupPerformancePhase('mupdf', 'install-promote', async () => {
    const stagingDir = await createManagedToolStagingDirectory(mupdfToolDir)
    try {
      const stagedMutool = join(stagingDir, 'bin/mutool')
      await mkdir(dirname(stagedMutool), { recursive: true })
      await cp(join(mupdfBuildDir, 'build/release/mutool'), stagedMutool)
      await makeExecutable(stagedMutool)
      await copySourceNotices(mupdfBuildDir, stagingDir, 'mupdf')
      await copyApprovedToolchainNotices('mupdf', { mupdf: mupdfBuildDir }, stagingDir)
      await writeManagedSourceArtifactManifest({ tool: 'mupdf', toolDir: stagingDir, deploymentTarget })
      await promoteManagedToolDirectory({
        stagingDir,
        destinationDir: mupdfToolDir,
        validateStaging: async (toolDir) => { await assertManagedSourceInstallAt('mupdf', toolDir) },
        activate: async () => { await createSymlinkShim(mutoolInstalledBinaryPath, mutoolManagedBinaryPath) },
        rollbackActivation: async (hadPreviousInstall) => {
          if (!hadPreviousInstall) await rm(mutoolManagedBinaryPath, { force: true })
        }
      })
    } catch (error) {
      preserveStagedFailure(stagingDir, error)
    }
  })
  await recordSetupPerformancePhase('mupdf', 'cleanup', async () => {
    await discardBuildTree(mupdfBuildDir)
  })
}

export const installManagedCalibreMacos = async (options: ManagedMacosInstallOptions = {}): Promise<void> =>
  withProcessLock(`setup-calibre-${calibreAppPath}`, async () => await installManagedCalibreMacosUnlocked(options))

export const assessManagedCalibreSignature = async (appPath: string, execute = runCapture): Promise<void> => {
  const diagnostic = (result: { stdout: string, stderr: string }): string => (result.stderr.trim() || result.stdout.trim()).split('\n').slice(-12).join('\n').slice(-3000)
  const signature = await execute('/usr/bin/codesign', ['--verify', '--deep', '--strict', appPath], { allowFailure: true })
  if (signature.exitCode !== 0) throw InfraError(`Official Calibre bundle signature verification failed before application execution: ${diagnostic(signature)}`, { stage: 'setup:calibre', retryable: false })
  const assessment = await execute('/usr/sbin/spctl', ['--assess', '--type', 'execute', appPath], { allowFailure: true })
  if (assessment.exitCode !== 0) throw InfraError(`Official Calibre bundle was rejected by macOS assessment before application execution: ${diagnostic(assessment)}`, { stage: 'setup:calibre', retryable: false })
}

export const collectManagedCalibreNativeImages = async (appPath: string): Promise<string[]> => {
  assertRuntimeContainedPath(appPath)
  const images: string[] = []
  const magicNumbers = new Set([0xfeedfacf, 0xcffaedfe, 0xfeedface, 0xcefaedfe, 0xcafebabe, 0xbebafeca, 0xcafebabf, 0xbfbafeca])
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === '.DS_Store') continue
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile()) {
        const header = await Bun.file(path).slice(0, 4).bytes()
        if (header.byteLength === 4 && magicNumbers.has(new DataView(header.buffer, header.byteOffset, 4).getUint32(0))) images.push(path)
      }
    }
  }
  await visit(appPath)
  return images.sort()
}

type CalibreUnavailableComponent = ManagedDynamicLibraryClosureResult['unavailableComponents'][number]
type CalibreClosureInspection = (paths: readonly string[], options?: Parameters<typeof assertManagedDynamicLibraryClosure>[1]) => Promise<void | ManagedDynamicLibraryClosureResult>

export const buildManagedCalibreSandboxProfile = (disabledImageCount: number): string => {
  if (!Number.isSafeInteger(disabledImageCount) || disabledImageCount < 0 || disabledImageCount > 5) throw InfraError('Invalid Calibre CLI sandbox component count', { stage: 'setup:calibre' })
  return ['(version 1)', '(allow default)', '(deny network*)', ...Array.from({ length: disabledImageCount }, (_, index) => `(deny file-read* (literal (param "CALIBRE_DISABLED_IMAGE_${index}")))`)].join('\n')
}

export const buildManagedCalibreSandboxArguments = async (
  appPath: string,
  unavailableComponents: readonly CalibreUnavailableComponent[]
): Promise<string[]> => {
  const root = await realpath(appPath)
  assertRuntimeContainedPath(root)
  const args = ['-p', buildManagedCalibreSandboxProfile(unavailableComponents.length)]
  for (const [index, component] of unavailableComponents.entries()) {
    const image = await realpath(join(root, component.image))
    if (!isContainedManagedPath(root, image)) throw InfraError('Calibre disabled component escapes its signed package', { stage: 'setup:calibre' })
    args.push('-D', `CALIBRE_DISABLED_IMAGE_${index}=${image}`)
  }
  return args
}

const inspectManagedCalibreApplication = async (
  appPath: string,
  pinnedArchiveSha256: string,
  options: { execute?: typeof runCapture, inspectDependencies?: CalibreClosureInspection } = {}
): Promise<ManagedDynamicLibraryClosureResult> => {
  const execute = options.execute ?? runCapture
  const signature = assessManagedCalibreSignature(appPath, execute)
  await signature
  const binary = join(appPath, 'Contents/MacOS/ebook-convert')
  const additionalImages = options.inspectDependencies ? [] : await collectManagedCalibreNativeImages(appPath)
  const closure = await (options.inspectDependencies ?? assertManagedDynamicLibraryClosure)([binary], {
    inspect: async (path, kind) => {
      const result = await execute('/usr/bin/otool', [kind === 'libraries' ? '-L' : '-l', path], { allowFailure: true })
      if (result.exitCode !== 0) {
        const diagnostic = (result.stderr.trim() || result.stdout.trim()).split('\n').slice(-12).join('\n').slice(-3000)
        throw InfraError(`Could not inspect managed Calibre native payload ${toProjectDisplayPath(path)}: ${diagnostic}`, { stage: 'setup:calibre' })
      }
      return result.stdout
    },
    signedCalibre: { packageRoot: appPath, pinnedArchiveSha256, verifySignature: async () => await signature, additionalImages, unavailableComponentPolicy: 'calibre-cli-sandbox-v1' }
  })
  return closure ?? { inertRunpaths: [], unavailableComponents: [], absentFrameworks: [] }
}

export const validateManagedCalibreApplication = async (
  appPath: string,
  expectedVersion: string,
  options: { execute?: typeof runCapture, inspectDependencies?: CalibreClosureInspection } = {}
): Promise<ManagedDynamicLibraryClosureResult> => {
  const execute = options.execute ?? runCapture
  const source = await readDependencyUrlAndSha256('calibre')
  const closure = await inspectManagedCalibreApplication(appPath, source.sha256, options)
  const binary = join(await realpath(appPath), 'Contents/MacOS/ebook-convert')
  const sandboxArgs = await buildManagedCalibreSandboxArguments(appPath, closure.unavailableComponents)
  const result = await execute('/usr/bin/sandbox-exec', [...sandboxArgs, binary, '--version'], { allowFailure: true })
  if (result.exitCode !== 0 || !`${result.stdout}\n${result.stderr}`.includes(expectedVersion)) {
    const diagnostic = (result.stderr.trim() || result.stdout.trim()).split('\n').slice(-12).join('\n').slice(-3000)
    throw InfraError(`Managed Calibre failed its pinned version check (exit ${result.exitCode}): ${diagnostic || 'no subprocess diagnostic'}`, { stage: 'setup:calibre' })
  }
  return closure
}

const installManagedCalibreMacosUnlocked = async (options: ManagedMacosInstallOptions): Promise<void> => {
  await recoverManagedToolDirectory(calibreToolDir)
  const version = await readDependencyVersion('calibre')
  const { url, sha256 } = await readDependencyUrlAndSha256('calibre')
  const manifestPath = join(calibreToolDir, '.autoshow-managed-artifact.json')
  let closure: ManagedDynamicLibraryClosureResult = { inertRunpaths: [], unavailableComponents: [], absentFrameworks: [] }
  const validateApp = async (appPath: string): Promise<void> => {
    if (!version) throw InfraError('Calibre has no pinned version metadata', { stage: 'setup:calibre' })
    closure = await validateManagedCalibreApplication(appPath, version)
  }
  const healthy = async (): Promise<boolean> => {
    try {
      const manifest = await Bun.file(manifestPath).json() as Partial<ManagedCalibrePackageManifest>
      if (manifest.schemaVersion !== 1 || manifest.tool !== 'calibre' || manifest.distribution !== 'upstream-binary' || manifest.version !== version || manifest.sha256 !== sha256 || manifest.url !== url || manifest.architecture !== process.arch || manifest.platform !== 'darwin' || !Array.isArray(manifest.payload) || !Array.isArray(manifest.inertRunpaths) || !Array.isArray(manifest.unavailableComponents) || !Array.isArray(manifest.absentFrameworks)) return false
      if (managedSourcePayloadIssue(manifest.payload, await collectManagedSourcePayload(calibreToolDir))) return false
      await validateApp(calibreAppPath)
      if (!calibreClosureMatches(manifest, closure)) return false
      return true
    } catch { return false }
  }
  if (!options.forceRedownload && await healthy()) {
    await writeExecutableScript(ebookConvertManagedBinaryPath, buildManagedCalibreWrapperScript(closure.inertRunpaths, closure.unavailableComponents, closure.absentFrameworks))
    return
  }
  const stagingDir = await createManagedToolStagingDirectory(calibreToolDir)
  try {
    await installDmgApp({ url, sha256, appName: 'calibre.app', destinationAppPath: join(stagingDir, 'calibre.app'), validateApp, forceRedownload: options.forceRedownload ?? false })
    const manifest = {
      schemaVersion: 1, tool: 'calibre', distribution: 'upstream-binary', version, url, sha256, platform: 'darwin',
      architecture: process.arch, ...closure, payload: await collectManagedSourcePayload(stagingDir)
    }
    await Bun.write(join(stagingDir, '.autoshow-managed-artifact.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    await promoteManagedToolDirectory({
      stagingDir, destinationDir: calibreToolDir,
      validateStaging: async toolDir => {
        const installed = await Bun.file(join(toolDir, '.autoshow-managed-artifact.json')).json() as typeof manifest
        if (installed.version !== version || installed.sha256 !== sha256 || installed.url !== url || installed.architecture !== process.arch) throw InfraError('Managed Calibre package identity does not match its pinned download', { stage: 'setup:calibre' })
        const issue = managedSourcePayloadIssue(installed.payload, await collectManagedSourcePayload(toolDir))
        if (issue) throw InfraError(`Managed Calibre ${issue}`, { stage: 'setup:calibre' })
        await validateApp(join(toolDir, 'calibre.app'))
        if (!calibreClosureMatches(installed, closure)) throw InfraError('Managed Calibre CLI closure receipt changed during validation', { stage: 'setup:calibre' })
      },
      activate: async () => await writeExecutableScript(ebookConvertManagedBinaryPath, buildManagedCalibreWrapperScript(closure.inertRunpaths, closure.unavailableComponents, closure.absentFrameworks)),
      rollbackActivation: async hadPreviousInstall => { if (!hadPreviousInstall) await rm(ebookConvertManagedBinaryPath, { force: true }) }
    })
  } catch (error) { preserveStagedFailure(stagingDir, error) }
}

export const buildManagedCalibreWrapperScript = (
  inertRunpaths: readonly string[] = [],
  unavailableComponents: readonly CalibreUnavailableComponent[] = [],
  absentFrameworks: readonly string[] = []
): string => {
  const shellQuote = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`
  const systemAliasGuard = inertRunpaths.some(path => path.startsWith('/private/var/'))
    ? `if [ "$(CDPATH= cd -P /var && pwd -P)" != /private/var ]; then\n  printf '%s\\n' 'Managed Calibre system path alias changed; run bun autoshow setup --step calibre.' >&2\n  exit 1\nfi\n`
    : ''
  const producerGuards = inertRunpaths.map(path => {
    const quoted = shellQuote(path)
    return `if [ -e ${quoted} ] || [ -L ${quoted} ]; then\n  printf '%s\\n' 'Managed Calibre producer search path is present; run bun autoshow setup --step calibre.' >&2\n  exit 1\nfi\ncalibre_producer_parent=$(/usr/bin/dirname ${quoted})\nwhile [ "$calibre_producer_parent" != / ] && [ "$calibre_producer_parent" != . ]; do\n  if [ -L "$calibre_producer_parent" ]; then\n    printf '%s\\n' 'Managed Calibre producer search path has a symbolic-link ancestor; run bun autoshow setup --step calibre.' >&2\n    exit 1\n  fi\n  calibre_producer_parent=$(/usr/bin/dirname "$calibre_producer_parent")\ndone\n`
  }).join('')
  const frameworkGuards = absentFrameworks.map(path => `if [ -e "$calibre_app_dir"/${shellQuote(path)} ] || [ -L "$calibre_app_dir"/${shellQuote(path)} ]; then\n  printf '%s\\n' 'Managed Calibre unavailable framework appeared; run bun autoshow setup --step calibre.' >&2\n  exit 1\nfi\n`).join('')
  const disabledImages = unavailableComponents.map((component, index) => `calibre_disabled_image_${index}_dir=$(CDPATH= cd -P "$calibre_app_dir"/${shellQuote(dirname(component.image))} && pwd -P) || exit 1
calibre_disabled_image_${index}="$calibre_disabled_image_${index}_dir"/${shellQuote(basename(component.image))}
case "$calibre_disabled_image_${index}" in "$calibre_app_dir"/*) ;; *) printf '%s\\n' 'Managed Calibre disabled component escapes its signed package.' >&2; exit 1 ;; esac
if [ -L "$calibre_disabled_image_${index}" ] || [ ! -f "$calibre_disabled_image_${index}" ]; then
  printf '%s\\n' 'Managed Calibre disabled component changed; run bun autoshow setup --step calibre.' >&2
  exit 1
fi
`).join('')
  const sandboxInvocation = [
    'exec /usr/bin/sandbox-exec', '-p', shellQuote(buildManagedCalibreSandboxProfile(unavailableComponents.length)),
    ...unavailableComponents.flatMap((_, index) => ['-D', `"CALIBRE_DISABLED_IMAGE_${index}=$calibre_disabled_image_${index}"`]),
    '"$calibre_app_dir/Contents/MacOS/ebook-convert"', '"$@"'
  ].join(' ')
  const signatureSandbox = `/usr/bin/sandbox-exec -p ${shellQuote(buildManagedCalibreSandboxProfile(0))}`
  return `#!/bin/sh
${clearDynamicLibraryOverrides}
calibre_runtime_dir=$(CDPATH= cd -P "$(/usr/bin/dirname "$0")/.." && pwd -P) || exit 1
export CALIBRE_CACHE_DIRECTORY="$calibre_runtime_dir/cache/calibre"
export CALIBRE_CONFIG_DIRECTORY="$calibre_runtime_dir/state/calibre"
${systemAliasGuard}${producerGuards}calibre_app_dir=$(CDPATH= cd -P "$calibre_runtime_dir/tools/calibre/calibre.app" && pwd -P) || exit 1
case "$calibre_app_dir" in "$calibre_runtime_dir"/*) ;; *) printf '%s\\n' 'Managed Calibre application escapes runtime.' >&2; exit 1 ;; esac
${frameworkGuards}${disabledImages}if [ ! -x /usr/bin/sandbox-exec ]; then
  printf '%s\\n' 'Managed Calibre requires the macOS sandbox for its supported CLI components.' >&2
  exit 1
fi
${signatureSandbox} /usr/bin/codesign --verify --deep --strict "$calibre_app_dir" || exit $?
${signatureSandbox} /usr/sbin/spctl --assess --type execute "$calibre_app_dir" || exit $?
${sandboxInvocation}
`
}

export const ensurePinnedTesseractData = async (source: {
  url: string, sha256: string, destination: string, expectedMinBytes?: number, forceRedownload?: boolean
}): Promise<boolean> => await withProcessLock(`setup-tessdata-${source.destination}`, async () => {
  assertRuntimeContainedPath(source.destination)
  const valid = await pathExists(source.destination) && await sha256File(source.destination) === source.sha256
  if (!source.forceRedownload && valid) return false
  await mkdir(dirname(source.destination), { recursive: true })
  // A stable, pin-specific staging path reuses an interrupted transfer while
  // retaining the installed language file until replacement verification passes.
  const stagedDataPath = `${source.destination}.incoming-${source.sha256.slice(0, 16)}`
  try {
    await downloadFile({
      url: source.url,
      sha256: source.sha256,
      destination: stagedDataPath,
      flowId: 'tessdata',
      expectedMinBytes: source.expectedMinBytes ?? 1_000_000
    })
    await rename(stagedDataPath, source.destination)
  } finally { await rm(stagedDataPath, { force: true }) }
  return true
})

const installManagedTessdataEng = async (options: ManagedMacosInstallOptions): Promise<void> => {
  const { url, sha256 } = await readDependencyUrlAndSha256('tessdataEng')
  await ensurePinnedTesseractData({ url, sha256, destination: englishTrainedDataPath, ...options })
  await ensureManagedTessdataSupportFiles()
}

export const ensureManagedTessdataSupportFiles = async (): Promise<void> => {
  assertRuntimeContainedPath(tessdataDir)
  await mkdir(tessdataDir, { recursive: true })
  for (const dirName of managedTessdataSupportDirs) {
    const sourceDir = join(tesseractInstalledTessdataDir, dirName)
    assertRuntimeContainedPath(sourceDir)
    assertRuntimeContainedPath(join(tessdataDir, dirName))
    if (!await pathExists(sourceDir)) {
      continue
    }

    await cp(sourceDir, join(tessdataDir, dirName), {
      recursive: true,
      force: true
    })
  }
}

export const buildManagedLeptonicaCmakeArguments = (buildDir: string, installDir: string): string[] => [
  '-S', leptonicaBuildDir, '-B', buildDir, `-DCMAKE_INSTALL_PREFIX=${installDir}`,
  ...MANAGED_LEPTONICA_BUILD_FLAGS,
  `-DZLIB_INCLUDE_DIR=${join(nativeDependencyPrefix('zlib'), 'include')}`,
  `-DZLIB_LIBRARY=${join(nativeDependencyPrefix('zlib'), 'lib/libz.a')}`,
  `-DPNG_PNG_INCLUDE_DIR=${join(nativeDependencyPrefix('libpng'), 'include')}`,
  `-DPNG_LIBRARY=${join(nativeDependencyPrefix('libpng'), 'lib/libpng16.a')}`,
  `-DJPEG_INCLUDE_DIR=${join(nativeDependencyPrefix('libjpeg-turbo'), 'include')}`,
  `-DJPEG_LIBRARY=${join(nativeDependencyPrefix('libjpeg-turbo'), 'lib/libjpeg.a')}`,
  `-DTIFF_INCLUDE_DIR=${join(nativeDependencyPrefix('libtiff'), 'include')}`,
  `-DTIFF_LIBRARY=${join(nativeDependencyPrefix('libtiff'), 'lib/libtiff.a')}`,
  '-DCMAKE_FIND_USE_SYSTEM_ENVIRONMENT_PATH=OFF'
]

export const buildManagedTesseractCmakeArguments = (buildDir: string, installDir: string): string[] => [
  '-S', tesseractBuildDir, '-B', buildDir, `-DCMAKE_INSTALL_PREFIX=${installDir}`,
  `-DLeptonica_DIR=${leptonicaCmakeConfigDir}`, ...MANAGED_TESSERACT_BUILD_FLAGS,
  '-DCMAKE_FIND_USE_SYSTEM_ENVIRONMENT_PATH=OFF'
]

export const completeManagedLeptonicaConfig = (configuration: string): string => configuration.replace(
  'include(CMakeFindDependencyMacro)',
  'include(CMakeFindDependencyMacro)\nfind_dependency(ZLIB REQUIRED)\nfind_dependency(PNG REQUIRED)\nfind_dependency(JPEG REQUIRED)\nfind_dependency(TIFF REQUIRED)'
)

const installManagedLeptonicaMacos = async (options: ManagedMacosInstallOptions): Promise<void> => withProcessLock(`setup-leptonica-${leptonicaBuildDir}`, async () => {
  await recoverManagedToolDirectory(leptonicaToolDir)
  const dependencies = await nativeDependencyIdentities(nativeCodecDependencies)
  if (!options.forceRedownload && await hasSourceRecipe('leptonica', leptonicaToolDir, leptonicaRecipe, dependencies)) return
  await prepareManagedSourceBuild(leptonicaBuildDir)
  await downloadSource('leptonica', leptonicaBuildDir, 'leptonica-source', options.forceRedownload)
  const buildDir = join(leptonicaBuildDir, 'build')
  await recreateDir(buildDir)
  const env = managedNativeBuildEnv(nativeCodecDependencies)
  const cmake = managedBuildToolPath('cmake')
  const jobs = resolveSetupSourceBuildParallelJobs()
  const stagingDir = await createManagedToolStagingDirectory(leptonicaToolDir)
  try {
    await recordSetupPerformancePhase('leptonica', 'configure-generate', async () => {
      await runInherit(cmake, buildManagedLeptonicaCmakeArguments(buildDir, leptonicaToolDir), { env })
    })
    await recordSetupPerformancePhase('leptonica', 'compile-link', async () => {
      await runInherit(cmake, ['--build', buildDir, '--parallel', String(jobs)], { env })
    }, { parallelJobs: jobs })
    await recordSetupPerformancePhase('leptonica', 'install-promote', async () => {
      await runInherit(cmake, ['--install', buildDir, '--prefix', stagingDir], { env })
      const configPath = join(stagingDir, 'lib/cmake/leptonica/LeptonicaConfig.cmake')
      await Bun.write(configPath, completeManagedLeptonicaConfig(await Bun.file(configPath).text()))
      await copySourceNotices(leptonicaBuildDir, stagingDir, 'leptonica')
      await normalizeManagedNativeMetadata(stagingDir, leptonicaToolDir)
      await writeSourceRecipe('leptonica', stagingDir, leptonicaRecipe, dependencies)
      await promoteManagedToolDirectory({
        stagingDir, destinationDir: leptonicaToolDir,
        validateStaging: async toolDir => await validateSourceRecipe('leptonica', toolDir, leptonicaRecipe, dependencies)
      })
    })
  } catch (error) { preserveStagedFailure(stagingDir, error) }
  await discardBuildTree(leptonicaBuildDir)
})

const tesseractDependencyIdentities = async (): Promise<ManagedArtifactDependency[]> => [
  await sourceDependencyIdentity('leptonica', leptonicaToolDir), ...await nativeDependencyIdentities(nativeCodecDependencies)
]

const validateTesseractInstall = async (toolDir: string, dependencies: ManagedArtifactDependency[]): Promise<void> => {
  await validateSourceRecipe('tesseract', toolDir, tesseractRecipe, dependencies)
  const binary = join(toolDir, 'bin/tesseract')
  await assertManagedDynamicLibraryClosure([binary])
  const version = await runCapture(binary, ['--version'], { allowFailure: true })
  if (version.exitCode !== 0 || !version.stdout.includes((await readDependencyVersion('tesseract')) ?? 'missing-version')) {
    throw InfraError('Managed Tesseract failed its pinned version check', { stage: 'setup:tesseract' })
  }
  const output = `${version.stdout}\n${version.stderr}`
  for (const codec of ['libpng', 'libjpeg', 'libtiff']) {
    if (!output.includes(codec)) throw InfraError(`Managed Tesseract/Leptonica is missing ${codec} decoding support`, { stage: 'setup:tesseract' })
  }
}

export const hasManagedTesseractBuild = async (): Promise<boolean> => {
  try {
    await validateTesseractInstall(tesseractToolDir, await tesseractDependencyIdentities())
    const wrapper = await Bun.file(tesseractManagedBinaryPath).text()
    return wrapper === buildManagedTesseractWrapperScript()
  } catch { return false }
}

export const installManagedTesseractMacos = async (options: ManagedMacosInstallOptions = {}): Promise<void> =>
  withProcessLock(`setup-tesseract-${tesseractBuildDir}`, async () => await installManagedTesseractMacosUnlocked(options))

const installManagedTesseractMacosUnlocked = async (options: ManagedMacosInstallOptions): Promise<void> => {
  await recoverManagedToolDirectory(tesseractToolDir)
  await ensureManagedMacosSourceDependencies(nativeCodecDependencies, [installManagedLeptonicaMacos], options)
  const dependencies = await tesseractDependencyIdentities()
  if (options.forceRedownload || !await hasSourceRecipe('tesseract', tesseractToolDir, tesseractRecipe, dependencies)) {
    await prepareManagedSourceBuild(tesseractBuildDir)
    await downloadSource('tesseract', tesseractBuildDir, 'tesseract-source', options.forceRedownload)
    const buildDir = join(tesseractBuildDir, 'build')
    await recreateDir(buildDir)
    const nativeEnv = managedNativeBuildEnv(nativeCodecDependencies)
    const env = {
      ...nativeEnv,
      CMAKE_PREFIX_PATH: [leptonicaToolDir, nativeEnv['CMAKE_PREFIX_PATH']].filter(Boolean).join(':'),
      PKG_CONFIG_LIBDIR: [join(leptonicaToolDir, 'lib/pkgconfig'), nativeEnv['PKG_CONFIG_LIBDIR']].filter(Boolean).join(':')
    }
    const cmake = managedBuildToolPath('cmake')
    const jobs = resolveSetupSourceBuildParallelJobs()
    const stagingDir = await createManagedToolStagingDirectory(tesseractToolDir)
    try {
      await recordSetupPerformancePhase('tesseract', 'configure-generate', async () => {
        await runInherit(cmake, buildManagedTesseractCmakeArguments(buildDir, tesseractToolDir), { env })
      })
      await recordSetupPerformancePhase('tesseract', 'compile-link', async () => {
        await runInherit(cmake, ['--build', buildDir, '--parallel', String(jobs)], { env })
      }, { parallelJobs: jobs })
      await recordSetupPerformancePhase('tesseract', 'install-promote', async () => {
        await runInherit(cmake, ['--install', buildDir, '--prefix', stagingDir], { env })
        await copySourceNotices(tesseractBuildDir, stagingDir, 'tesseract')
        await normalizeManagedNativeMetadata(stagingDir, tesseractToolDir)
        await writeSourceRecipe('tesseract', stagingDir, tesseractRecipe, dependencies)
        await promoteManagedToolDirectory({
          stagingDir, destinationDir: tesseractToolDir,
          validateStaging: async toolDir => await validateTesseractInstall(toolDir, dependencies),
          activate: async () => await writeExecutableScript(tesseractManagedBinaryPath, buildManagedTesseractWrapperScript()),
          rollbackActivation: async hadPreviousInstall => { if (!hadPreviousInstall) await rm(tesseractManagedBinaryPath, { force: true }) }
        })
      })
    } catch (error) { preserveStagedFailure(stagingDir, error) }
    await discardBuildTree(tesseractBuildDir)
  }
  await validateTesseractInstall(tesseractToolDir, dependencies)
  await installManagedTessdataEng(options)
  await writeExecutableScript(tesseractManagedBinaryPath, buildManagedTesseractWrapperScript())
}

export const installManagedQpdfMacos = async (options: ManagedMacosInstallOptions = {}): Promise<void> =>
  withProcessLock(`setup-qpdf-${qpdfBuildDir}`, async () => await installManagedQpdfMacosUnlocked(options))

const installManagedQpdfMacosUnlocked = async (options: ManagedMacosInstallOptions): Promise<void> => {
  await recoverManagedToolDirectory(qpdfToolDir)
  await ensureManagedMacosSourceDependencies([], [], options)
  const cmake = managedBuildToolPath('cmake')
  const existingSourceInstallHealthy = !options.forceRedownload && await hasValidManagedSourcePayload('qpdf')
  if (!existingSourceInstallHealthy) {
    await prepareManagedSourceBuild(qpdfBuildDir)
    const layout = resolveQpdfSourceBuildLayout(qpdfBuildDir)
    await downloadSource('libjpeg-turbo', layout.libjpegTurboSourceDir, 'libjpeg-turbo-source', options.forceRedownload)
    await downloadSource('qpdf', layout.qpdfSourceDir, 'qpdf-source', options.forceRedownload)
    await recreateDir(layout.libjpegTurboCmakeBuildDir)
    await recreateDir(layout.libjpegTurboInstallDir)
    const deploymentTarget = await resolveSourceDeploymentTarget()
    await recordSetupPerformancePhase('libjpeg-turbo', 'configure-generate', async () => {
      await runInherit(cmake, buildLibjpegTurboCmakeArguments(layout, deploymentTarget))
    })
    const jobs = resolveSetupSourceBuildParallelJobs()
    await recordSetupPerformancePhase('libjpeg-turbo', 'compile-link', async () => {
      await runInherit(cmake, [
        '--build', layout.libjpegTurboCmakeBuildDir,
        '--target', 'jpeg-static',
        '--parallel', String(jobs)
      ])
    }, { parallelJobs: jobs })
    await recordSetupPerformancePhase('libjpeg-turbo', 'install-promote', async () => {
      await runInherit(cmake, ['--install', layout.libjpegTurboCmakeBuildDir])
    })
    await recreateDir(layout.qpdfCmakeBuildDir)
    const qpdfBuildEnv = buildQpdfSourceEnvironment(layout)
    await recordSetupPerformancePhase('qpdf', 'configure-generate', async () => {
      await runInherit(cmake, buildQpdfCmakeArguments(layout, join(qpdfBuildDir, 'install/qpdf'), deploymentTarget), {
        env: qpdfBuildEnv
      })
    })
    await recordSetupPerformancePhase('qpdf', 'compile-link', async () => {
      await runInherit(cmake, [
        '--build', layout.qpdfCmakeBuildDir,
        '--target', 'qpdf',
        '--parallel', String(jobs)
      ], { env: qpdfBuildEnv })
    }, { parallelJobs: jobs })
    await recordSetupPerformancePhase('qpdf', 'install-promote', async () => {
      const stagingDir = await createManagedToolStagingDirectory(qpdfToolDir)
      try {
        const stagedQpdf = join(stagingDir, 'bin/qpdf')
        await mkdir(dirname(stagedQpdf), { recursive: true })
        await cp(layout.builtQpdfPath, stagedQpdf)
        await makeExecutable(stagedQpdf)
        await assertPortableQpdfDynamicLibraryClosure(stagedQpdf)
        await copySourceNotices(layout.qpdfSourceDir, stagingDir, 'qpdf')
        await copySourceNotices(layout.libjpegTurboSourceDir, stagingDir, 'libjpeg-turbo')
        await copyApprovedToolchainNotices('qpdf', { qpdf: layout.qpdfSourceDir, 'libjpeg-turbo': layout.libjpegTurboSourceDir }, stagingDir)
        await Bun.write(join(stagingDir, '.autoshow-managed-build'), QPDF_SOURCE_RECIPE_STAMP)
        await writeManagedSourceArtifactManifest({ tool: 'qpdf', toolDir: stagingDir, deploymentTarget })
        await promoteManagedToolDirectory({
          stagingDir,
          destinationDir: qpdfToolDir,
          validateStaging: async (toolDir) => {
            await assertPortableQpdfDynamicLibraryClosure(join(toolDir, 'bin/qpdf'))
            await assertManagedSourceInstallAt('qpdf', toolDir)
          },
          activate: async () => {
            await writeExecutableScript(qpdfManagedBinaryPath, buildManagedQpdfWrapperScript())
            const version = await runCapture(qpdfManagedBinaryPath, ['--version'], { allowFailure: true })
            if (version.exitCode !== 0) {
              throw InfraError('Managed qpdf wrapper failed its version check', { stage: 'setup:qpdf' })
            }
          },
          rollbackActivation: async (hadPreviousInstall) => {
            if (!hadPreviousInstall) await rm(qpdfManagedBinaryPath, { force: true })
          }
        })
      } catch (error) {
        preserveStagedFailure(stagingDir, error)
      }
    })
  } else {
    await writeExecutableScript(qpdfManagedBinaryPath, buildManagedQpdfWrapperScript())
  }
  await recordSetupPerformancePhase('qpdf', 'cleanup', async () => {
    await discardBuildTree(qpdfBuildDir)
  })
}
