import { chmod, copyFile, lstat, mkdir, readlink, readdir, realpath, rm, symlink } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { InfraError } from '~/utils/error-handler'
import { pathExists } from '~/utils/filesystem'
import { pathIsPhysicallyWithinRoot, resolveRuntimePhysicalPath } from '~/utils/runtime-containment'

const assertPayloadWritePath = (root: string, path: string): string => {
  if (!pathIsPhysicallyWithinRoot(root, path)) throw InfraError('Managed Linux writes must stay inside the selected runtime payload', { stage: 'setup:linux-package' })
  return path
}

const ensurePayloadDirectory = async (root: string, path: string): Promise<void> => {
  assertPayloadWritePath(root, path)
  await mkdir(path, { recursive: true })
  assertPayloadWritePath(root, path)
}

export const LINUX_MANAGED_TOOL_TARGETS: Readonly<Record<string, readonly string[]>> = {
  ffmpeg: ['usr/bin/ffmpeg'], ffprobe: ['usr/bin/ffprobe'], mutool: ['usr/bin/mutool'], qpdf: ['usr/bin/qpdf'],
  'ebook-convert': ['usr/bin/ebook-convert'], tesseract: ['usr/bin/tesseract'],
  'calibre-parallel': ['usr/bin/calibre-parallel'], 'calibre-debug': ['usr/bin/calibre-debug'],
  'ebook-meta': ['usr/bin/ebook-meta'],
  convert: ['usr/bin/convert-im6.q16', 'usr/bin/convert-im7.q16', 'usr/bin/convert'],
  identify: ['usr/bin/identify-im6.q16', 'usr/bin/identify-im7.q16', 'usr/bin/identify'],
  magick: ['usr/bin/magick', 'usr/bin/magick-im7.q16'], 'pango-view': ['usr/bin/pango-view'],
  'fc-match': ['usr/bin/fc-match'], 'fc-cache': ['usr/bin/fc-cache'],
  python3: ['usr/bin/python3'],
  // Supported document/image delegates are explicit; distro maintainer scripts are not application tools.
  pdftohtml: ['usr/bin/pdftohtml'], pdftoppm: ['usr/bin/pdftoppm'], pdftocairo: ['usr/bin/pdftocairo'],
  pdfinfo: ['usr/bin/pdfinfo'], pdfimages: ['usr/bin/pdfimages'],
  pdfseparate: ['usr/bin/pdfseparate'], pdfunite: ['usr/bin/pdfunite'], gs: ['usr/bin/gs'],
  cwebp: ['usr/bin/cwebp'], dwebp: ['usr/bin/dwebp'], 'rsvg-convert': ['usr/bin/rsvg-convert'],
}

export const linuxPayloadPath = (root: string, path: string): string => {
  const resolvedRoot = resolve(root)
  const target = resolve(resolvedRoot, path.replace(/^\/+/, ''))
  const rel = relative(resolvedRoot, target)
  if (rel.startsWith('..') || isAbsolute(rel)) throw InfraError(`Linux package path escapes its managed root: ${path}`, { stage: 'setup:linux-package' })
  return target
}

export const copyInstalledLinuxPackagePaths = async (sourceRoot: string, destination: string, paths: readonly string[]): Promise<void> => {
  const completed = new Set<string>()
  const sourcePrefix = resolve(sourceRoot)
  const copy = async (path: string): Promise<void> => {
    const source = linuxPayloadPath(sourcePrefix, path)
    const rel = relative(sourcePrefix, source)
    if (!rel || completed.has(rel) || basename(rel) === '.DS_Store') return
    if (/^(?:dev|proc|sys|run)(?:\/|$)/.test(rel)) return
    completed.add(rel)
    let info
    try { info = await lstat(source) } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
    const target = linuxPayloadPath(destination, rel)
    if (info.isDirectory()) {
      await ensurePayloadDirectory(destination, target)
      return
    }
    await ensurePayloadDirectory(destination, dirname(target))
    assertPayloadWritePath(destination, target)
    if (info.isSymbolicLink()) {
      const link = await readlink(source)
      const sourceTarget = isAbsolute(link) ? linuxPayloadPath(sourcePrefix, link) : resolve(dirname(source), link)
      const targetRel = relative(sourcePrefix, sourceTarget)
      if (targetRel.startsWith('..') || isAbsolute(targetRel)) throw InfraError(`Package symlink escapes the source tree: ${rel}`, { stage: 'setup:linux-package' })
      const translated = relative(dirname(target), linuxPayloadPath(destination, targetRel)) || '.'
      try { await symlink(translated, target) } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      }
      await copy(targetRel)
      return
    }
    if (!info.isFile()) return
    await copyFile(source, assertPayloadWritePath(destination, target))
    await chmod(target, info.mode & 0o777)
  }
  for (const path of paths) await copy(path)
}

export type LinuxPayloadEntry = { path: string; mode: number; kind: 'file'; sha256: string } | { path: string; mode: number; kind: 'symlink'; target: string; targetExists: boolean }

const sha256 = async (path: string): Promise<string> => {
  const hasher = new Bun.CryptoHasher('sha256')
  for await (const chunk of Bun.file(path).stream()) hasher.update(chunk)
  return hasher.digest('hex')
}

export const collectLinuxPayload = async (root: string): Promise<LinuxPayloadEntry[]> => {
  const entries: LinuxPayloadEntry[] = []
  const visit = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name === '.DS_Store') continue
      const path = join(dir, entry.name)
      const rel = relative(root, path).replace(/\\/g, '/')
      const info = await lstat(path)
      if (info.isSymbolicLink()) {
        const target = await readlink(path)
        if (isAbsolute(target)) throw InfraError(`Managed Linux payload contains an absolute symlink: ${rel}`, { stage: 'setup:linux-package' })
        const resolved = resolve(dirname(path), target)
        const outside = relative(root, resolved)
        if (outside.startsWith('..') || isAbsolute(outside)) throw InfraError(`Managed Linux payload link escapes runtime: ${rel}`, { stage: 'setup:linux-package' })
        entries.push({ path: rel, mode: info.mode & 0o777, kind: 'symlink', target, targetExists: await pathExists(path) })
      } else if (info.isDirectory()) await visit(path)
      else if (info.isFile()) entries.push({ path: rel, mode: info.mode & 0o777, kind: 'file', sha256: await sha256(path) })
    }
  }
  await visit(root)
  return entries.sort((a, b) => a.path.localeCompare(b.path))
}

export const validateLinuxPayload = async (root: string, entries: readonly LinuxPayloadEntry[]): Promise<void> => {
  const physicalRoot = await realpath(root)
  for (const entry of entries) {
    const path = linuxPayloadPath(root, entry.path)
    const info = await lstat(path)
    if ((info.mode & 0o777) !== entry.mode) throw InfraError(`Managed Linux file mode changed: ${entry.path}`, { stage: 'setup:linux-package' })
    if (entry.kind === 'file') {
      if (!info.isFile() || await sha256(path) !== entry.sha256) throw InfraError(`Managed Linux payload integrity failed: ${entry.path}`, { stage: 'setup:linux-package' })
    } else {
      if (!info.isSymbolicLink() || await readlink(path) !== entry.target) throw InfraError(`Managed Linux symlink changed: ${entry.path}`, { stage: 'setup:linux-package' })
      const exists = await pathExists(path)
      if (exists !== entry.targetExists) throw InfraError(`Managed Linux symlink target relationship changed: ${entry.path}`, { stage: 'setup:linux-package' })
      const resolved = exists ? await realpath(path) : resolveRuntimePhysicalPath(resolve(dirname(path), entry.target))
      const rel = relative(physicalRoot, resolved)
      if (rel.startsWith('..') || isAbsolute(rel)) throw InfraError(`Managed Linux symlink escapes runtime: ${entry.path}`, { stage: 'setup:linux-package' })
    }
  }
}

export const findLinuxToolTarget = async (root: string, tool: string): Promise<string | undefined> => {
  for (const path of LINUX_MANAGED_TOOL_TARGETS[tool] ?? []) if (await pathExists(join(root, path))) return path
  return undefined
}

export const buildLinuxToolWrapper = (options: {
  target: string
  libraryDirectories: readonly string[]
  loader?: string | undefined
  interpreter?: string | undefined
  magickCoderDirectory?: string | undefined
  qtPluginDirectory?: string | undefined
  calibreExtensionsDirectory?: string | undefined
}): string => {
  const paths = options.libraryDirectories.map(path => `$linux_root/${path}`).join(':')
  const command = options.interpreter ? `$linux_root/${options.interpreter}` : `$linux_root/${options.target}`
  const scriptArg = options.interpreter ? ` "$linux_root/${options.target}"` : ''
  return `#!/bin/sh
runtime_dir=$(CDPATH= cd "$(dirname "$0")/.." && pwd) || exit 1
linux_root="$runtime_dir/tools/linux-root"
export PATH="$runtime_dir/bin:/usr/bin:/bin"
export LD_LIBRARY_PATH="${paths}"
export FONTCONFIG_FILE="$runtime_dir/fonts/fonts.conf"
export FONTCONFIG_PATH="$runtime_dir/fonts"
export XDG_CACHE_HOME="$runtime_dir/cache"
export XDG_CONFIG_HOME="$runtime_dir/state/config"
export XDG_DATA_HOME="$runtime_dir/state/data"
export XDG_STATE_HOME="$runtime_dir/state"
export TMPDIR="$runtime_dir/tmp"
export MAGICK_TEMPORARY_PATH="$runtime_dir/tmp"
export MAGICK_HOME="$linux_root/usr"
export MAGICK_CONFIGURE_PATH="$linux_root/etc/ImageMagick-6:$linux_root/etc/ImageMagick-7:$linux_root/usr/share/ImageMagick-6:$linux_root/usr/share/ImageMagick-7"
${options.magickCoderDirectory ? `export MAGICK_CODER_MODULE_PATH="$linux_root/${options.magickCoderDirectory}"\n` : ''}export PYTHONHOME="$linux_root/usr"
export PYTHONPATH="$linux_root/usr/lib/python3/dist-packages:$linux_root/usr/lib/calibre"
export PYTHONPYCACHEPREFIX="$runtime_dir/cache/python"
export PYTHONNOUSERSITE=1
export PYTHONDONTWRITEBYTECODE=1
export CALIBRE_RESOURCES_PATH="$linux_root/usr/share/calibre"
export CALIBRE_EXTENSIONS_PATH="$linux_root/${options.calibreExtensionsDirectory ?? 'usr/lib/calibre'}"
export CALIBRE_CONFIG_DIRECTORY="$runtime_dir/state/calibre"
export QT_QPA_PLATFORM=offscreen
${options.qtPluginDirectory ? `export QT_PLUGIN_PATH="$linux_root/${options.qtPluginDirectory}"\n` : ''}if test '${options.target.endsWith('/tesseract') ? '1' : '0'}' = '1'; then
tessdata_explicit=1
if test -z "\${TESSDATA_PREFIX:-}"; then
  tessdata_explicit=0
  for tessdata_dir in "$linux_root"/usr/share/tesseract-ocr/*/tessdata; do
    if test -d "$tessdata_dir"; then export TESSDATA_PREFIX="$tessdata_dir"; break; fi
  done
fi
if test -n "\${TESSDATA_PREFIX:-}"; then
  if test "$tessdata_explicit" = 1; then
    tessdata_boundary=$(CDPATH= cd "$runtime_dir" && pwd -P) || exit 1
  else
    tessdata_boundary=$(CDPATH= cd "$linux_root" && pwd -P) || exit 1
  fi
  tessdata_physical=$(CDPATH= cd "$TESSDATA_PREFIX" && pwd -P) || { printf '%s\\n' 'Selected Tesseract data directory is unavailable' >&2; exit 1; }
  case "$tessdata_physical" in
    "$tessdata_boundary"|"$tessdata_boundary"/*) export TESSDATA_PREFIX ;;
    *) printf '%s\\n' 'Explicit Tesseract data must resolve inside runtime' >&2; exit 2 ;;
  esac
else
  printf '%s\\n' 'Managed Tesseract data is unavailable; run bun autoshow setup --step ocr' >&2; exit 1
fi
fi
${options.loader ? `exec "$linux_root/${options.loader}" --library-path "$LD_LIBRARY_PATH" "${command}"${scriptArg} "$@"` : `exec "${command}"${scriptArg} "$@"`}
`
}

export const LINUX_FONTCONFIG_CONFIGURATION = '<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig><dir prefix="relative">../tools/linux-root/usr/share/fonts</dir><cachedir prefix="xdg">fontconfig</cachedir></fontconfig>\n'

export const planLinuxToolWrappers = async (runtimeRoot: string, payloadRoot = join(runtimeRoot, 'tools/linux-root'), existingInventory?: readonly LinuxPayloadEntry[]): Promise<Array<{ tool: string; script: string }>> => {
  const inventory = existingInventory ?? await collectLinuxPayload(payloadRoot)
  const libraryDirectories = [...new Set(inventory.flatMap(entry => entry.kind === 'file' && /\.so(?:\.|$)/.test(basename(entry.path)) ? [dirname(entry.path)] : []))].sort()
  const loader = inventory.find(entry => entry.kind === 'file' && /(?:^|\/)ld-(?:linux[^/]*|[\d.]+)\.so(?:\.[\d.]+)?$/.test(entry.path))?.path
  const magickCoderDirectory = inventory.find(entry => /ImageMagick-[^/]+\/modules-[^/]+\/coders\/[^/]+\.so$/.test(entry.path))?.path
  const qtPluginDirectory = inventory.find(entry => /qt[56]\/plugins\/platforms\/[^/]+\.so$/.test(entry.path))?.path
  const calibreExtensionsDirectory = inventory.find(entry => /(?:^|\/)calibre\/.*\/(?:icu|speedup)(?:\.[^/]*)?\.so$/.test(entry.path))?.path
  const wrappers: Array<{ tool: string; script: string }> = []
  const targets = new Map<string, string>()
  for (const tool of Object.keys(LINUX_MANAGED_TOOL_TARGETS)) {
    const target = await findLinuxToolTarget(payloadRoot, tool)
    if (target) targets.set(tool, target)
  }
  for (const [tool, target] of targets) {
    const header = new TextDecoder().decode(await Bun.file(join(payloadRoot, target)).slice(0, 200).bytes())
    const scriptInterpreter = header.match(/^#!\s*\/[^\n]*?\b(python3?(?:\.\d+)?|perl)(?:\s|$)/)?.[1]
    const interpreter = scriptInterpreter ? targets.get(scriptInterpreter) ?? (scriptInterpreter.startsWith('python') ? targets.get('python3') : undefined) : undefined
    if (scriptInterpreter && !interpreter) throw InfraError(`Managed ${tool} requires its packaged ${scriptInterpreter} interpreter`, { stage: 'setup:linux-package' })
    const isScript = header.startsWith('#!')
    const wrapper = buildLinuxToolWrapper({
      target, libraryDirectories,
      loader: !isScript || interpreter ? loader : undefined,
      interpreter,
      magickCoderDirectory: magickCoderDirectory ? dirname(magickCoderDirectory) : undefined,
      qtPluginDirectory: qtPluginDirectory ? dirname(dirname(qtPluginDirectory)) : undefined,
      calibreExtensionsDirectory: calibreExtensionsDirectory ? dirname(calibreExtensionsDirectory) : undefined
    })
    wrappers.push({ tool, script: wrapper })
  }
  return wrappers
}

export const installLinuxToolWrappers = async (runtimeRoot: string, payloadRoot = join(runtimeRoot, 'tools/linux-root'), existingInventory?: readonly LinuxPayloadEntry[]): Promise<void> => {
  const wrappers = await planLinuxToolWrappers(runtimeRoot, payloadRoot, existingInventory)
  await ensurePayloadDirectory(runtimeRoot, join(runtimeRoot, 'bin'))
  await ensurePayloadDirectory(runtimeRoot, join(runtimeRoot, 'fonts'))
  await ensurePayloadDirectory(runtimeRoot, join(runtimeRoot, 'cache/fontconfig'))
  await ensurePayloadDirectory(runtimeRoot, join(runtimeRoot, 'tmp'))
  await Bun.write(assertPayloadWritePath(runtimeRoot, join(runtimeRoot, 'fonts/fonts.conf')), LINUX_FONTCONFIG_CONFIGURATION)
  for (const { tool, script } of wrappers) {
    const wrapperPath = join(runtimeRoot, 'bin', tool)
    await Bun.write(assertPayloadWritePath(runtimeRoot, wrapperPath), script)
    await chmod(wrapperPath, 0o755)
  }
}

export const linuxPackagePathList = (text: string): string[] =>
  text.split('\n').map(line => line.trim()).filter(line => line.startsWith('/') && !line.endsWith('/.DS_Store'))

export const normalizeExtractedLinuxSymlinks = async (root: string): Promise<void> => {
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === '.DS_Store') continue
      const path = join(directory, entry.name)
      if (entry.isSymbolicLink()) {
        assertPayloadWritePath(root, dirname(path))
        const link = await readlink(path)
        const target = isAbsolute(link) ? linuxPayloadPath(root, link) : resolve(dirname(path), link)
        const rel = relative(root, target)
        if (rel.startsWith('..') || isAbsolute(rel)) throw InfraError(`Extracted package link escapes runtime: ${relative(root, path)}`, { stage: 'setup:linux-package' })
        if (isAbsolute(link)) {
          await rm(path)
          await symlink(relative(dirname(path), target) || '.', path)
        }
      } else if (entry.isDirectory()) await visit(path)
    }
  }
  await visit(root)
}
