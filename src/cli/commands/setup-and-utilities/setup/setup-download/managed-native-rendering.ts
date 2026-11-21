import { constants } from 'node:fs'
import { access, copyFile, lstat, mkdir, mkdtemp, readdir, realpath, rename, rm } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { exec } from '~/utils/cli-utils'
import { InfraError } from '~/utils/error-handler'
import { makeExecutable } from '~/utils/filesystem'
import { RUNTIME_DIR } from '~/utils/runtime-paths'
import { promoteManagedToolDirectory } from './managed-artifact'

export type ManagedRenderingOptions = { runtimeRoot?: string }

const renderingPaths = (options: ManagedRenderingOptions = {}) => {
  const runtimeRoot = resolve(options.runtimeRoot ?? RUNTIME_DIR)
  const fontsDirectory = join(runtimeRoot, 'fonts/dejavu')
  const fontconfigDirectory = join(runtimeRoot, 'fonts/fontconfig')
  return {
    runtimeRoot,
    fontsDirectory,
    fontconfigDirectory,
    fontCacheDirectory: join(runtimeRoot, 'cache/fontconfig'),
    temporaryDirectory: join(runtimeRoot, 'tmp'),
    fontconfigFile: join(fontconfigDirectory, 'fonts.conf'),
    prefix: (name: string) => join(runtimeRoot, 'tools/native', name),
    binary: (name: string) => join(runtimeRoot, 'bin', name)
  }
}

export const managedRenderingEnvironment = (options: ManagedRenderingOptions = {}): Record<string, string> => {
  const paths = renderingPaths(options)
  return {
    FONTCONFIG_PATH: paths.fontconfigDirectory,
    FONTCONFIG_FILE: paths.fontconfigFile,
    XDG_CACHE_HOME: join(paths.runtimeRoot, 'cache'),
    MAGICK_HOME: paths.prefix('imagemagick'),
    MAGICK_CONFIGURE_PATH: join(paths.prefix('imagemagick'), 'etc/ImageMagick-7'),
    MAGICK_FONT_PATH: paths.fontsDirectory,
    MAGICK_TEMPORARY_PATH: paths.temporaryDirectory,
    PANGOCAIRO_BACKEND: 'fontconfig'
  }
}

const containedPath = (root: string, candidate: string): boolean => {
  const child = relative(root, candidate)
  return child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child)
}

const requireManagedPath = async (root: string, candidate: string): Promise<void> => {
  const [realRoot, realCandidate] = await Promise.all([realpath(root), realpath(candidate)])
  if (!containedPath(realRoot, realCandidate)) {
    throw InfraError(`Managed rendering path escapes runtime: ${relative(root, candidate)}`, { stage: 'setup:rendering' })
  }
}

const ensureContainedDirectory = async (root: string, path: string): Promise<void> => {
  if (!containedPath(root, path)) throw InfraError('Managed rendering directory must stay inside runtime.', { stage: 'setup:rendering' })
  let current = root
  for (const part of relative(root, path).split(sep).filter(Boolean)) {
    current = join(current, part)
    try { await mkdir(current) } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
    await requireManagedPath(root, current)
  }
}

const isRegularFile = async (path: string): Promise<boolean> => {
  try { return (await lstat(path)).isFile() } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

const atomicWrite = async (root: string, path: string, value: string, executable = false): Promise<void> => {
  await ensureContainedDirectory(root, dirname(path))
  const current = Bun.file(path)
  if (await isRegularFile(path) && await current.text() === value) {
    if (executable) await access(path, constants.X_OK).catch(async () => await makeExecutable(path))
    return
  }
  const temporary = `${path}.tmp-${crypto.randomUUID()}`
  try {
    await Bun.write(temporary, value)
    if (executable) await makeExecutable(temporary)
    await rename(temporary, path)
  } finally {
    await rm(temporary, { force: true })
  }
}

// Relative font paths keep this configuration valid after relocating runtime.
// Its sole cache uses XDG_CACHE_HOME supplied by the managed child environment.
export const MANAGED_FONTCONFIG_DOCUMENT = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir prefix="relative">../dejavu</dir>
  <cachedir prefix="xdg">fontconfig</cachedir>
  <alias><family>sans-serif</family><prefer><family>DejaVu Sans</family></prefer></alias>
  <alias><family>serif</family><prefer><family>DejaVu Serif</family></prefer></alias>
  <alias><family>monospace</family><prefer><family>DejaVu Sans Mono</family></prefer></alias>
  <config><rescan><int>0</int></rescan></config>
</fontconfig>
`

const fontDirectoryMatches = async (sourceDirectory: string, installedDirectory: string, fonts: readonly string[]): Promise<boolean> => {
  const installed = (await readdir(installedDirectory)).filter(name => name.endsWith('.ttf')).sort()
  if (fonts.join('\n') !== installed.join('\n')) return false
  for (const font of fonts) {
    const destination = join(installedDirectory, font)
    if (!await isRegularFile(destination) || !Buffer.from(await Bun.file(join(sourceDirectory, font)).arrayBuffer()).equals(Buffer.from(await Bun.file(destination).arrayBuffer()))) return false
  }
  return true
}

export const ensureManagedRenderingConfiguration = async (options: ManagedRenderingOptions = {}): Promise<void> => {
  const paths = renderingPaths(options)
  const sourceFonts = join(paths.prefix('dejavu-fonts'), 'share/fonts/truetype/dejavu')
  await requireManagedPath(paths.runtimeRoot, sourceFonts)
  const fonts = (await readdir(sourceFonts)).filter(name => name.endsWith('.ttf')).sort()
  if (!fonts.includes('DejaVuSans.ttf') || !fonts.includes('DejaVuSans-Bold.ttf')) {
    throw InfraError('Managed DejaVu fonts are incomplete; run setup --step rendering.', { stage: 'setup:rendering' })
  }
  for (const font of fonts) await requireManagedPath(paths.runtimeRoot, join(sourceFonts, font))
  await Promise.all([
    paths.fontsDirectory,
    paths.fontconfigDirectory,
    paths.fontCacheDirectory,
    paths.temporaryDirectory
  ].map(path => ensureContainedDirectory(paths.runtimeRoot, path)))
  if (!await fontDirectoryMatches(sourceFonts, paths.fontsDirectory, fonts)) {
    const stagingDirectory = `${paths.fontsDirectory}.staging-${crypto.randomUUID()}`
    await mkdir(stagingDirectory)
    try {
      for (const font of fonts) await copyFile(join(sourceFonts, font), join(stagingDirectory, font))
      await promoteManagedToolDirectory({
        stagingDir: stagingDirectory,
        destinationDir: paths.fontsDirectory,
        validateStaging: async directory => {
          if (!await fontDirectoryMatches(sourceFonts, directory, fonts)) {
            throw InfraError('Managed font staging differs from its verified source package.', { stage: 'setup:rendering' })
          }
        }
      })
    } finally {
      await rm(stagingDirectory, { recursive: true, force: true })
    }
  }
  await atomicWrite(paths.runtimeRoot, paths.fontconfigFile, MANAGED_FONTCONFIG_DOCUMENT)
}

const RENDERING_ENTRYPOINTS = [
  { name: 'magick', dependency: 'imagemagick', executable: 'magick' },
  { name: 'convert', dependency: 'imagemagick', executable: 'magick' },
  { name: 'pango-view', dependency: 'pango', executable: 'pango-view' },
  { name: 'fc-match', dependency: 'fontconfig', executable: 'fc-match' },
  { name: 'fc-cache', dependency: 'fontconfig', executable: 'fc-cache' }
] as const

const renderingWrapper = (dependency: string, executable: string): string => `#!/bin/sh
render_runtime_dir=$(CDPATH= cd "$(dirname "$0")/.." && pwd) || exit 1
export FONTCONFIG_PATH="$render_runtime_dir/fonts/fontconfig"
export FONTCONFIG_FILE="$FONTCONFIG_PATH/fonts.conf"
export XDG_CACHE_HOME="$render_runtime_dir/cache"
export MAGICK_HOME="$render_runtime_dir/tools/native/imagemagick"
export MAGICK_CONFIGURE_PATH="$MAGICK_HOME/etc/ImageMagick-7"
export MAGICK_FONT_PATH="$render_runtime_dir/fonts/dejavu"
export MAGICK_TEMPORARY_PATH="$render_runtime_dir/tmp"
export PANGOCAIRO_BACKEND=fontconfig
exec "$render_runtime_dir/tools/native/${dependency}/bin/${executable}" "$@"
`

export const activateManagedRenderingTools = async (options: ManagedRenderingOptions = {}): Promise<void> => {
  const paths = renderingPaths(options)
  for (const entry of RENDERING_ENTRYPOINTS) {
    const target = join(paths.prefix(entry.dependency), 'bin', entry.executable)
    await requireManagedPath(paths.runtimeRoot, target)
    await access(target, constants.X_OK)
  }
  for (const entry of RENDERING_ENTRYPOINTS) {
    await atomicWrite(paths.runtimeRoot, paths.binary(entry.name), renderingWrapper(entry.dependency, entry.executable), true)
  }
}

export const validateManagedRenderingConfiguration = async (options: ManagedRenderingOptions = {}): Promise<{ healthy: true } | { healthy: false, reason: string }> => {
  const paths = renderingPaths(options)
  try {
    const sourceFonts = join(paths.prefix('dejavu-fonts'), 'share/fonts/truetype/dejavu')
    for (const directory of [sourceFonts, paths.fontsDirectory, paths.fontconfigDirectory, paths.fontCacheDirectory, paths.temporaryDirectory]) {
      await requireManagedPath(paths.runtimeRoot, directory)
      if (!(await lstat(directory)).isDirectory()) return { healthy: false, reason: `Managed rendering directory is invalid: ${relative(paths.runtimeRoot, directory)}` }
    }
    const sourceNames = (await readdir(sourceFonts)).filter(name => name.endsWith('.ttf')).sort()
    const installedNames = (await readdir(paths.fontsDirectory)).filter(name => name.endsWith('.ttf')).sort()
    if (!sourceNames.includes('DejaVuSans.ttf') || !sourceNames.includes('DejaVuSans-Bold.ttf') || sourceNames.join('\n') !== installedNames.join('\n')) {
      return { healthy: false, reason: 'Managed font inventory differs from the installed DejaVu package.' }
    }
    for (const name of sourceNames) {
      const source = join(sourceFonts, name)
      const installed = join(paths.fontsDirectory, name)
      await requireManagedPath(paths.runtimeRoot, source)
      await requireManagedPath(paths.runtimeRoot, installed)
      if (!await isRegularFile(installed) || !Buffer.from(await Bun.file(source).arrayBuffer()).equals(Buffer.from(await Bun.file(installed).arrayBuffer()))) {
        return { healthy: false, reason: `Managed font differs from the installed DejaVu package: ${name}` }
      }
    }
    if (!await isRegularFile(paths.fontconfigFile) || await Bun.file(paths.fontconfigFile).text() !== MANAGED_FONTCONFIG_DOCUMENT) {
      return { healthy: false, reason: 'Managed Fontconfig configuration is missing or changed.' }
    }
    for (const entry of RENDERING_ENTRYPOINTS) {
      const wrapper = paths.binary(entry.name)
      await requireManagedPath(paths.runtimeRoot, wrapper)
      if (!await isRegularFile(wrapper) || await Bun.file(wrapper).text() !== renderingWrapper(entry.dependency, entry.executable)) {
        return { healthy: false, reason: `Managed rendering entrypoint is missing or changed: ${entry.name}` }
      }
      await access(wrapper, constants.X_OK)
      const target = join(paths.prefix(entry.dependency), 'bin', entry.executable)
      await requireManagedPath(paths.runtimeRoot, target)
      await access(target, constants.X_OK)
    }
    return { healthy: true }
  } catch (error) {
    return { healthy: false, reason: error instanceof Error ? error.message : String(error) }
  }
}

const requireCommand = async (binary: string, args: string[], options: ManagedRenderingOptions): Promise<string> => {
  await requireManagedPath(renderingPaths(options).runtimeRoot, binary)
  const result = await exec(binary, args, {
    env: managedRenderingEnvironment(options),
    signal: AbortSignal.timeout(30_000),
    maxBufferBytes: 16 * 1024
  })
  if (result.exitCode !== 0) {
    throw InfraError(`Managed rendering check failed: ${result.stderr.trim() || result.stdout.trim() || relative(renderingPaths(options).runtimeRoot, binary)}`, { stage: 'setup:rendering' })
  }
  return result.stdout
}

export const verifyManagedRenderingCapabilities = async (options: ManagedRenderingOptions = {}): Promise<void> => {
  const paths = renderingPaths(options)
  await ensureContainedDirectory(paths.runtimeRoot, paths.temporaryDirectory)
  await requireCommand(paths.binary('fc-cache'), [paths.fontsDirectory], options)
  const match = await requireCommand(paths.binary('fc-match'), ['-f', '%{family}\n%{file}\n', 'DejaVu Sans'], options)
  const [family, fontPath] = match.trim().split('\n')
  if (!family?.includes('DejaVu Sans') || !fontPath) {
    throw InfraError('Managed fonts did not resolve DejaVu Sans.', { stage: 'setup:rendering' })
  }
  await requireManagedPath(paths.fontsDirectory, fontPath)

  const workspace = await mkdtemp(join(paths.temporaryDirectory, 'managed-render-check-'))
  try {
    const original = join(workspace, 'original.png')
    const tiff = join(workspace, 'converted.tiff')
    const restored = join(workspace, 'restored.png')
    const recovered = join(workspace, 'independently-decoded.png')
    const overlay = join(workspace, 'wrapped-text.png')
    await requireCommand(paths.binary('magick'), ['-size', '24x16', 'xc:red', original], options)
    await requireCommand(paths.binary('magick'), [original, tiff], options)
    await requireCommand(paths.binary('magick'), [tiff, restored], options)
    const decodedImage = new Bun.Image(await Bun.file(restored).arrayBuffer())
    const imageMetadata = await decodedImage.metadata()
    if (imageMetadata.width !== 24 || imageMetadata.height !== 16) {
      throw InfraError('Managed TIFF roundtrip changed image dimensions.', { stage: 'setup:rendering' })
    }
    await Bun.write(recovered, await decodedImage.png().bytes())
    const recoveredColor = (await requireCommand(paths.binary('magick'), [recovered, '-format', '%[fx:mean.r],%[fx:mean.g],%[fx:mean.b]', 'info:'], options)).trim().split(',').map(Number)
    if (recoveredColor.length !== 3 || recoveredColor.some((value, index) => !Number.isFinite(value) || Math.abs(value - (index === 0 ? 1 : 0)) > 0.001)) {
      throw InfraError('Managed TIFF roundtrip changed decoded pixel colors.', { stage: 'setup:rendering' })
    }
    await requireCommand(paths.binary('pango-view'), [
      '--no-display', '--markup', '--text', 'Managed text wraps over multiple lines with &lt;escaped&gt; text &amp; symbols',
      '--background', 'transparent', '--margin', '0', '--align', 'center',
      '--width', '160', '--wrap', 'word-char', '--font', 'DejaVu Sans 20', '--output', overlay
    ], options)
    const textMetadata = await new Bun.Image(await Bun.file(overlay).arrayBuffer()).metadata()
    const alpha = Number((await requireCommand(paths.binary('magick'), [overlay, '-alpha', 'extract', '-format', '%[fx:mean]', 'info:'], options)).trim())
    if (textMetadata.height <= 30 || !Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) {
      throw InfraError('Managed Pango did not render visible wrapped text over transparent pixels.', { stage: 'setup:rendering' })
    }
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
}
