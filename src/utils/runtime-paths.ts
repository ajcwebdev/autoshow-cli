import { existsSync } from 'node:fs'
import { basename, dirname, extname, isAbsolute, join, posix, relative, resolve } from 'node:path'
import type { ResolvedRuntimeTool, ResolveRuntimeToolOptions, RuntimeToolId } from '~/types'
import { ValidationError } from '~/utils/error-handler'

const projectRootOverride = process.env['AUTOSHOW_PROJECT_ROOT']?.trim()
export const PROJECT_ROOT = projectRootOverride
  ? resolve(projectRootOverride)
  : Bun.isStandaloneExecutable
    ? dirname(process.execPath)
    : resolve(import.meta.dir, '../..')
export const IMMUTABLE_ASSET_ROOT = Bun.isStandaloneExecutable ? import.meta.dir : PROJECT_ROOT
export const toPosixPath = (value: string): string => value.replace(/\\/g, '/')
export const toProjectDisplayPath = (absolutePath: string): string => {
  const rel = relative(PROJECT_ROOT, absolutePath)
  return rel.length === 0 || rel.startsWith('..') || isAbsolute(rel) ? absolutePath : toPosixPath(rel)
}

export interface SourceIdentityPathMapping {
  sourceRoot?: string | undefined
  aliasRoot?: string | undefined
}

const configuredSourceIdentityPathMapping = (): SourceIdentityPathMapping => ({
  sourceRoot: process.env['AUTOSHOW_SOURCE_IDENTITY_ROOT']?.trim(),
  aliasRoot: process.env['AUTOSHOW_SOURCE_IDENTITY_ALIAS']?.trim(),
})

export const toSourceIdentityDisplayPath = (
  absolutePath: string,
  mapping: SourceIdentityPathMapping = configuredSourceIdentityPathMapping()
): string => {
  const sourceRoot = mapping.sourceRoot?.trim()
  const aliasRoot = mapping.aliasRoot?.trim()
  if (!sourceRoot && !aliasRoot) return toPosixPath(toProjectDisplayPath(absolutePath))
  if (!sourceRoot || !aliasRoot) throw ValidationError('AUTOSHOW_SOURCE_IDENTITY_ROOT and AUTOSHOW_SOURCE_IDENTITY_ALIAS must be set together.', { stage: 'runtime:source-identity' })
  if (!isAbsolute(sourceRoot)) throw ValidationError('AUTOSHOW_SOURCE_IDENTITY_ROOT must be an absolute filesystem path.', { stage: 'runtime:source-identity' })
  if (!posix.isAbsolute(aliasRoot) || aliasRoot.includes('\\') || aliasRoot.split('/').some(part => part === '.' || part === '..') || posix.normalize(aliasRoot) !== aliasRoot) {
    throw ValidationError('AUTOSHOW_SOURCE_IDENTITY_ALIAS must be a normalized absolute POSIX path without traversal.', { stage: 'runtime:source-identity' })
  }
  const resolvedRoot = resolve(sourceRoot)
  const resolvedPath = resolve(absolutePath)
  const rel = relative(resolvedRoot, resolvedPath)
  if (rel.startsWith('..') || isAbsolute(rel)) return toPosixPath(toProjectDisplayPath(resolvedPath))
  return rel.length === 0 ? aliasRoot : posix.join(aliasRoot, toPosixPath(rel))
}
export const resolveUserPath = (value: string): string => resolve(PROJECT_ROOT, value)
export const baseStem = (filePath: string): string => basename(filePath, extname(filePath))
export const RUNTIME_DIR = join(PROJECT_ROOT, 'runtime')
export const RUNTIME_BIN_DIR = join(RUNTIME_DIR, 'bin')
export const RUNTIME_BUILD_DIR = join(RUNTIME_DIR, 'build')
export const RUNTIME_TOOLS_DIR = join(RUNTIME_DIR, 'tools')

export const ytDlpManagedBinaryPath = join(RUNTIME_BIN_DIR, 'yt-dlp')

export const ffmpegToolDir = join(RUNTIME_TOOLS_DIR, 'ffmpeg')
export const ffmpegBuildDir = join(RUNTIME_BUILD_DIR, 'ffmpeg')
export const lameToolDir = join(RUNTIME_TOOLS_DIR, 'lame')
export const lameBuildDir = join(RUNTIME_BUILD_DIR, 'lame')
export const ffmpegManagedBinaryPath = join(RUNTIME_BIN_DIR, 'ffmpeg')
export const ffprobeManagedBinaryPath = join(RUNTIME_BIN_DIR, 'ffprobe')
export const ffmpegInstalledBinaryPath = join(ffmpegToolDir, 'bin/ffmpeg')
export const ffprobeInstalledBinaryPath = join(ffmpegToolDir, 'bin/ffprobe')

export const mupdfToolDir = join(RUNTIME_TOOLS_DIR, 'mupdf')
export const mupdfBuildDir = join(RUNTIME_BUILD_DIR, 'mupdf')
export const mutoolManagedBinaryPath = join(RUNTIME_BIN_DIR, 'mutool')
export const mutoolInstalledBinaryPath = join(mupdfToolDir, 'bin/mutool')

export const calibreToolDir = join(RUNTIME_TOOLS_DIR, 'calibre')
export const calibreAppPath = join(calibreToolDir, 'calibre.app')
export const ebookConvertManagedBinaryPath = join(RUNTIME_BIN_DIR, 'ebook-convert')
export const ebookConvertInstalledBinaryPath = join(calibreAppPath, 'Contents/MacOS/ebook-convert')

export const leptonicaToolDir = join(RUNTIME_TOOLS_DIR, 'leptonica')
export const leptonicaBuildDir = join(RUNTIME_BUILD_DIR, 'leptonica')
export const tesseractToolDir = join(RUNTIME_TOOLS_DIR, 'tesseract')
export const tesseractBuildDir = join(RUNTIME_BUILD_DIR, 'tesseract')
export const tesseractManagedBinaryPath = join(RUNTIME_BIN_DIR, 'tesseract')
export const tesseractInstalledBinaryPath = join(tesseractToolDir, 'bin/tesseract')
export const tessdataDir = join(RUNTIME_TOOLS_DIR, 'tessdata')
export const englishTrainedDataPath = join(tessdataDir, 'eng.traineddata')
export const tessdataHocrConfigPath = join(tessdataDir, 'configs/hocr')
export const tessdataBatchConfigPath = join(tessdataDir, 'tessconfigs/batch')

export const qpdfToolDir = join(RUNTIME_TOOLS_DIR, 'qpdf')
export const qpdfBuildDir = join(RUNTIME_BUILD_DIR, 'qpdf')
export const qpdfManagedBinaryPath = join(RUNTIME_BIN_DIR, 'qpdf')
export const qpdfInstalledBinaryPath = join(qpdfToolDir, 'bin/qpdf')

const TOOL_MANAGED_PATHS: Record<RuntimeToolId, string> = {
  ffmpeg: ffmpegManagedBinaryPath,
  ffprobe: ffprobeManagedBinaryPath,
  'yt-dlp': ytDlpManagedBinaryPath,
  mutool: mutoolManagedBinaryPath,
  'ebook-convert': ebookConvertManagedBinaryPath,
  tesseract: tesseractManagedBinaryPath,
  qpdf: qpdfManagedBinaryPath
}

const nonEmpty = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

let overrideBinDir: string | undefined

export const configureBinDir = (dir: string): void => {
  overrideBinDir = nonEmpty(dir)
}

export const getConfiguredBinDir = (): string | undefined => overrideBinDir

export const resolveRuntimeToolInfo = (
  id: RuntimeToolId,
  options: ResolveRuntimeToolOptions = {}
): ResolvedRuntimeTool | undefined => {
  const exists = options.exists ?? existsSync
  const which = options.which ?? ((command: string) => Bun.which(command))
  const platform = options.platform ?? process.platform
  const overrideDir = nonEmpty(options.overrideBinDir ?? overrideBinDir)
  if (overrideDir) {
    const overridePath = join(overrideDir, id)
    if (exists(overridePath)) {
      return { id, path: overridePath, source: 'override' }
    }
  }

  const managedPath = TOOL_MANAGED_PATHS[id]
  if (exists(managedPath)) {
    return { id, path: managedPath, source: 'managed' }
  }

  if (platform === 'darwin') {
    return undefined
  }

  const pathBinary = which(id)
  return pathBinary ? { id, path: pathBinary, source: 'path' } : undefined
}

const getRuntimeToolCommand = (id: RuntimeToolId): string =>
  resolveRuntimeToolInfo(id)?.path ?? (process.platform === 'darwin' ? TOOL_MANAGED_PATHS[id] : id)

export const hasRuntimeTool = (id: RuntimeToolId, options: ResolveRuntimeToolOptions = {}): boolean =>
  resolveRuntimeToolInfo(id, options) !== undefined

export const getFfmpegBinary = (): string => getRuntimeToolCommand('ffmpeg')
export const getFfprobeBinary = (): string => getRuntimeToolCommand('ffprobe')
export const getYtDlpBinaryPath = (): string => getRuntimeToolCommand('yt-dlp')
export const getMutoolBinary = (): string => getRuntimeToolCommand('mutool')
export const getTesseractBinary = (): string => getRuntimeToolCommand('tesseract')

export const resolveTessdataPrefix = (): string => tessdataDir
