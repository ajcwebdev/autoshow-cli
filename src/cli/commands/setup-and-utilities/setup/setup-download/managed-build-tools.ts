import { appendFileSync } from 'node:fs'
import { appendFile, chmod, cp, lstat, readdir, rename, rm, symlink } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative } from 'node:path'
import { PROJECT_ROOT, toProjectRelativePath } from '~/utils/project-root'
import { childEnv } from '~/utils/child-env'
import { InfraError } from '~/utils/error-handler'
import { pathExists } from '~/utils/filesystem'
import { logicalCpuCount } from '~/utils/logical-cpu-count'
import { withProcessLock } from '~/utils/process-lock'
import { readBoundedTextStream } from '~/utils/bounded-capture'
import { ensureRuntimeDirectory } from '~/utils/runtime-state'
import { assertManagedRuntimePath } from '~/utils/runtime-containment'
import type { ManagedSourcePayloadFile } from '~/types'
import { downloadFile } from './download'
import { extractTarGzFile } from './tar-gz'
import { createManagedToolStagingDirectory, promoteManagedToolDirectory, readManagedToolTransactionIssue, recoverManagedToolDirectory } from './managed-artifact'
import { collectManagedSourcePayload, managedSourcePayloadIssue } from './managed-artifact-payload'

// Upstream release pins. CMake's release checksum list and Meson's PyPI metadata
// publish the same digests; the remaining digests pin their upstream source bytes.
export const MANAGED_BUILD_TOOL_SOURCES = {
  cmake: {
    version: '3.31.12',
    url: 'https://github.com/Kitware/CMake/releases/download/v3.31.12/cmake-3.31.12.tar.gz',
    sha256: '5f3fd5a54dfa65602bdbed64f981a72673cc19f2d304cc2955cf0dfa0cfd8272',
    archive: 'cmake-3.31.12.tar.gz',
    binary: 'bin/cmake'
  },
  pkgconf: {
    version: '2.5.1',
    url: 'https://distfiles.ariadne.space/pkgconf/pkgconf-2.5.1.tar.gz',
    sha256: 'ab89d59810d9cad5dfcd508f25efab8ea0b1c8e7bad91c2b6351f13e6a5940d8',
    archive: 'pkgconf-2.5.1.tar.gz',
    binary: 'bin/pkgconf'
  },
  ninja: {
    version: '1.13.1',
    url: 'https://github.com/ninja-build/ninja/archive/refs/tags/v1.13.1.tar.gz',
    sha256: 'f0055ad0369bf2e372955ba55128d000cfcc21777057806015b45e4accbebf23',
    archive: 'ninja-1.13.1.tar.gz',
    binary: 'bin/ninja'
  },
  python: {
    version: '3.13.18',
    url: 'https://www.python.org/ftp/python/3.13.18/Python-3.13.18.tgz',
    sha256: '99dbc847fb6a3fb26358370fb4c591215864116ebb584f2b89ab0b74c51dfa2a',
    archive: 'Python-3.13.18.tgz',
    binary: 'bin/python3.13'
  },
  meson: {
    version: '1.9.1',
    url: 'https://files.pythonhosted.org/packages/48/d8/6c1dd1c740b7d5fd73a6ad67900a09e3dd6642013f58fa9e22ae6faaffc7/meson-1.9.1.tar.gz',
    sha256: '4e076606f2afff7881d195574bddcd8d89286f35a17b4977a216f535dc0c74ac',
    archive: 'meson-1.9.1.tar.gz',
    binary: 'meson.py'
  }
} as const

const runtimeRoot = join(PROJECT_ROOT, 'runtime')
const toolRoot = join(runtimeRoot, 'tools/build-tools')
const binRoot = join(runtimeRoot, 'bin')
const cacheRoot = join(runtimeRoot, 'cache/native-bootstrap')
const buildRoot = join(runtimeRoot, 'build/bootstrap')
const manifestName = '.autoshow-build-tool.json'
const recipeRevision = 'managed-bootstrap-source-cmake-v2'
const pythonRecipeRevision = 'managed-python-runtime-metadata-v3'
const ninjaRecipeRevision = 'managed-ninja-no-package-registry-v3'
const buildToolRecipeRevision = (name: keyof typeof MANAGED_BUILD_TOOL_SOURCES): string => name === 'python' ? pythonRecipeRevision : name === 'ninja' ? ninjaRecipeRevision : recipeRevision

export const managedNinjaConfigureArguments = (sourceDir: string, buildDir: string, installDir: string): string[] => [
  '-S', assertManagedRuntimePath(sourceDir), '-B', assertManagedRuntimePath(buildDir),
  '-DCMAKE_BUILD_TYPE=Release', '-DBUILD_TESTING=OFF',
  '-DCMAKE_FIND_USE_PACKAGE_REGISTRY=OFF',
  '-DCMAKE_FIND_USE_SYSTEM_PACKAGE_REGISTRY=OFF',
  '-DCMAKE_EXPORT_PACKAGE_REGISTRY=OFF',
  `-DCMAKE_INSTALL_PREFIX=${assertManagedRuntimePath(installDir)}`
]

export const managedBuildToolPath = (name: 'cmake' | 'pkgconf' | 'pkg-config' | 'ninja' | 'meson' | 'python3'): string => join(binRoot, name)

export const managedBuildToolPrefix = (name: keyof typeof MANAGED_BUILD_TOOL_SOURCES): string => join(toolRoot, name)

export const managedBuildEnvironment = (): Record<string, string | undefined> => ({
  PATH: [binRoot, '/usr/bin', '/bin', '/usr/sbin', '/sbin'].join(':'),
  TMPDIR: join(runtimeRoot, 'tmp'),
  TMP: join(runtimeRoot, 'tmp'),
  TEMP: join(runtimeRoot, 'tmp'),
  XDG_CACHE_HOME: join(runtimeRoot, 'cache'),
  PYTHONNOUSERSITE: '1',
  PYTHONDONTWRITEBYTECODE: '1',
  PYTHONPYCACHEPREFIX: join(runtimeRoot, 'cache/python'),
  PKG_CONFIG_PATH: '',
  PKG_CONFIG_LIBDIR: '',
  CMAKE_PREFIX_PATH: '',
  CMAKE_IGNORE_PREFIX_PATH: '/usr/local;/opt/local',
  CC: process.platform === 'darwin' ? '/usr/bin/clang' : '/usr/bin/cc',
  CXX: process.platform === 'darwin' ? '/usr/bin/clang++' : '/usr/bin/c++',
  CPPFLAGS: '',
  CFLAGS: '',
  CXXFLAGS: '',
  LDFLAGS: ''
})

const hashBuildToolFile = async (path: string): Promise<string> => {
  const hash = new Bun.CryptoHasher('sha256')
  for await (const chunk of Bun.file(assertManagedRuntimePath(path)).stream()) hash.update(chunk)
  return hash.digest('hex')
}

export const runManagedBuildToolCommand = async (name: string, command: string, args: string[], cwd: string, env: Record<string, string | undefined> = {}): Promise<string> => {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) throw new TypeError('Managed build-tool names must be simple names.')
  const workingDirectory = assertManagedRuntimePath(cwd)
  const executable = isAbsolute(command) ? command : assertManagedRuntimePath(join(workingDirectory, command))
  if (!['/usr/bin/', '/bin/', '/usr/sbin/', '/sbin/'].some(prefix => executable.startsWith(prefix))) assertManagedRuntimePath(executable)
  assertManagedRuntimePath(binRoot)
  const environment = { ...managedBuildEnvironment(), ...env }
  for (const key of ['TMPDIR', 'TMP', 'TEMP', 'XDG_CACHE_HOME', 'PYTHONPYCACHEPREFIX']) {
    const directory = environment[key]
    if (directory !== undefined) await ensureRuntimeDirectory(directory)
  }
  await ensureRuntimeDirectory(join(buildRoot, name))
  const logPath = assertManagedRuntimePath(join(buildRoot, name, 'build.log'))
  await appendFile(assertManagedRuntimePath(logPath), `${command} ${args.join(' ')}\n`)
  const proc = Bun.spawn([executable, ...args], {
    cwd: assertManagedRuntimePath(workingDirectory),
    env: childEnv({ set: environment }),
    stdout: 'pipe', stderr: 'pipe'
  })
  const timeout = setTimeout(() => proc.kill('SIGTERM'), 30 * 60_000)
  const heartbeat = setInterval(() => process.stderr.write(`Building managed ${name}; diagnostics: ${toProjectRelativePath(logPath)}\n`), 30_000)
  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      readBoundedTextStream(proc.stdout, { maxBytes: 64 * 1024 }, 64 * 1024, chunk => appendFileSync(assertManagedRuntimePath(logPath), chunk)),
      readBoundedTextStream(proc.stderr, { maxBytes: 64 * 1024 }, 64 * 1024, chunk => appendFileSync(assertManagedRuntimePath(logPath), chunk)),
      proc.exited
    ])
    await appendFile(assertManagedRuntimePath(logPath), `\nexit=${exitCode}\n`)
    if (exitCode !== 0) throw InfraError(`Managed ${name} command failed (exit ${exitCode}): ${stderr.sanitizedPreview || stdout.sanitizedPreview}`, { stage: `setup:build-tool:${name}` })
    return `${stdout.text}\n${stderr.text}`
  } finally {
    clearTimeout(timeout)
    clearInterval(heartbeat)
  }
}

const readBuildToolReceipt = async (name: keyof typeof MANAGED_BUILD_TOOL_SOURCES, prefix: string, expectedRecipe: string): Promise<{ healthy: boolean, reason?: string, version: string, path: string }> => {
  const source = MANAGED_BUILD_TOOL_SOURCES[name]
  const identity = { version: source.version, path: toProjectRelativePath(join(prefix, source.binary)) }
  const invalid = (reason: string) => ({ ...identity, healthy: false, reason })
  try {
    assertManagedRuntimePath(prefix)
    const manifest: unknown = await Bun.file(assertManagedRuntimePath(join(prefix, manifestName))).json()
    if (!manifest || typeof manifest !== 'object') return invalid('build-tool receipt is not an object')
    const record = manifest as Record<string, unknown>
    if (record['schemaVersion'] !== 1 || record['name'] !== name || record['url'] !== source.url || record['binary'] !== source.binary || record['recipe'] !== expectedRecipe || record['sha256'] !== source.sha256 || record['version'] !== source.version || record['platform'] !== process.platform || record['architecture'] !== process.arch) return invalid('build-tool source, recipe, version, platform or architecture does not match the current pin')
    if (record['binarySha256'] !== await hashBuildToolFile(join(prefix, source.binary))) return invalid('build-tool executable hash does not match its receipt')
    if (!Array.isArray(record['payload'])) return invalid('build-tool receipt has no complete payload inventory')
    const actual = (await collectManagedSourcePayload(assertManagedRuntimePath(prefix))).filter(entry => entry.path !== manifestName)
    const issue = managedSourcePayloadIssue(record['payload'] as ManagedSourcePayloadFile[], actual)
    return issue ? invalid(issue) : { ...identity, healthy: true }
  } catch (error) { return invalid(error instanceof Error ? error.message : 'build-tool receipt or payload cannot be read') }
}

export const readManagedBuildToolReadiness = async (name: keyof typeof MANAGED_BUILD_TOOL_SOURCES, prefix = managedBuildToolPrefix(name)): Promise<{ healthy: boolean, reason?: string, version: string, path: string }> => {
  const transactionIssue = await readManagedToolTransactionIssue(prefix)
  if (transactionIssue) return { healthy: false, reason: transactionIssue, version: MANAGED_BUILD_TOOL_SOURCES[name].version, path: toProjectRelativePath(join(prefix, MANAGED_BUILD_TOOL_SOURCES[name].binary)) }
  return await readBuildToolReceipt(name, prefix, buildToolRecipeRevision(name))
}

export const isManagedBuildToolCurrent = async (name: keyof typeof MANAGED_BUILD_TOOL_SOURCES, prefix = managedBuildToolPrefix(name)): Promise<boolean> =>
  (await readManagedBuildToolReadiness(name, prefix)).healthy

export const writeManagedBuildToolReceipt = async (name: keyof typeof MANAGED_BUILD_TOOL_SOURCES, prefix: string): Promise<void> => {
  const source = MANAGED_BUILD_TOOL_SOURCES[name]
  const receiptPath = assertManagedRuntimePath(join(prefix, manifestName))
  const payload = (await collectManagedSourcePayload(assertManagedRuntimePath(prefix))).filter(entry => entry.path !== manifestName)
  await Bun.write(assertManagedRuntimePath(receiptPath), `${JSON.stringify({ schemaVersion: 1, recipe: buildToolRecipeRevision(name), name, version: source.version, url: source.url, sha256: source.sha256, platform: process.platform, architecture: process.arch, binary: source.binary, binarySha256: await hashBuildToolFile(join(prefix, source.binary)), payload }, null, 2)}\n`)
}

const generatedPythonSysconfigSuffix = '\n# AutoShow relocatable generated installation metadata.\nimport os as _autoshow_sysconfig_os\n_autoshow_configured_prefix = build_time_vars.get("prefix", "")\n_autoshow_runtime_prefix = _autoshow_sysconfig_os.path.realpath(_autoshow_sysconfig_os.path.join(_autoshow_sysconfig_os.path.dirname(__file__), "..", ".."))\nif _autoshow_configured_prefix:\n    for _autoshow_key, _autoshow_value in tuple(build_time_vars.items()):\n        if isinstance(_autoshow_value, str):\n            build_time_vars[_autoshow_key] = _autoshow_value.replace(_autoshow_configured_prefix, _autoshow_runtime_prefix)\ndel _autoshow_sysconfig_os, _autoshow_configured_prefix, _autoshow_runtime_prefix\n'

export const normalizeManagedPythonInstallation = async (prefix: string): Promise<void> => {
  assertManagedRuntimePath(prefix)
  const pythonMinorVersion = MANAGED_BUILD_TOOL_SOURCES.python.version.split('.').slice(0, 2).join('.')
  const stdlib = assertManagedRuntimePath(join(prefix, 'lib', `python${pythonMinorVersion}`))
  let normalizedConfigurations = 0
  for (const entry of await readdir(assertManagedRuntimePath(stdlib), { withFileTypes: true })) {
    if (entry.name === '.DS_Store' || !entry.isFile() || !/^_sysconfigdata[^/]*\.py$/.test(entry.name)) continue
    const path = assertManagedRuntimePath(join(stdlib, entry.name))
    const source = await Bun.file(assertManagedRuntimePath(path)).text()
    if (!source.includes('build_time_vars = {')) throw InfraError('Managed Python generated configuration has an unsupported shape', { stage: 'setup:build-tool:python' })
    if (!source.includes('# AutoShow relocatable generated installation metadata.')) await Bun.write(assertManagedRuntimePath(path), `${source.trimEnd()}\n${generatedPythonSysconfigSuffix}`)
    normalizedConfigurations += 1
  }
  if (normalizedConfigurations === 0) throw InfraError('Managed Python generated installation metadata was not found', { stage: 'setup:build-tool:python' })
  const packageConfigDirectory = assertManagedRuntimePath(join(prefix, 'lib/pkgconfig'))
  for (const entry of await readdir(assertManagedRuntimePath(packageConfigDirectory), { withFileTypes: true })) {
    if (entry.name === '.DS_Store' || !entry.isFile() || !entry.name.endsWith('.pc')) continue
    const path = assertManagedRuntimePath(join(packageConfigDirectory, entry.name))
    const source = await Bun.file(assertManagedRuntimePath(path)).text()
    if (!/^prefix=.*$/m.test(source)) throw InfraError('Managed Python package configuration has no installation prefix', { stage: 'setup:build-tool:python' })
    await Bun.write(assertManagedRuntimePath(path), source.replace(/^prefix=.*$/m, 'prefix=${pcfiledir}/../..'))
  }
  const binaryDirectory = assertManagedRuntimePath(join(prefix, 'bin'))
  for (const entry of await readdir(assertManagedRuntimePath(binaryDirectory), { withFileTypes: true })) {
    if (entry.name === '.DS_Store' || !entry.isFile() || entry.name.endsWith('.vendor')) continue
    const path = assertManagedRuntimePath(join(binaryDirectory, entry.name))
    const firstLine = (await Bun.file(assertManagedRuntimePath(path)).slice(0, 512).text()).split('\n')[0] ?? ''
    if (!/^#!\/.*\/python3(?:\.\d+)?\s*$/.test(firstLine)) continue
    const vendorPath = assertManagedRuntimePath(`${path}.vendor`)
    if (await pathExists(assertManagedRuntimePath(vendorPath))) throw InfraError(`Managed Python vendor launcher already exists: ${entry.name}`, { stage: 'setup:build-tool:python' })
    const mode = (await lstat(assertManagedRuntimePath(path))).mode & 0o7777
    await rename(assertManagedRuntimePath(path), vendorPath)
    await Bun.write(assertManagedRuntimePath(path), `#!/bin/sh\nmanaged_python_bindir=$(CDPATH= cd "$(dirname "$0")" && pwd) || exit 1\nexec "$managed_python_bindir/python${pythonMinorVersion}" -B "$managed_python_bindir/${entry.name}.vendor" "$@"\n`)
    await chmod(assertManagedRuntimePath(path), mode)
  }
}

const writeBuildToolShim = async (name: keyof typeof MANAGED_BUILD_TOOL_SOURCES): Promise<void> => {
  await ensureRuntimeDirectory(binRoot)
  const source = MANAGED_BUILD_TOOL_SOURCES[name]
  const destination = assertManagedRuntimePath(join(binRoot, name === 'python' ? 'python3' : name))
  const temp = assertManagedRuntimePath(`${destination}.tmp-${crypto.randomUUID()}`)
  try {
    if (name === 'meson') {
      await Bun.write(assertManagedRuntimePath(temp), '#!/bin/sh\nmanaged_bin_dir=$(CDPATH= cd "$(dirname "$0")" && pwd) || exit 1\nexec "$managed_bin_dir/python3" "$managed_bin_dir/../tools/build-tools/meson/meson.py" "$@"\n')
      await chmod(assertManagedRuntimePath(temp), 0o755)
    } else if (name === 'python') {
      await Bun.write(assertManagedRuntimePath(temp), `#!/bin/sh\nmanaged_bin_dir=$(CDPATH= cd "$(dirname "$0")" && pwd) || exit 1\nexec "$managed_bin_dir/../tools/build-tools/python/${source.binary}" -B "$@"\n`)
      await chmod(assertManagedRuntimePath(temp), 0o755)
    } else {
      await symlink(relative(dirname(destination), assertManagedRuntimePath(join(managedBuildToolPrefix(name), source.binary))), assertManagedRuntimePath(temp))
    }
    await rename(assertManagedRuntimePath(temp), assertManagedRuntimePath(destination))
  } finally { await rm(assertManagedRuntimePath(temp), { force: true }) }
  if (name === 'pkgconf') {
    const pkgConfig = assertManagedRuntimePath(join(binRoot, 'pkg-config'))
    const pkgConfigTemp = assertManagedRuntimePath(`${pkgConfig}.tmp-${crypto.randomUUID()}`)
    try { await symlink('pkgconf', assertManagedRuntimePath(pkgConfigTemp)); await rename(assertManagedRuntimePath(pkgConfigTemp), assertManagedRuntimePath(pkgConfig)) } finally { await rm(assertManagedRuntimePath(pkgConfigTemp), { force: true }) }
  }
}

const validateBuildToolPrefix = async (name: keyof typeof MANAGED_BUILD_TOOL_SOURCES, prefix: string): Promise<void> => {
  // Promotion validates its own candidate while the durable transaction is
  // still open. Only public installed-readiness checks reject that journal.
  const validation = await readBuildToolReceipt(name, prefix, buildToolRecipeRevision(name))
  if (!validation.healthy) throw InfraError(`Managed ${name} artifact validation failed: ${validation.reason}`, { stage: `setup:build-tool:${name}` })
  const source = MANAGED_BUILD_TOOL_SOURCES[name]
  const command = name === 'meson' ? managedBuildToolPath('python3') : join(prefix, source.binary)
  const args = name === 'meson'
    ? [join(prefix, source.binary), '--version']
    : name === 'python'
      ? ['-I', '-B', '-c', 'import json, os, sys, sysconfig; prefix = os.path.realpath(sys.base_prefix); paths = list(sysconfig.get_paths().values()) + [sysconfig.get_config_var(key) for key in ("prefix", "exec_prefix", "LIBDIR", "INCLUDEPY", "BINDIR")]; assert all(isinstance(path, str) and os.path.commonpath((prefix, os.path.realpath(path))) == prefix for path in paths), paths; print(sys.version)']
      : ['--version']
  const output = await runManagedBuildToolCommand(name, command, args, prefix)
  if (!output.includes(source.version)) throw InfraError(`Managed ${name} did not report expected version ${source.version}`, { stage: `setup:build-tool:${name}` })
}

export const promoteManagedBuildToolInstallation = async (
  name: keyof typeof MANAGED_BUILD_TOOL_SOURCES,
  stagingDir: string,
  options: { checkpoint?: (phase: 'journal-prepared' | 'previous-renamed' | 'candidate-renamed' | 'committed') => Promise<void> } = {}
): Promise<void> => {
  const prefix = assertManagedRuntimePath(managedBuildToolPrefix(name))
  await promoteManagedToolDirectory({
    stagingDir: assertManagedRuntimePath(stagingDir), destinationDir: prefix,
    validateStaging: async path => await validateBuildToolPrefix(name, assertManagedRuntimePath(path)),
    activate: async () => await writeBuildToolShim(name),
    rollbackActivation: async hadPrevious => { if (hadPrevious) await writeBuildToolShim(name) },
    ...(options.checkpoint ? { checkpoint: options.checkpoint } : {})
  })
}

const refreshedBuildTools = new Set<keyof typeof MANAGED_BUILD_TOOL_SOURCES>()

export const withManagedBuildToolRefresh = async <T>(name: keyof typeof MANAGED_BUILD_TOOL_SOURCES, requested: boolean, install: (forceRedownload: boolean) => Promise<T>): Promise<T> => withProcessLock(`managed-build-tool-${name}`, async () => {
  const forceRedownload = requested && !refreshedBuildTools.has(name)
  const result = await install(forceRedownload)
  if (forceRedownload) refreshedBuildTools.add(name)
  return result
})

export const ensureManagedBuildTool = async (name: keyof typeof MANAGED_BUILD_TOOL_SOURCES, options: { forceRedownload?: boolean } = {}): Promise<void> => withManagedBuildToolRefresh(name, options.forceRedownload === true, async forceRedownload => {
  const prefix = assertManagedRuntimePath(managedBuildToolPrefix(name))
  await recoverManagedToolDirectory(prefix)
  if (!forceRedownload && await isManagedBuildToolCurrent(name)) {
    await validateBuildToolPrefix(name, prefix)
    await writeBuildToolShim(name)
    return
  }
  if (name === 'python' && !forceRedownload && (await readBuildToolReceipt(name, prefix, recipeRevision)).healthy) {
    await ensureRuntimeDirectory(toolRoot)
    const stagingDir = assertManagedRuntimePath(await createManagedToolStagingDirectory(prefix))
    await cp(assertManagedRuntimePath(prefix), stagingDir, { recursive: true, preserveTimestamps: true, verbatimSymlinks: true, filter: path => !path.endsWith('/.DS_Store') })
    await normalizeManagedPythonInstallation(stagingDir)
    await writeManagedBuildToolReceipt(name, stagingDir)
    await promoteManagedBuildToolInstallation(name, stagingDir)
    return
  }
  const source = MANAGED_BUILD_TOOL_SOURCES[name]
  await ensureRuntimeDirectory(toolRoot)
  await ensureRuntimeDirectory(cacheRoot)
  const archivePath = assertManagedRuntimePath(join(cacheRoot, source.archive))
  if (forceRedownload || !await pathExists(assertManagedRuntimePath(archivePath)) || await hashBuildToolFile(archivePath) !== source.sha256) {
    await downloadFile({ url: source.url, sha256: source.sha256, destination: assertManagedRuntimePath(archivePath) })
  }
  const workspace = assertManagedRuntimePath(join(buildRoot, name, `attempt-${crypto.randomUUID()}`))
  const sourceDir = assertManagedRuntimePath(join(workspace, 'source'))
  await ensureRuntimeDirectory(sourceDir)
  await extractTarGzFile(assertManagedRuntimePath(archivePath), { destination: assertManagedRuntimePath(sourceDir), stripComponents: 1 })
  const stagingDir = assertManagedRuntimePath(await createManagedToolStagingDirectory(assertManagedRuntimePath(prefix)))
  const jobs = String(Math.min(logicalCpuCount(), 8))
  if (name === 'meson') {
    for (const path of ['meson.py', 'mesonbuild', 'data', 'COPYING']) {
      const from = assertManagedRuntimePath(join(sourceDir, path))
      const to = assertManagedRuntimePath(join(stagingDir, path))
      if (await pathExists(from)) await cp(assertManagedRuntimePath(from), assertManagedRuntimePath(to), { recursive: true })
    }
  } else if (name === 'cmake') {
    const bootstrapEnvironment = { PATH: '/usr/bin:/bin:/usr/sbin:/sbin' }
    await runManagedBuildToolCommand(name, './bootstrap', [`--prefix=${stagingDir}`, `--parallel=${jobs}`, '--no-system-libs', '--', '-DCMAKE_USE_OPENSSL=OFF', '-DBUILD_TESTING=OFF'], sourceDir, bootstrapEnvironment)
    await runManagedBuildToolCommand(name, '/usr/bin/make', ['-j', jobs], sourceDir, bootstrapEnvironment)
    await runManagedBuildToolCommand(name, '/usr/bin/make', ['install'], sourceDir, bootstrapEnvironment)
  } else if (name === 'pkgconf') {
    await runManagedBuildToolCommand(name, './configure', [`--prefix=${stagingDir}`, '--disable-shared', '--enable-static', '--disable-dependency-tracking', '--with-pkg-config-dir='], sourceDir)
    await runManagedBuildToolCommand(name, '/usr/bin/make', ['-j', jobs], sourceDir)
    await runManagedBuildToolCommand(name, '/usr/bin/make', ['install'], sourceDir)
  } else if (name === 'ninja') {
    const configuredBuild = assertManagedRuntimePath(join(workspace, 'compiled'))
    await runManagedBuildToolCommand(name, managedBuildToolPath('cmake'), managedNinjaConfigureArguments(sourceDir, configuredBuild, stagingDir), sourceDir)
    await runManagedBuildToolCommand(name, managedBuildToolPath('cmake'), ['--build', configuredBuild, '--parallel', jobs], sourceDir)
    await runManagedBuildToolCommand(name, managedBuildToolPath('cmake'), ['--install', configuredBuild], sourceDir)
  } else {
    await runManagedBuildToolCommand(name, './configure', [`--prefix=${prefix}`, '--without-ensurepip', '--disable-test-modules', '--without-static-libpython'], sourceDir)
    await runManagedBuildToolCommand(name, '/usr/bin/make', ['-j', jobs], sourceDir)
    const destinationRoot = assertManagedRuntimePath(join(workspace, 'installation'))
    await ensureRuntimeDirectory(destinationRoot)
    await runManagedBuildToolCommand(name, '/usr/bin/make', ['install', `DESTDIR=${destinationRoot}`, 'COMPILEALL_OPTS=-j1'], sourceDir)
    const installedPrefix = assertManagedRuntimePath(join(destinationRoot, prefix.replace(/^\/+/, '')))
    await cp(installedPrefix, stagingDir, { recursive: true, preserveTimestamps: true, verbatimSymlinks: true, filter: path => !path.endsWith('/.DS_Store') })
    await normalizeManagedPythonInstallation(stagingDir)
  }
  await writeManagedBuildToolReceipt(name, stagingDir)
  await promoteManagedBuildToolInstallation(name, stagingDir)
  await rm(assertManagedRuntimePath(workspace), { recursive: true, force: true })
})

let managedBuildToolsReady: Promise<void> | undefined

const provisionManagedBuildTools = async (options: { forceRedownload?: boolean }): Promise<void> => {
  if (process.platform !== 'darwin' && process.platform !== 'linux') throw InfraError('Managed native build tools require macOS or Linux with OS compiler tools', { stage: 'setup:build-tools' })
  await ensureManagedBuildTool('cmake', options)
  await ensureManagedBuildTool('pkgconf', options)
  await ensureManagedBuildTool('ninja', options)
  await ensureManagedBuildTool('python', options)
  await ensureManagedBuildTool('meson', options)
}

export const ensureManagedBuildTools = async (options: { forceRedownload?: boolean } = {}): Promise<void> => {
  if (options.forceRedownload || !managedBuildToolsReady) {
    const pending = provisionManagedBuildTools(options)
    managedBuildToolsReady = pending
    pending.catch(() => { if (managedBuildToolsReady === pending) managedBuildToolsReady = undefined })
  }
  await managedBuildToolsReady
}
