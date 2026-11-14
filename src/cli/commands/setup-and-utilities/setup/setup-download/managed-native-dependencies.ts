import { cp, lstat, readlink, readdir, rename, rm } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { childEnv } from '~/utils/child-env'
import { readBoundedTextStream } from '~/utils/bounded-capture'
import { InfraError } from '~/utils/error-handler'
import { pathExists } from '~/utils/filesystem'
import { logicalCpuCount } from '~/utils/logical-cpu-count'
import { withProcessLock } from '~/utils/process-lock'
import { RUNTIME_BIN_DIR, RUNTIME_BUILD_DIR, RUNTIME_DIR, RUNTIME_TOOLS_DIR } from '~/utils/runtime-paths'
import { assertManagedRuntimePath } from '~/utils/runtime-containment'
import { ensureRuntimeDirectory, RUNTIME_CACHE_DIR, RUNTIME_STATE_DIR } from '~/utils/runtime-state'
import type { ManagedSourceArtifactValidation } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { downloadFile } from './download'
import { extractTarGzFile } from './tar-gz'
import { createManagedToolStagingDirectory, promoteManagedToolDirectory, recoverManagedToolDirectory, validateManagedSourceArtifact, writeManagedSourceArtifactManifest } from './managed-artifact'
import { sha256File, resolveSourceDeploymentTarget } from './managed-source-artifact'
import { assertManagedDynamicLibraryClosure } from './managed-artifact-closure'
import { ensureManagedBuildTools, managedBuildEnvironment, managedBuildToolPath } from './managed-build-tools'
import { NATIVE_DEPENDENCY_RECIPES, NATIVE_RENDERING_DEPENDENCIES } from './managed-native-recipes'
import type { NativeDependencyName } from './managed-native-recipes'
import type { NativeDependencyRecipe } from './managed-native-recipes'
import { activateManagedRenderingTools, ensureManagedRenderingConfiguration, verifyManagedRenderingCapabilities } from './managed-native-rendering'

export { ensureManagedBuildTools } from './managed-build-tools'
export type { NativeDependencyName } from './managed-native-recipes'

export type ManagedNativeSetupOptions = { forceRedownload?: boolean }

// The generic recipe identity covers these common flags as well as each
// package's recorded overrides. Any policy change requires a revision bump.
const NATIVE_RECIPE_REVISION = 'r1'
const nativeRecipeRevision = (name: NativeDependencyName): string => name === 'libpng' || name === 'pcre2' || name === 'imagemagick' ? 'r2-portable-config' : NATIVE_RECIPE_REVISION
export const MANAGED_NATIVE_CMAKE_POLICY_FLAGS = [
  '-DCMAKE_BUILD_TYPE=Release', '-DBUILD_SHARED_LIBS=OFF',
  '-DCMAKE_FIND_ROOT_PATH_MODE_PACKAGE=ONLY', '-DCMAKE_FIND_ROOT_PATH_MODE_INCLUDE=ONLY',
  '-DCMAKE_FIND_ROOT_PATH_MODE_LIBRARY=ONLY', '-DCMAKE_FIND_ROOT_PATH_MODE_PROGRAM=NEVER',
  '-DCMAKE_FIND_USE_PACKAGE_REGISTRY=OFF', '-DCMAKE_FIND_USE_SYSTEM_PACKAGE_REGISTRY=OFF'
] as const
const NATIVE_BUILD_ROOT = join(RUNTIME_BUILD_DIR, 'native')
const NATIVE_SOURCE_CACHE = join(RUNTIME_CACHE_DIR, 'downloads/native')
const NATIVE_LOG_ROOT = join(RUNTIME_STATE_DIR, 'setup/native')
const NATIVE_MANIFEST = '.autoshow-managed-artifact.json'
const pending = new Map<NativeDependencyName, Promise<void>>()
const refreshed = new Set<NativeDependencyName>()
let buildToolsRefreshed = false

export const nativeDependencyPrefix = (name: NativeDependencyName): string => assertManagedRuntimePath(join(RUNTIME_TOOLS_DIR, 'native', name))

export const nativeDependencyNames = (): NativeDependencyName[] => Object.keys(NATIVE_DEPENDENCY_RECIPES) as NativeDependencyName[]

export const nativeDependencyOrder = (names: readonly NativeDependencyName[]): NativeDependencyName[] => {
  const result: NativeDependencyName[] = []
  const visited = new Set<NativeDependencyName>()
  const active = new Set<NativeDependencyName>()
  const visit = (name: NativeDependencyName): void => {
    if (active.has(name)) throw InfraError(`Native dependency cycle includes ${name}`, { stage: 'setup:native-dependencies' })
    if (visited.has(name)) return
    const recipe = NATIVE_DEPENDENCY_RECIPES[name]
    if (!recipe) throw InfraError(`Unknown managed native dependency ${name}`, { stage: 'setup:native-dependencies' })
    active.add(name)
    for (const dependency of recipe.dependencies) visit(dependency as NativeDependencyName)
    active.delete(name)
    visited.add(name)
    result.push(name)
  }
  for (const name of names) visit(name)
  return result
}

export const managedNativeBuildEnv = (names: readonly NativeDependencyName[] = nativeDependencyNames()): Record<string, string | undefined> => {
  const order = nativeDependencyOrder(names)
  const prefixes = order.map(nativeDependencyPrefix)
  const buildEnvironment = managedBuildEnvironment()
  const includeFlags = prefixes.map(prefix => `-I${join(prefix, 'include')}`).join(' ')
  const explicitLibraries = [...new Set(order.flatMap(name => (NATIVE_DEPENDENCY_RECIPES[name] as NativeDependencyRecipe).linkLibraries ?? []))]
  const libraryFlags = [...prefixes.map(prefix => `-L${join(prefix, 'lib')}`), ...explicitLibraries.map(name => `-l${name}`)].join(' ')
  return {
    ...buildEnvironment,
    PATH: [...prefixes.map(prefix => join(prefix, 'bin')), buildEnvironment['PATH']].filter(Boolean).join(':'),
    PKG_CONFIG: `${managedBuildToolPath('pkgconf')} --static`,
    PKG_CONFIG_PATH: undefined,
    PKG_CONFIG_LIBDIR: prefixes.flatMap(prefix => [join(prefix, 'lib/pkgconfig'), join(prefix, 'share/pkgconfig')]).join(':'),
    CMAKE_PREFIX_PATH: prefixes.join(':'),
    CPPFLAGS: includeFlags,
    CFLAGS: `${includeFlags} -O2`,
    CXXFLAGS: `${includeFlags} -O2`,
    LDFLAGS: libraryFlags,
    LIBRARY_PATH: prefixes.map(prefix => join(prefix, 'lib')).join(':'),
    CPATH: undefined,
    C_INCLUDE_PATH: undefined,
    CPLUS_INCLUDE_PATH: undefined,
    DYLD_LIBRARY_PATH: prefixes.map(prefix => join(prefix, 'lib')).join(':'),
    GI_TYPELIB_PATH: prefixes.map(prefix => join(prefix, 'lib/girepository-1.0')).join(':'),
    PYTHONPATH: undefined,
    PYTHONHOME: undefined,
  }
}

export const managedNativeRecipeBuildEnv = (name: NativeDependencyName): Record<string, string | undefined> => {
  const recipe = NATIVE_DEPENDENCY_RECIPES[name]
  const environment = managedNativeBuildEnv(recipe.dependencies as readonly NativeDependencyName[])
  const ownLibraries = ((recipe as NativeDependencyRecipe).linkLibraries ?? []).map(library => `-l${library}`)
  return { ...environment, LDFLAGS: [environment['LDFLAGS'], ...ownLibraries].filter(Boolean).join(' ') }
}

const runNativeBuildCommand = async (name: string, command: string, args: string[], options: { cwd?: string, env?: Record<string, string | undefined> } = {}): Promise<void> => {
  await ensureRuntimeDirectory(NATIVE_LOG_ROOT)
  const logPath = assertManagedRuntimePath(join(NATIVE_LOG_ROOT, `${name}.log`))
  if (options.cwd) assertManagedRuntimePath(options.cwd)
  if (!command.startsWith('/usr/bin/')) assertManagedRuntimePath(command)
  const proc = Bun.spawn([command, ...args], {
    ...(options.cwd ? { cwd: options.cwd } : {}),
    env: childEnv({ set: options.env }),
    stdin: 'ignore', stdout: 'pipe', stderr: 'pipe'
  })
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; proc.kill('SIGTERM') }, 30 * 60_000)
  const startedAt = Date.now()
  const progress = setInterval(() => {
    l.write('info', `Managed ${name}: ${basename(command)} running (${Math.round((Date.now() - startedAt) / 1000)}s)`, { category: 'command' })
  }, 30_000)
  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      readBoundedTextStream(proc.stdout), readBoundedTextStream(proc.stderr), proc.exited
    ])
    const text = [stdout.text, stderr.text].filter(Boolean).join('\n')
    const prior = await Bun.file(logPath).exists() ? await Bun.file(logPath).text() : ''
    await Bun.write(logPath, `${prior.slice(-1024 * 1024)}\n$ ${basename(command)} ${args.join(' ')}\n${text.slice(-1024 * 1024)}\nexit=${exitCode}\n`)
    if (exitCode !== 0 || timedOut) {
      throw InfraError(`${name} ${timedOut ? 'build timed out' : 'build failed'}: ${text.split('\n').slice(-25).join('\n')}`, {
        stage: 'setup:native-dependencies', metadata: { component: name, logPath: relative(RUNTIME_DIR, logPath) }
      })
    }
  } finally { clearTimeout(timer); clearInterval(progress) }
}

export const assertNativeArchivePaths = (listing: string): void => {
  for (const line of listing.split('\n')) {
    const path = line.trim()
    if (!path) continue
    if (isAbsolute(path) || /^[A-Za-z]:/.test(path) || path.includes('\\') || path.split('/').includes('..')) {
      throw InfraError(`Unsafe native source archive member: ${path}`, { stage: 'setup:native-archive' })
    }
  }
}

const captureSystemTar = async (args: string[]): Promise<string> => {
  const proc = Bun.spawn(['/usr/bin/tar', ...args], { env: childEnv(), stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([readBoundedTextStream(proc.stdout), readBoundedTextStream(proc.stderr), proc.exited])
  if (exitCode !== 0 || stdout.truncated || stderr.truncated) throw InfraError(`Could not inspect native source archive: ${stderr.text}`, { stage: 'setup:native-archive' })
  return stdout.text
}

export const extractManagedNativeSource = async (archive: string, destination: string): Promise<void> => {
  assertManagedRuntimePath(archive)
  assertManagedRuntimePath(destination)
  await ensureRuntimeDirectory(dirname(destination))
  if (/\.t(?:ar\.)?gz$/i.test(archive) || /\.tgz$/i.test(archive)) {
    await extractTarGzFile(archive, { destination, stripComponents: 1 })
    return
  }
  // libarchive converts compression without extracting files. The existing
  // admission parser then rejects unsafe entries, links, parents and metadata.
  assertNativeArchivePaths(await captureSystemTar(['-tf', archive, '--exclude', '.DS_Store', '--exclude', '*/.DS_Store']))
  const converted = `${archive}.admitted.tar.gz`
  assertManagedRuntimePath(converted)
  await runNativeBuildCommand('archive-conversion', '/usr/bin/tar', ['-czf', converted, '--exclude', '.DS_Store', '--exclude', '*/.DS_Store', `@${archive}`])
  try { await extractTarGzFile(converted, { destination, stripComponents: 1 }) }
  finally { await rm(converted, { force: true }) }
}

const sourceArchive = async (name: NativeDependencyName, force: boolean): Promise<string> => {
  await ensureRuntimeDirectory(NATIVE_SOURCE_CACHE)
  const recipe = NATIVE_DEPENDENCY_RECIPES[name]
  const archive = assertManagedRuntimePath(join(NATIVE_SOURCE_CACHE, `${name}-${recipe.version}-${basename(new URL(recipe.url).pathname)}`))
  if (force || !await pathExists(archive) || await sha256File(archive) !== recipe.sha256) {
    await downloadFile({ url: recipe.url, sha256: recipe.sha256, destination: archive })
  }
  return archive
}

const nativeRecipe = (name: NativeDependencyName) => {
  const recipe = NATIVE_DEPENDENCY_RECIPES[name]
  return { binaryRelativePath: recipe.healthFiles[0]!, sourceNames: [name], buildFlags: [...recipe.configureArgs, ...((recipe as NativeDependencyRecipe).linkLibraries ?? []).map(library => `-l${library}`)], requiredPaths: [...recipe.healthFiles] }
}

const nativeSources = (name: NativeDependencyName) => {
  const recipe = NATIVE_DEPENDENCY_RECIPES[name]
  return [{ name, version: recipe.version, url: recipe.url, sha256: recipe.sha256 }]
}

const nativeDependencies = async (name: NativeDependencyName) => await Promise.all(NATIVE_DEPENDENCY_RECIPES[name].dependencies.map(async dependency => ({
  name: dependency,
  version: NATIVE_DEPENDENCY_RECIPES[dependency as NativeDependencyName].version,
  manifestSha256: await sha256File(assertManagedRuntimePath(join(nativeDependencyPrefix(dependency as NativeDependencyName), NATIVE_MANIFEST)))
})))

export const readManagedNativeDependencyIdentity = async (name: NativeDependencyName): Promise<{ name: string, version: string, manifestSha256: string }> => ({
  name,
  version: NATIVE_DEPENDENCY_RECIPES[name].version,
  manifestSha256: await sha256File(assertManagedRuntimePath(join(nativeDependencyPrefix(name), NATIVE_MANIFEST)))
})

export const validateManagedNativeDependency = async (
  name: NativeDependencyName,
  options: { macosVersion?: string } = {}
): Promise<ManagedSourceArtifactValidation> => {
  try {
    let macosVersion = options.macosVersion
    if (process.platform === 'darwin' && !macosVersion) {
      const metadata = await Bun.file('/System/Library/CoreServices/SystemVersion.plist').text()
      macosVersion = metadata.match(/<key>ProductVersion<\/key>\s*<string>([^<]+)<\/string>/)?.[1]
      if (!macosVersion) return { healthy: false, reason: 'Could not read macOS version metadata without launching a tool.' }
    }
    let result: ManagedSourceArtifactValidation = { healthy: false, reason: `No native recipe selected for ${name}` }
    for (const dependency of nativeDependencyOrder([name])) {
      assertManagedRuntimePath(join(nativeDependencyPrefix(dependency), NATIVE_MANIFEST))
      result = await validateManagedSourceArtifact(dependency, {
        toolDir: nativeDependencyPrefix(dependency), platform: process.platform, architecture: process.arch,
        ...(macosVersion ? { macosVersion } : {}),
        recipe: nativeRecipe(dependency), expectedVersion: NATIVE_DEPENDENCY_RECIPES[dependency].version,
        expectedSources: nativeSources(dependency), expectedDependencies: await nativeDependencies(dependency), expectedRecipeRevision: nativeRecipeRevision(dependency)
      })
      if (!result.healthy) return { healthy: false, reason: `${dependency}: ${result.reason}` }
    }
    return result
  } catch (error) {
    return { healthy: false, reason: error instanceof Error ? error.message : String(error) }
  }
}

const validateNative = async (name: NativeDependencyName, toolDir: string, expectedRevision = nativeRecipeRevision(name)): Promise<void> => {
  assertManagedRuntimePath(join(toolDir, NATIVE_MANIFEST))
  const validation = await validateManagedSourceArtifact(name, {
    toolDir, platform: process.platform, architecture: process.arch,
    recipe: nativeRecipe(name), expectedVersion: NATIVE_DEPENDENCY_RECIPES[name].version,
    expectedSources: nativeSources(name), expectedDependencies: await nativeDependencies(name), expectedRecipeRevision: expectedRevision
  })
  if (!validation.healthy) throw InfraError(`Managed ${name} is not reusable: ${validation.reason}`, { stage: 'setup:native-dependencies' })
}

export const makePortableNativeConfigScript = (source: string, finalPath: string, runtimeRoot = RUNTIME_DIR): string => {
  if (source.includes('# AutoShow runtime-relative native configuration.')) return source
  if (!source.includes(runtimeRoot) || !/^#![^\n]*\b(?:ba)?sh\b/.test(source)) return source
  const portableLine = (line: string): string => {
    let quote: "'" | '"' | undefined
    let output = ''
    for (let index = 0; index < line.length;) {
      if (line.startsWith(runtimeRoot, index)) {
        output += quote === "'" ? "'\"${managed_runtime_dir}\"'" : quote === '"' ? '${managed_runtime_dir}' : '"${managed_runtime_dir}"'
        index += runtimeRoot.length
        continue
      }
      const character = line[index]!
      if (character === '\\' && quote !== "'") {
        output += line.slice(index, index + 2)
        index += 2
        continue
      }
      if (character === '#' && quote === undefined) return output + line.slice(index)
      if (character === "'" && quote !== '"') quote = quote === "'" ? undefined : "'"
      else if (character === '"' && quote !== "'") quote = quote === '"' ? undefined : '"'
      output += character
      index++
    }
    return output
  }
  const lines = source.split('\n')
  const shebang = lines.shift()!
  const toRuntime = relative(dirname(finalPath), runtimeRoot).split('\\').join('/')
  const pkgPaths = nativeDependencyNames().flatMap(name => [`\${managed_runtime_dir}/tools/native/${name}/lib/pkgconfig`, `\${managed_runtime_dir}/tools/native/${name}/share/pkgconfig`]).join(':')
  return `${shebang}\n# AutoShow runtime-relative native configuration.\nmanaged_runtime_dir=$(CDPATH= cd "$(dirname "$0")/${toRuntime}" && pwd) || exit 1\nexport PKG_CONFIG_PATH=\nexport PKG_CONFIG_LIBDIR="${pkgPaths}"\n${lines.map(portableLine).join('\n')}`
}

const assertNoEscapingNativeLinks = async (root: string, directory = root): Promise<void> => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue
    const path = join(directory, entry.name)
    if (entry.isSymbolicLink()) {
      const target = await readlink(path)
      const resolved = resolve(dirname(path), target)
      if (isAbsolute(target) || relative(root, resolved).startsWith('..')) throw InfraError(`Native install has an escaping symlink: ${relative(root, path)}`, { stage: 'setup:native-dependencies' })
    } else if (entry.isDirectory()) await assertNoEscapingNativeLinks(root, path)
  }
}

export const normalizeManagedNativeMetadata = async (stagingPrefix: string, finalPrefix: string, runtimeRoot = RUNTIME_DIR): Promise<void> => {
  assertManagedRuntimePath(stagingPrefix)
  assertManagedRuntimePath(finalPrefix)
  const installRelative = relative(runtimeRoot, finalPrefix)
  if (isAbsolute(installRelative) || installRelative.startsWith('..')) throw InfraError('Native metadata prefix must remain inside runtime', { stage: 'setup:native-dependencies' })
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === '.DS_Store') continue
      const path = assertManagedRuntimePath(join(directory, entry.name))
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile() && entry.name.endsWith('.la')) {
        // All consumers use static archives and pkgconf metadata. Libtool's
        // absolute dependency lists would couple the install to this checkout.
        await rm(path)
      } else if (entry.isFile() && entry.name.endsWith('.pc')) {
        const contents = await Bun.file(path).text()
        const eventualPath = join(finalPrefix, relative(stagingPrefix, path))
        const toRuntime = relative(dirname(eventualPath), runtimeRoot).split('\\').join('/')
        const portable = contents.replace(/^runtime_root=\$\{pcfiledir\}\/[^\n]*\n/, '').replaceAll(runtimeRoot, '${runtime_root}')
        await Bun.write(path, `runtime_root=\${pcfiledir}/${toRuntime}\n${portable}`)
      } else if (entry.isFile() && entry.name.endsWith('.cmake')) {
        const contents = await Bun.file(path).text()
        if (contents.includes(runtimeRoot)) {
          const eventualPath = join(finalPrefix, relative(stagingPrefix, path))
          const toRuntime = relative(dirname(eventualPath), runtimeRoot).split('\\').join('/')
          const portable = contents.replaceAll(runtimeRoot, '${_autoshow_runtime_root}')
          await Bun.write(path, `get_filename_component(_autoshow_runtime_root "\${CMAKE_CURRENT_LIST_DIR}/${toRuntime}" ABSOLUTE)\n${portable}`)
        }
      } else if (entry.isFile() && entry.name.endsWith('-config')) {
        const contents = await Bun.file(path).text()
        const finalPath = join(finalPrefix, relative(stagingPrefix, path))
        const portable = makePortableNativeConfigScript(contents, finalPath, runtimeRoot)
        if (portable !== contents) await Bun.write(path, portable)
      }
    }
  }
  await visit(stagingPrefix)
}

const buildNative = async (name: NativeDependencyName, options: ManagedNativeSetupOptions): Promise<void> => {
  const recipe = NATIVE_DEPENDENCY_RECIPES[name]
  const prefix = nativeDependencyPrefix(name)
  await ensureRuntimeDirectory(dirname(prefix))
  await recoverManagedToolDirectory(prefix)
  if (!options.forceRedownload) {
    try { await validateNative(name, prefix); return } catch { /* Repair only this managed component. */ }
    if (nativeRecipeRevision(name) !== NATIVE_RECIPE_REVISION) {
      try {
        await validateNative(name, prefix, NATIVE_RECIPE_REVISION)
        const original = await Bun.file(assertManagedRuntimePath(join(prefix, NATIVE_MANIFEST))).json() as { macosDeploymentTarget: string }
        const staging = assertManagedRuntimePath(await createManagedToolStagingDirectory(prefix))
        await cp(prefix, staging, { recursive: true, preserveTimestamps: true, verbatimSymlinks: true, filter: path => basename(path) !== '.DS_Store' })
        await normalizeManagedNativeMetadata(staging, prefix)
        await writeManagedSourceArtifactManifest({
          tool: name, toolDir: staging, deploymentTarget: original.macosDeploymentTarget,
          recipe: nativeRecipe(name), version: recipe.version, sources: nativeSources(name),
          dependencies: await nativeDependencies(name), recipeRevision: nativeRecipeRevision(name)
        })
        await promoteManagedToolDirectory({ stagingDir: staging, destinationDir: prefix, validateStaging: path => validateNative(name, path) })
        return
      } catch { /* Incompatible or corrupted predecessors require a source repair. */ }
    }
  }
  l.write('info', `Installing managed ${name} ${recipe.version}`, { category: 'command' })
  const work = join(NATIVE_BUILD_ROOT, `${name}-${recipe.sha256.slice(0, 12)}`)
  const attempt = crypto.randomUUID()
  const source = join(work, `source-${attempt}`)
  const build = join(work, `build-${attempt}`)
  const stage = join(work, `stage-${attempt}`)
  await ensureRuntimeDirectory(work)
  assertManagedRuntimePath(source)
  assertManagedRuntimePath(build)
  const archive = await sourceArchive(name, options.forceRedownload === true)
  await extractManagedNativeSource(archive, source)
  await ensureRuntimeDirectory(stage)
  const stagingPrefix = assertManagedRuntimePath(join(stage, prefix.slice(1)))
  const names = recipe.dependencies as readonly NativeDependencyName[]
  const env = { ...managedNativeRecipeBuildEnv(name), DESTDIR: stage }
  const args = recipe.configureArgs.map(arg => arg.replaceAll('{prefix}', prefix))
  const dependencyPrefixes = nativeDependencyOrder(names).map(nativeDependencyPrefix)
  const jobs = String(Math.min(logicalCpuCount(), 8))
  if (recipe.buildSystem === 'fonts') {
    await ensureRuntimeDirectory(stagingPrefix)
    const destination = join(stagingPrefix, 'share/fonts/truetype/dejavu')
    await ensureRuntimeDirectory(destination)
    await cp(join(source, 'ttf'), destination, { recursive: true, filter: path => basename(path) !== '.DS_Store' })
    for (const license of ['LICENSE', 'README', 'AUTHORS']) {
      if (await pathExists(join(source, license))) await cp(join(source, license), join(stagingPrefix, license))
    }
  } else if (recipe.buildSystem === 'cmake') {
    await runNativeBuildCommand(name, managedBuildToolPath('cmake'), [
      '-S', source, '-B', build, '-G', 'Ninja',
      `-DCMAKE_MAKE_PROGRAM=${managedBuildToolPath('ninja')}`, `-DCMAKE_INSTALL_PREFIX=${prefix}`,
      '-DCMAKE_C_COMPILER=/usr/bin/clang', '-DCMAKE_CXX_COMPILER=/usr/bin/clang++',
      `-DCMAKE_PREFIX_PATH=${dependencyPrefixes.join(';')}`, `-DCMAKE_FIND_ROOT_PATH=${dependencyPrefixes.join(';')}`,
      ...MANAGED_NATIVE_CMAKE_POLICY_FLAGS, ...args
    ], { env })
    await runNativeBuildCommand(name, managedBuildToolPath('cmake'), ['--build', build, '--parallel', jobs], { env })
    await runNativeBuildCommand(name, managedBuildToolPath('cmake'), ['--install', build], { env })
  } else if (recipe.buildSystem === 'meson') {
    await runNativeBuildCommand(name, managedBuildToolPath('meson'), ['setup', build, source, `--prefix=${prefix}`, '--libdir=lib', '--buildtype=release', '--default-library=static', '-Dprefer_static=true', '--wrap-mode=nodownload', ...args], { env })
    await runNativeBuildCommand(name, managedBuildToolPath('meson'), ['compile', '-C', build, '-j', jobs], { env })
    await runNativeBuildCommand(name, managedBuildToolPath('meson'), ['install', '-C', build, '--no-rebuild'], { env })
  } else {
    // Out-of-tree configure keeps extracted source archives reusable after an interruption.
    await ensureRuntimeDirectory(build)
    await runNativeBuildCommand(name, join(source, 'configure'), [`--prefix=${prefix}`, ...args], { cwd: build, env })
    await runNativeBuildCommand(name, '/usr/bin/make', ['-j', jobs], { cwd: build, env })
    await runNativeBuildCommand(name, '/usr/bin/make', ['install'], { cwd: build, env })
  }
  for (const notice of recipe.noticeFiles ?? []) {
    const destination = assertManagedRuntimePath(join(stagingPrefix, 'share/licenses', name, notice))
    await ensureRuntimeDirectory(dirname(destination))
    await cp(join(source, notice), destination, { recursive: true, dereference: true, filter: path => basename(path) !== '.DS_Store' })
  }
  await normalizeManagedNativeMetadata(stagingPrefix, prefix)
  await assertNoEscapingNativeLinks(stagingPrefix)
  for (const healthPath of recipe.healthFiles) {
    const info = await lstat(join(stagingPrefix, healthPath))
    if (!info.isFile() && !info.isSymbolicLink()) throw InfraError(`Managed ${name} is missing required artifact ${healthPath}`, { stage: 'setup:native-dependencies' })
  }
  const executables = recipe.healthFiles.filter(path => path.startsWith('bin/')).map(path => join(stagingPrefix, path))
  if (process.platform === 'darwin' && executables.length > 0) await assertManagedDynamicLibraryClosure(executables)
  await writeManagedSourceArtifactManifest({
    tool: name, toolDir: stagingPrefix, deploymentTarget: await resolveSourceDeploymentTarget(),
    recipe: nativeRecipe(name), version: recipe.version, sources: nativeSources(name),
    dependencies: await nativeDependencies(name), recipeRevision: nativeRecipeRevision(name)
  })
  await ensureRuntimeDirectory(dirname(prefix))
  await promoteManagedToolDirectory({ stagingDir: stagingPrefix, destinationDir: prefix, validateStaging: path => validateNative(name, path) })
  await rm(stage, { recursive: true, force: true })
  await rm(build, { recursive: true, force: true })
  await rm(source, { recursive: true, force: true })
}

export const ensureManagedNativeDependency = async (name: NativeDependencyName, options: ManagedNativeSetupOptions = {}): Promise<void> => {
  if (process.platform !== 'darwin') throw InfraError(`Managed native source provisioning is unavailable on ${process.platform}`, { stage: 'setup:native-dependencies' })
  assertManagedRuntimePath(NATIVE_SOURCE_CACHE)
  assertManagedRuntimePath(NATIVE_BUILD_ROOT)
  assertManagedRuntimePath(NATIVE_LOG_ROOT)
  nativeDependencyPrefix(name)
  const prior = pending.get(name)
  if (prior) return await prior
  const task = (async () => {
    nativeDependencyOrder([name])
    // Shared libraries can be reached through several feature steps in one
    // invocation. An explicit refresh downloads/builds each component once.
    const forceRedownload = options.forceRedownload === true && !refreshed.has(name)
    const refreshBuildTools = options.forceRedownload === true && !buildToolsRefreshed
    await ensureManagedBuildTools(refreshBuildTools ? { forceRedownload: true } : {})
    if (refreshBuildTools) buildToolsRefreshed = true
    for (const dependency of NATIVE_DEPENDENCY_RECIPES[name].dependencies) await ensureManagedNativeDependency(dependency as NativeDependencyName, options)
    await withProcessLock(`setup-native-${name}`, async () => await buildNative(name, forceRedownload ? { forceRedownload: true } : {}))
    if (forceRedownload) refreshed.add(name)
  })()
  pending.set(name, task)
  try { await task } finally { pending.delete(name) }
}

export const ensureManagedRenderingDependencies = async (options: ManagedNativeSetupOptions = {}): Promise<void> => {
  for (const name of NATIVE_RENDERING_DEPENDENCIES) await ensureManagedNativeDependency(name, options)
  await ensureManagedRenderingConfiguration()
  await activateManagedRenderingTools()
  await verifyManagedRenderingCapabilities()
}

export const activateManagedNativeBinary = async (name: string, target: string): Promise<void> => {
  await ensureRuntimeDirectory(RUNTIME_BIN_DIR)
  assertManagedRuntimePath(target)
  const destination = assertManagedRuntimePath(join(RUNTIME_BIN_DIR, name))
  const temporary = assertManagedRuntimePath(`${destination}.staging-${crypto.randomUUID()}`)
  const targetRelative = relative(RUNTIME_DIR, target)
  if (targetRelative.startsWith('..') || isAbsolute(targetRelative)) throw InfraError('Managed native binary must stay inside runtime', { stage: 'setup:native-dependencies' })
  const quote = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`
  await Bun.write(temporary, `#!/bin/sh\nmanaged_runtime_dir=$(CDPATH= cd "$(dirname "$0")/.." && pwd) || exit 1\nexec "$managed_runtime_dir"/${quote(targetRelative)} "$@"\n`)
  const { chmod } = await import('node:fs/promises')
  await chmod(temporary, 0o755)
  await rename(temporary, destination)
}
