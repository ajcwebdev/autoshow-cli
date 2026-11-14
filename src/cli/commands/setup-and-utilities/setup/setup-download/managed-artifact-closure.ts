import { lstat, realpath } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { runCapture } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { RUNTIME_DIR, toProjectDisplayPath } from '~/utils/runtime-paths'
import { InfraError } from '~/utils/error-handler'
import { isContainedManagedPath } from './managed-artifact-payload'
import { isIgnoredManagedArtifactPath } from './managed-artifact-schema'
import { readDependencyUrlAndSha256 } from '~/cli/commands/setup-and-utilities/setup/dependency-metadata'
import type { ManagedDynamicLibraryClosureResult } from '~/types'

export const MANAGED_SIGNED_CALIBRE_INERT_RPATHS = [
  '/Users/Shared/calibre-build/sw/sw/lib',
  '/Users/Shared/calibre-build/sw/sw/qt/lib',
  '/var/folders/sd/y6xpg5bs2cz_rbq1j8x5zyr80000gn/C/t/espeak-nem_srhn/lib',
  '/var/folders/sd/y6xpg5bs2cz_rbq1j8x5zyr80000gn/C/t/libjpeg.arm64.-lq0b4umq/lib',
  '/var/folders/sd/y6xpg5bs2cz_rbq1j8x5zyr80000gn/C/t/libjpeg.x86_64.-btypjhh3/lib',
  '/var/folders/sd/y6xpg5bs2cz_rbq1j8x5zyr80000gn/C/t/sqlite-yh50djbm/lib'
] as const

export const MANAGED_SIGNED_CALIBRE_UNAVAILABLE_COMPONENTS = [
  { image: 'Contents/Frameworks/plugins/PyQt6.QtPdf.so', missingDependencies: ['@executable_path/../Frameworks/QtPdf.framework/Versions/A/QtPdf'] },
  { image: 'Contents/Frameworks/plugins/PyQt6.QtPdfWidgets.so', missingDependencies: ['@executable_path/../Frameworks/QtPdf.framework/Versions/A/QtPdf', '@executable_path/../Frameworks/QtPdfWidgets.framework/Versions/A/QtPdfWidgets'] },
  { image: 'Contents/Frameworks/plugins/PyQt6.QtSvgWidgets.so', missingDependencies: ['@executable_path/../Frameworks/QtSvgWidgets.framework/Versions/A/QtSvgWidgets'] },
  { image: 'Contents/Frameworks/plugins/PyQt6.QtTest.so', missingDependencies: ['@executable_path/../Frameworks/QtTest.framework/Versions/A/QtTest'] },
  { image: 'Contents/PlugIns/imageformats/libqpdf.dylib', missingDependencies: ['@executable_path/../Frameworks/QtPdf.framework/Versions/A/QtPdf'] }
] as const

export const MANAGED_SIGNED_CALIBRE_ABSENT_FRAMEWORKS = ['Contents/Frameworks/QtPdf.framework', 'Contents/Frameworks/QtPdfWidgets.framework', 'Contents/Frameworks/QtSvgWidgets.framework', 'Contents/Frameworks/QtTest.framework'] as const

export const canonicalManagedCalibreInertRunpath = (path: string): string => {
  const declared = MANAGED_SIGNED_CALIBRE_INERT_RPATHS.find(candidate => candidate === path || (candidate.startsWith('/var/') && `/private${candidate}` === path))
  if (!declared) failClosure('The signed Calibre runpath policy does not admit this search path.')
  return declared.startsWith('/var/') ? `/private${declared}` : declared
}

type ExternalPathKind = 'missing' | 'directory' | 'file' | 'symlink'
type SignedCalibreClosureContext = {
  packageRoot: string
  pinnedArchiveSha256: string
  verifySignature: () => Promise<void>
  additionalImages?: readonly string[]
  unavailableComponentPolicy?: 'calibre-cli-sandbox-v1'
  probeExternalPath?: (path: string) => Promise<ExternalPathKind>
  resolveSystemAlias?: (path: string) => Promise<string>
}

const externalPathKind = async (path: string): Promise<ExternalPathKind> => {
  try {
    const info = await lstat(path)
    return info.isSymbolicLink() ? 'symlink' : info.isDirectory() ? 'directory' : 'file'
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) return 'missing'
    throw error
  }
}

export const assertManagedCalibreInertRunpaths = async (
  paths: readonly string[],
  probe: (path: string) => Promise<ExternalPathKind> = externalPathKind,
  resolveSystemAlias: (path: string) => Promise<string> = realpath
): Promise<void> => {
  for (const path of paths) {
    const canonical = canonicalManagedCalibreInertRunpath(path)
    if (canonical.startsWith('/private/var/') && await resolveSystemAlias('/var') !== '/private/var') failClosure('Signed Calibre requires the standard protected /var system alias before application dispatch.')
    const parts = canonical.split('/').filter(Boolean)
    for (let index = 1; index <= parts.length; index++) {
      const ancestor = `/${parts.slice(0, index).join('/')}`
      const kind = await probe(ancestor)
      if (kind === 'symlink' || (index === parts.length && kind !== 'missing')) failClosure('The signed Calibre producer search path is no longer inert; application dispatch is blocked.')
    }
  }
}

const systemLibrary = (path: string): boolean => path.startsWith('/usr/lib/') || path.startsWith('/System/Library/')
function failClosure(message: string): never { throw InfraError(message, { stage: 'setup:managed-artifact', retryable: false }) }

export const parseManagedMachOLibraries = (output: string): string[] => output.split('\n')
  .map(line => line.trim().match(/^(.+?)\s+\(compatibility version/)?.[1])
  .filter((path): path is string => path !== undefined && !isIgnoredManagedArtifactPath(path))

export const parseManagedMachORpaths = (output: string): string[] => {
  const paths: string[] = []
  let rpathCommand = false
  for (const line of output.split('\n')) {
    if (/^\s*cmd\s+/.test(line)) rpathCommand = /^\s*cmd\s+LC_RPATH\s*$/.test(line)
    if (rpathCommand) {
      const path = line.match(/^\s*path\s+(.+?)\s+\(offset\s+\d+\)\s*$/)?.[1]
      if (path) { paths.push(path); rpathCommand = false }
    }
  }
  return paths
}

export const parseManagedMachODylibIdentity = (output: string): string | undefined => {
  let identityCommand = false
  for (const line of output.split('\n')) {
    if (/^\s*cmd\s+/.test(line)) identityCommand = /^\s*cmd\s+LC_ID_DYLIB\s*$/.test(line)
    if (identityCommand) {
      const name = line.match(/^\s*name\s+(.+?)\s+\(offset\s+\d+\)\s*$/)?.[1]
      if (name) return name
    }
  }
  return undefined
}

const inspectMachO = async (path: string, kind: 'libraries' | 'load-commands'): Promise<string> => {
  const result = await runCapture('/usr/bin/otool', [kind === 'libraries' ? '-L' : '-l', path], { allowFailure: true })
  if (result.exitCode !== 0) failClosure(`Could not inspect managed native payload ${toProjectDisplayPath(path)}: ${result.stderr.trim() || result.stdout.trim()}`)
  return result.stdout
}

export const assertManagedDynamicLibraryClosure = async (
  binaryPaths: readonly string[],
  options: { runtimeRoot?: string, inspect?: typeof inspectMachO, maxFiles?: number, signedCalibre?: SignedCalibreClosureContext } = {}
): Promise<ManagedDynamicLibraryClosureResult> => {
  const root = await realpath(options.runtimeRoot ?? RUNTIME_DIR)
  const inspect = options.inspect ?? inspectMachO
  const maxFiles = options.maxFiles ?? 4096
  const visited = new Set<string>()
  const imageRunpaths = new Map<string, readonly string[]>()
  const inertRunpaths = new Set<string>()
  const unavailableComponents = new Map<string, Set<string>>()
  const absentFrameworks = new Set<string>()
  let signedPackageRoot: string | undefined
  if (options.signedCalibre) {
    signedPackageRoot = await realpath(options.signedCalibre.packageRoot)
    if (!isContainedManagedPath(root, signedPackageRoot)) failClosure('Signed Calibre packages must remain inside runtime.')
    const expected = await readDependencyUrlAndSha256('calibre')
    if (options.signedCalibre.pinnedArchiveSha256 !== expected.sha256) failClosure('Signed Calibre runpath policy requires the pinned upstream archive identity.')
    await options.signedCalibre.verifySignature()
  }
  const assertFrameworkAbsent = async (framework: string): Promise<void> => {
    if (!signedPackageRoot) failClosure('Unavailable signed components require a verified package root.')
    const path = join(signedPackageRoot, framework)
    const parent = await realpath(dirname(path))
    if (!isContainedManagedPath(signedPackageRoot, parent)) failClosure('Unavailable component framework paths must remain inside their verified signed package.')
    try { await lstat(path) } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
    failClosure('A signed Calibre unavailable-component framework is present or linked; application dispatch is blocked.')
  }
  const expandPath = (path: string, loader: string, executable: string): string | undefined => {
    if (path === '@loader_path') return dirname(loader)
    if (path.startsWith('@loader_path/')) return resolve(dirname(loader), path.slice('@loader_path/'.length))
    if (path === '@executable_path') return dirname(executable)
    if (path.startsWith('@executable_path/')) return resolve(dirname(executable), path.slice('@executable_path/'.length))
    return isAbsolute(path) ? resolve(path) : undefined
  }
  const visit = async (path: string, executable: string, inheritedRpaths: readonly string[]): Promise<readonly string[]> => {
    if (isIgnoredManagedArtifactPath(path)) return inheritedRpaths
    const canonical = await realpath(path)
    if (!isContainedManagedPath(root, canonical)) failClosure(`Managed native dependency escapes runtime: ${toProjectDisplayPath(canonical)}`)
    if (signedPackageRoot && !isContainedManagedPath(signedPackageRoot, canonical)) failClosure('Signed Calibre runpath policy cannot admit a dependency outside its verified package.')
    // An image can be reached through distinct executable/runpath contexts.
    const identity = `${canonical}\0${executable}\0${inheritedRpaths.join('\0')}`
    if (visited.has(identity)) return imageRunpaths.get(identity) ?? inheritedRpaths
    if (visited.size >= maxFiles) failClosure(`Managed native dependency closure exceeds ${maxFiles} inspected images`)
    visited.add(identity)
    const loadCommands = await inspect(canonical, 'load-commands')
    const dylibIdentity = parseManagedMachODylibIdentity(loadCommands)
    const libraries = parseManagedMachOLibraries(await inspect(canonical, 'libraries')).filter(library => library !== dylibIdentity)
    const declaredRpaths = parseManagedMachORpaths(loadCommands)
    const localRpaths: string[] = []
    for (const path of declaredRpaths) {
      const expanded = expandPath(path, canonical, executable)
      if (!expanded || (!systemLibrary(`${expanded}/`) && !isContainedManagedPath(root, expanded))) {
        if (options.signedCalibre && expanded === path && (MANAGED_SIGNED_CALIBRE_INERT_RPATHS as readonly string[]).includes(path)) {
          await assertManagedCalibreInertRunpaths([path], options.signedCalibre.probeExternalPath, options.signedCalibre.resolveSystemAlias)
          inertRunpaths.add(canonicalManagedCalibreInertRunpath(path))
          continue
        }
        failClosure(`Managed image has an external or unresolved runpath: ${path}`)
      }
      localRpaths.push(expanded)
    }
    const rpaths = [...new Set([...localRpaths, ...inheritedRpaths])]
    imageRunpaths.set(identity, rpaths)
    for (const library of libraries) {
      if (systemLibrary(library)) continue
      let candidates: string[]
      if (library.startsWith('@rpath/')) candidates = rpaths.map(path => join(path, library.slice('@rpath/'.length)))
      else {
        const expanded = expandPath(library, canonical, executable)
        if (!expanded) failClosure(`Managed image has an unresolved native dependency: ${library}`)
        candidates = [expanded]
      }
      let selected: string | undefined
      for (const candidate of candidates) {
        try { selected = await realpath(candidate); break } catch (error) {
          if (!['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error
        }
      }
      if (!selected) {
        if (signedPackageRoot && options.signedCalibre?.unavailableComponentPolicy === 'calibre-cli-sandbox-v1') {
          const image = relative(signedPackageRoot, canonical).replaceAll('\\', '/')
          const component = MANAGED_SIGNED_CALIBRE_UNAVAILABLE_COMPONENTS.find(entry => entry.image === image)
          if (component && (component.missingDependencies as readonly string[]).includes(library)) {
            const framework = MANAGED_SIGNED_CALIBRE_ABSENT_FRAMEWORKS.find(path => {
              const name = basename(path, '.framework')
              return library === `@executable_path/../Frameworks/${name}.framework/Versions/A/${name}`
            })
            if (!framework) failClosure('Unavailable signed component dependency does not match its reviewed framework identity.')
            const expectedTarget = join(signedPackageRoot, framework, 'Versions/A', basename(framework, '.framework'))
            if (candidates.length !== 1 || resolve(candidates[0]!) !== expectedTarget) failClosure('Unavailable signed component dependency has an unexpected executable loader context.')
            await assertFrameworkAbsent(framework)
            const dependencies = unavailableComponents.get(image) ?? new Set<string>()
            dependencies.add(library)
            unavailableComponents.set(image, dependencies)
            absentFrameworks.add(framework)
            continue
          }
        }
        failClosure(`Managed native dependency could not be resolved: ${library}`)
      }
      if (systemLibrary(selected)) continue
      if (!isContainedManagedPath(root, selected)) failClosure(`Managed native dependency escapes runtime: ${library}`)
      await visit(selected, executable, rpaths)
    }
    return rpaths
  }
  const rootContexts: Array<{ executable: string, runpaths: readonly string[] }> = []
  for (const path of binaryPaths) {
    if (isIgnoredManagedArtifactPath(path)) continue
    const executable = await realpath(path)
    rootContexts.push({ executable, runpaths: await visit(executable, executable, []) })
  }
  if (options.signedCalibre?.additionalImages?.length) {
    if (rootContexts.length !== 1) failClosure('Signed Calibre plugin validation requires exactly one verified executable loader context.')
    const context = rootContexts[0]!
    for (const image of options.signedCalibre.additionalImages) {
      if (isIgnoredManagedArtifactPath(image)) continue
      await visit(image, context.executable, context.runpaths)
    }
  }
  if (options.signedCalibre) await assertManagedCalibreInertRunpaths([...inertRunpaths], options.signedCalibre.probeExternalPath, options.signedCalibre.resolveSystemAlias)
  const unavailable = [...unavailableComponents].map(([image, dependencies]) => ({ image, missingDependencies: [...dependencies].sort() })).sort((left, right) => left.image.localeCompare(right.image))
  if (options.signedCalibre?.unavailableComponentPolicy === 'calibre-cli-sandbox-v1') {
    const expected = MANAGED_SIGNED_CALIBRE_UNAVAILABLE_COMPONENTS.map(entry => ({ image: entry.image, missingDependencies: [...entry.missingDependencies].sort() })).sort((left, right) => left.image.localeCompare(right.image))
    if (JSON.stringify(unavailable) !== JSON.stringify(expected)) failClosure('The signed Calibre unavailable-component inventory does not match the reviewed CLI sandbox policy.')
    for (const framework of absentFrameworks) await assertFrameworkAbsent(framework)
  }
  return { inertRunpaths: [...inertRunpaths].sort(), unavailableComponents: unavailable, absentFrameworks: [...absentFrameworks].sort() }
}
