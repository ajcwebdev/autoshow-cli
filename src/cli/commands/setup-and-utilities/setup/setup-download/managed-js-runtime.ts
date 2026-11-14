import { chmod, lstat, mkdir, readFile, readdir, readlink, realpath, rename, rm, symlink } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative } from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { childEnv } from '~/utils/child-env'
import { InfraError } from '~/utils/error-handler'
import { pathExists } from '~/utils/filesystem'
import { withProcessLock } from '~/utils/process-lock'
import { assertRuntimeContainedPath, getBunBinary, IMMUTABLE_ASSET_ROOT, PROJECT_ROOT, RUNTIME_BIN_DIR, RUNTIME_DIR, RUNTIME_TOOLS_DIR } from '~/utils/runtime-paths'
import { ensureRuntimeDirectory, ensureRuntimeStateDirectories, getRuntimeCachePath } from '~/utils/runtime-state'
import { assertManagedRuntimePath, pathIsPhysicallyWithinRoot } from '~/utils/runtime-containment'
import { SUPPORTED_BUN_VERSION } from '~/utils/bun-version'
import { readBoundedTextStream } from '~/utils/bounded-capture'
import { downloadFile } from './download'
import { createManagedToolStagingDirectory, promoteManagedToolDirectory, recoverManagedToolDirectory } from './managed-artifact'
import { assertManagedDynamicLibraryClosure } from './managed-artifact-closure'
import { logSetupToolStatus } from '../setup-logging'

export const MANAGED_DENO_VERSION = '2.9.8'
export const MANAGED_ALIGNMENT_RUNTIME_VERSION = '1.29.0'
export const managedAlignmentRuntimeDir = (projectRoot = PROJECT_ROOT): string => join(projectRoot, 'runtime/tools/stt-alignment')

const frozenFiles = ['package.json', 'bun.lock', 'bunfig.toml'] as const
const packageManifestName = '.autoshow-package.json'

const packagePath = (root: string, path: string): string => {
  if (!pathIsPhysicallyWithinRoot(root, path)) throw InfraError('Managed package paths must resolve inside their installation directory', { stage: 'setup:js-package' })
  return path
}

const packagePayload = async (root: string): Promise<Array<{ path: string, kind: string, mode: number, sha256?: string, target?: string }>> => {
  const payload: Array<{ path: string, kind: string, mode: number, sha256?: string, target?: string }> = []
  const walk = async (directory: string): Promise<void> => {
    packagePath(root, directory)
    for (const name of (await readdir(directory)).sort()) {
      if (name === '.DS_Store' || directory === root && name === packageManifestName) continue
      const path = join(directory, name)
      const info = await lstat(path)
      const entry = { path: relative(root, path).replaceAll('\\', '/'), mode: info.mode & 0o777 }
      if (info.isDirectory()) {
        packagePath(root, path)
        payload.push({ ...entry, kind: 'directory' })
        await walk(path)
      } else if (info.isSymbolicLink()) {
        const target = await readlink(path)
        const resolved = relative(await realpath(root), await realpath(path))
        if (isAbsolute(target) || resolved === '..' || resolved.startsWith('../') || isAbsolute(resolved)) throw InfraError(`Managed package symlink escapes its installation: ${entry.path}`, { stage: 'setup:js-package' })
        payload.push({ ...entry, kind: 'symlink', target })
      } else if (info.isFile()) {
        packagePath(root, path)
        payload.push({ ...entry, kind: 'file', sha256: new Bun.CryptoHasher('sha256').update(await Bun.file(path).arrayBuffer()).digest('hex') })
      } else throw InfraError(`Unsupported managed package entry: ${entry.path}`, { stage: 'setup:js-package' })
    }
  }
  await walk(root)
  return payload
}

export const writeManagedPackageManifest = async (root: string, identity: string): Promise<void> => {
  const destination = packagePath(root, join(root, packageManifestName))
  const payload = await packagePayload(root)
  await Bun.write(packagePath(root, destination), `${JSON.stringify({ schemaVersion: 1, identity, payload })}\n`)
}

export const validateManagedPackageManifest = async (root: string, identity: string): Promise<boolean> => {
  try {
    const manifest = await Bun.file(packagePath(root, join(root, packageManifestName))).json()
    return manifest.schemaVersion === 1 && manifest.identity === identity && JSON.stringify(manifest.payload) === JSON.stringify(await packagePayload(root))
  } catch { return false }
}
const runtimePins = {
  bun: {
    version: SUPPORTED_BUN_VERSION,
    'darwin-arm64': ['bun-darwin-aarch64', '90987a3a16d7db556d886ac3d551e7b6d3edf0a1cf43acaed622e8676be1d12f'],
    'darwin-x64': ['bun-darwin-x64', '80520d7e17526308c9185d261679ac6d27798d3803a0e9f7ff9121ab8affb012'],
    'linux-arm64': ['bun-linux-aarch64', '54328bbc2d9c8e0c9f892c544d66c57a83b84139e34909e5ee81758f1ac8fda7'],
    'linux-x64': ['bun-linux-x64', '36368faef7527875d5ffa52e53cd48021741f2a83eb6208a8dd64068d422a913']
  },
  deno: {
    version: MANAGED_DENO_VERSION,
    'darwin-arm64': ['deno-aarch64-apple-darwin', '9f0bf660393da2eaff044cdc7444cb08c73f235849b61d224d825a194ce7c98e'],
    'darwin-x64': ['deno-x86_64-apple-darwin', '4b2f5edd2639b7470f034238b321d7002d8dfb4726d8558f52c17afac370eb2c'],
    'linux-arm64': ['deno-aarch64-unknown-linux-gnu', 'd49596c20b9788cf8f5d8ddf644103d4bde56ed239753f0bdb92ba9361d51905'],
    'linux-x64': ['deno-x86_64-unknown-linux-gnu', 'e890975bc2549807bbcc0b584ffafda72cc7c93349dd99c80483dd784f6c4609']
  }
} as const

const runtimeImageSources = {
  bun: 'oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61',
  deno: 'denoland/deno:bin-2.9.8@sha256:b507583d3c68ba69f3ed2ce5969ae5b8b70f43421c781279c7aea06435263543'
} as const

export const readManagedJsRuntimeSources = (): Array<{ name: 'bun' | 'deno', version: string, url: string, sha256: string }> =>
  (['bun', 'deno'] as const).map(name => {
    const pin = runtimePins[name]
    const platform = `${process.platform}-${process.arch}` as keyof Omit<typeof pin, 'version'>
    const entry = pin[platform]
    if (!entry) throw InfraError(`Managed ${name} is unavailable for ${platform}`, { stage: 'setup:js-runtime' })
    const [asset, sha256] = entry
    return { name, version: pin.version, sha256, url: name === 'bun'
      ? `https://github.com/oven-sh/bun/releases/download/bun-v${pin.version}/${asset}.zip`
      : `https://github.com/denoland/deno/releases/download/v${pin.version}/${asset}.zip` }
  })

const readVersion = async (binary: string): Promise<string | undefined> => {
  try {
    const process = Bun.spawn([binary, '--version'], { cwd: dirname(binary), env: childEnv(), stdout: 'pipe', stderr: 'pipe', signal: AbortSignal.timeout(10_000) })
    const [status, output] = await Promise.all([process.exited, readBoundedTextStream(process.stdout), readBoundedTextStream(process.stderr)])
    return status === 0 && !output.truncated ? output.text.trim().split(/\s+/)[binary.endsWith('deno') ? 1 : 0] : undefined
  } catch { return undefined }
}

/** Extract only the named executable from a checksum-verified ZIP; never execute an archive extraction tool. */
export const readManagedZipExecutable = (archive: Uint8Array, member: string): Uint8Array => {
  const bytes = Buffer.from(archive)
  if (bytes.length < 22) throw InfraError('Managed executable ZIP is truncated', { stage: 'setup:js-runtime' })
  let end = bytes.length - 22
  const minimum = Math.max(0, bytes.length - 65_557)
  while (end >= minimum && bytes.readUInt32LE(end) !== 0x06054b50) end -= 1
  if (end < minimum || end + 22 + bytes.readUInt16LE(end + 20) !== bytes.length) throw InfraError('Managed executable ZIP has no valid central directory', { stage: 'setup:js-runtime' })
  const entries = bytes.readUInt16LE(end + 10)
  const centralOffset = bytes.readUInt32LE(end + 16)
  let cursor = centralOffset
  let selected: Uint8Array | undefined
  for (let index = 0; index < entries; index += 1) {
    if (cursor + 46 > end || bytes.readUInt32LE(cursor) !== 0x02014b50) throw InfraError('Managed executable ZIP has an invalid directory', { stage: 'setup:js-runtime' })
    const nameLength = bytes.readUInt16LE(cursor + 28)
    const extraLength = bytes.readUInt16LE(cursor + 30)
    const commentLength = bytes.readUInt16LE(cursor + 32)
    const next = cursor + 46 + nameLength + extraLength + commentLength
    if (next > end) throw InfraError('Managed executable ZIP directory is truncated', { stage: 'setup:js-runtime' })
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8')
    if (name === member) {
      if (selected) throw InfraError('Managed executable ZIP repeats its executable', { stage: 'setup:js-runtime' })
      const flags = bytes.readUInt16LE(cursor + 8)
      const method = bytes.readUInt16LE(cursor + 10)
      const compressedSize = bytes.readUInt32LE(cursor + 20)
      const size = bytes.readUInt32LE(cursor + 24)
      const offset = bytes.readUInt32LE(cursor + 42)
      const mode = bytes.readUInt32LE(cursor + 38) >>> 16
      if ((flags & 1) !== 0 || (mode & 0o170000) === 0o120000 || size === 0 || size > 512 * 1024 * 1024 || offset + 30 > centralOffset || bytes.readUInt32LE(offset) !== 0x04034b50) throw InfraError('Managed executable ZIP has an unsupported executable entry', { stage: 'setup:js-runtime' })
      const localNameLength = bytes.readUInt16LE(offset + 26)
      const localExtraLength = bytes.readUInt16LE(offset + 28)
      const start = offset + 30 + localNameLength + localExtraLength
      if (start + compressedSize > centralOffset || bytes.subarray(offset + 30, offset + 30 + localNameLength).toString('utf8') !== member) throw InfraError('Managed executable ZIP entry is truncated or inconsistent', { stage: 'setup:js-runtime' })
      const compressed = bytes.subarray(start, start + compressedSize)
      const executable = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed, { maxOutputLength: size }) : undefined
      if (!executable || executable.length !== size) throw InfraError('Managed executable ZIP has an invalid executable size or compression', { stage: 'setup:js-runtime' })
      selected = executable
    }
    cursor = next
  }
  if (!selected) throw InfraError(`Managed executable ZIP is missing ${member}`, { stage: 'setup:js-runtime' })
  return selected
}

const installRuntimeShim = async (name: 'bun' | 'deno', destination: string, binDir = RUNTIME_BIN_DIR, runtimeRoot = RUNTIME_DIR): Promise<void> => {
  packagePath(runtimeRoot, destination)
  packagePath(runtimeRoot, binDir)
  await mkdir(binDir, { recursive: true })
  packagePath(runtimeRoot, binDir)
  const shim = packagePath(runtimeRoot, join(binDir, name))
  const target = relative(binDir, join(destination, 'bin', name))
  const existing = await lstat(shim).catch(error => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  })
  if (existing?.isSymbolicLink() && await readlink(shim) === target) return
  const temporary = packagePath(runtimeRoot, `${shim}.new-${crypto.randomUUID()}`)
  try {
    packagePath(runtimeRoot, join(destination, 'bin', name))
    packagePath(runtimeRoot, temporary)
    await symlink(target, temporary)
    await rename(packagePath(runtimeRoot, temporary), packagePath(runtimeRoot, shim))
  } finally { await rm(packagePath(runtimeRoot, temporary), { force: true }) }
}

/** Record binaries copied by the Docker build from the repository's exact approved image digests. */
export const recordManagedJsRuntimeImageSource = async (name: 'bun' | 'deno', imageReference: string, options: { runtimeRoot?: string } = {}): Promise<void> => {
  if (process.platform !== 'linux' || imageReference !== runtimeImageSources[name]) throw InfraError(`Unrecognized managed ${name} container source`, { stage: 'setup:js-runtime' })
  const root = options.runtimeRoot ?? RUNTIME_DIR
  const destination = packagePath(root, join(root, 'tools', name))
  const binary = packagePath(root, join(destination, 'bin', name))
  const version = runtimePins[name].version
  const canonicalRoot = await realpath(root)
  const binaryInfo = await lstat(binary)
  const binaryRelative = relative(canonicalRoot, await realpath(binary))
  if (!binaryInfo.isFile() || binaryRelative === '..' || binaryRelative.startsWith('../') || isAbsolute(binaryRelative)) throw InfraError(`Copied managed ${name} escapes its runtime installation`, { stage: 'setup:js-runtime' })
  await chmod(packagePath(root, binary), 0o755)
  if (await readVersion(binary) !== version) throw InfraError(`Copied managed ${name} differs from its pinned version`, { stage: 'setup:js-runtime' })
  const binarySha256 = new Bun.CryptoHasher('sha256').update(await Bun.file(binary).arrayBuffer()).digest('hex')
  await Bun.write(packagePath(root, join(destination, '.autoshow-runtime.json')), `${JSON.stringify({ schemaVersion: 1, name, version, platform: `${process.platform}-${process.arch}`, sourceKind: 'container-image', imageReference, mode: 0o755, binarySha256 })}\n`)
  await installRuntimeShim(name, destination, join(root, 'bin'), root)
}

export const validateManagedJsRuntime = async (name: 'bun' | 'deno'): Promise<{ ok: boolean, detail: string }> => {
  try {
    const source = readManagedJsRuntimeSources().find(entry => entry.name === name)!
    const destination = assertRuntimeContainedPath(join(RUNTIME_TOOLS_DIR, name))
    const binary = assertRuntimeContainedPath(join(destination, 'bin', name))
    const marker = assertRuntimeContainedPath(join(destination, '.autoshow-runtime.json'))
    const saved = await Bun.file(marker).json() as Record<string, unknown>
    const info = await lstat(binary)
    const archiveSource = saved['sourceKind'] === 'archive' && saved['archiveSha256'] === source.sha256 && saved['sourceUrl'] === source.url
    const imageSource = process.platform === 'linux' && saved['sourceKind'] === 'container-image' && saved['imageReference'] === runtimeImageSources[name]
    const valid = saved['schemaVersion'] === 1 && saved['name'] === name && saved['version'] === source.version
      && saved['platform'] === `${process.platform}-${process.arch}` && (archiveSource || imageSource)
      && info.isFile() && (info.mode & 0o777) === 0o755 && saved['mode'] === 0o755
      && saved['binarySha256'] === new Bun.CryptoHasher('sha256').update(await Bun.file(binary).arrayBuffer()).digest('hex')
    return { ok: valid, detail: valid ? `${name}@${source.version}; source, executable hash and permissions verified` : `Managed ${name} source receipt or executable integrity is invalid` }
  } catch (error) { return { ok: false, detail: error instanceof Error ? error.message : String(error) } }
}

const ensureManagedJsRuntime = async (name: 'bun' | 'deno', options: { forceRedownload?: boolean } = {}): Promise<void> => withProcessLock(`setup-managed-${name}`, async () => {
  const pin = runtimePins[name]
  const platform = `${process.platform}-${process.arch}` as keyof Omit<typeof pin, 'version'>
  const entry = pin[platform]
  if (!entry) throw InfraError(`Managed ${name} is unavailable for ${platform}`, { stage: 'setup:js-runtime' })
  const [asset, sha256] = entry
  const destination = join(RUNTIME_TOOLS_DIR, name)
  const binary = join(destination, 'bin', name)
  const identity = { schemaVersion: 1, name, version: pin.version, platform, archiveSha256: sha256 }
  assertRuntimeContainedPath(destination)
  await ensureRuntimeDirectory(dirname(destination))
  await recoverManagedToolDirectory(destination)
  if (!options.forceRedownload && (await validateManagedJsRuntime(name)).ok) {
    if (process.platform === 'darwin') await assertManagedDynamicLibraryClosure([binary])
    if (await readVersion(binary) === pin.version) {
      await installRuntimeShim(name, destination)
      return
    }
  }
  await ensureRuntimeStateDirectories()
  await ensureRuntimeDirectory(dirname(destination))
  const archive = getRuntimeCachePath('downloads', `${asset}-${pin.version}.zip`)
  assertRuntimeContainedPath(archive)
  const url = name === 'bun'
    ? `https://github.com/oven-sh/bun/releases/download/bun-v${pin.version}/${asset}.zip`
    : `https://github.com/denoland/deno/releases/download/v${pin.version}/${asset}.zip`
  const cached = await pathExists(archive) && new Bun.CryptoHasher('sha256').update(await Bun.file(archive).arrayBuffer()).digest('hex') === sha256
  logSetupToolStatus({ tool: name, status: 'installing', detail: `${name}@${pin.version}` })
  await ensureRuntimeDirectory(dirname(archive))
  if (options.forceRedownload || !cached) await downloadFile({ url, sha256, destination: assertManagedRuntimePath(archive) })
  const staging = await createManagedToolStagingDirectory(destination)
  let installed = false
  try {
    await ensureRuntimeDirectory(join(staging, 'bin'))
    await Bun.write(assertManagedRuntimePath(join(staging, 'bin', name)), readManagedZipExecutable(await Bun.file(assertManagedRuntimePath(archive)).bytes(), name === 'bun' ? `${asset}/bun` : 'deno'))
    await chmod(assertManagedRuntimePath(join(staging, 'bin', name)), 0o755)
    const binarySha256 = new Bun.CryptoHasher('sha256').update(await Bun.file(join(staging, 'bin', name)).arrayBuffer()).digest('hex')
    await Bun.write(assertManagedRuntimePath(join(staging, '.autoshow-runtime.json')), `${JSON.stringify({ ...identity, binarySha256, mode: 0o755, sourceKind: 'archive', sourceUrl: url })}\n`)
    const validate = async (root: string): Promise<void> => {
      assertRuntimeContainedPath(root)
      assertRuntimeContainedPath(join(root, 'bin', name))
      if (new Bun.CryptoHasher('sha256').update(await Bun.file(join(root, 'bin', name)).arrayBuffer()).digest('hex') !== binarySha256) throw InfraError(`Managed ${name} executable integrity changed`, { stage: 'setup:js-runtime' })
      if (process.platform === 'darwin') await assertManagedDynamicLibraryClosure([join(root, 'bin', name)])
      if (await readVersion(join(root, 'bin', name)) !== pin.version) throw InfraError(`Managed ${name} failed its pinned version check`, { stage: 'setup:js-runtime' })
    }
    await promoteManagedToolDirectory({ stagingDir: staging, destinationDir: destination, validateStaging: validate, activate: async () => await installRuntimeShim(name, destination), rollbackActivation: async hadPrevious => { if (hadPrevious) await installRuntimeShim(name, destination) } })
    installed = true
  } finally { if (installed) await rm(assertManagedRuntimePath(staging), { recursive: true, force: true }) }
})

export const ensureManagedBunRuntime = async (options: { forceRedownload?: boolean } = {}): Promise<void> => await ensureManagedJsRuntime('bun', options)
export const ensureManagedDenoRuntime = async (options: { forceRedownload?: boolean } = {}): Promise<void> => await ensureManagedJsRuntime('deno', options)

export const hasFrozenAlignmentRuntime = async (destination = managedAlignmentRuntimeDir()): Promise<boolean> => {
  try {
    for (const name of frozenFiles) if (await Bun.file(packagePath(destination, join(destination, name))).text() !== await Bun.file(join(IMMUTABLE_ASSET_ROOT, 'config/stt-alignment', name)).text()) return false
    return (await Bun.file(packagePath(destination, join(destination, 'node_modules/onnxruntime-node/package.json'))).json() as { version: string }).version === MANAGED_ALIGNMENT_RUNTIME_VERSION
      && await Bun.file(packagePath(destination, join(destination, '.frozen-install'))).text() === `${MANAGED_ALIGNMENT_RUNTIME_VERSION}\n`
      && await validateManagedPackageManifest(destination, `onnxruntime-node@${MANAGED_ALIGNMENT_RUNTIME_VERSION}`)
  } catch { return false }
}

export const validateManagedAlignmentRuntime = async (): Promise<{ ok: boolean, detail: string }> => {
  try {
    const root = assertRuntimeContainedPath(managedAlignmentRuntimeDir())
    const valid = await hasFrozenAlignmentRuntime(root)
    return { ok: valid, detail: valid ? `onnxruntime-node@${MANAGED_ALIGNMENT_RUNTIME_VERSION}; frozen graph and complete payload verified` : 'Managed alignment frozen graph or payload integrity is invalid' }
  } catch (error) { return { ok: false, detail: error instanceof Error ? error.message : String(error) } }
}

export const ensureManagedAlignmentRuntime = async (options: { forceRedownload?: boolean } = {}): Promise<void> => withProcessLock('setup-managed-alignment', async () => {
  const destination = managedAlignmentRuntimeDir()
  assertRuntimeContainedPath(destination)
  await ensureRuntimeDirectory(dirname(destination))
  await recoverManagedToolDirectory(destination)
  if (!options.forceRedownload && await hasFrozenAlignmentRuntime(destination)) return
  await ensureManagedBunRuntime()
  await ensureRuntimeDirectory(dirname(destination))
  const staging = await createManagedToolStagingDirectory(destination)
  let installed = false
  try {
    for (const name of frozenFiles) await Bun.write(assertManagedRuntimePath(join(staging, name)), await readFile(join(IMMUTABLE_ASSET_ROOT, 'config/stt-alignment', name)))
    assertManagedRuntimePath(staging)
    if (!(await validateManagedJsRuntime('bun')).ok) throw InfraError('Managed Bun integrity changed before alignment package installation', { stage: 'setup:alignment' })
    const install = Bun.spawn([getBunBinary(), '--no-env-file', 'install', '--frozen-lockfile', '--ignore-scripts'], { cwd: staging, env: childEnv(), stdout: 'pipe', stderr: 'pipe', signal: AbortSignal.timeout(15 * 60_000) })
    const [status, stdout, stderr] = await Promise.all([install.exited, readBoundedTextStream(install.stdout), readBoundedTextStream(install.stderr)])
    if (status !== 0) throw InfraError(`Managed alignment dependency install failed: ${stderr.text || stdout.text}`, { stage: 'setup:alignment' })
    await Bun.write(assertManagedRuntimePath(join(staging, '.frozen-install')), `${MANAGED_ALIGNMENT_RUNTIME_VERSION}\n`)
    await writeManagedPackageManifest(staging, `onnxruntime-node@${MANAGED_ALIGNMENT_RUNTIME_VERSION}`)
    await promoteManagedToolDirectory({ stagingDir: staging, destinationDir: destination, validateStaging: async root => {
      if (!await hasFrozenAlignmentRuntime(root)) throw InfraError('Managed alignment dependency graph failed verification', { stage: 'setup:alignment' })
      if (process.platform === 'darwin') {
        const nativeRoot = join(root, 'node_modules/onnxruntime-node/bin/napi-v6', process.platform, process.arch)
        const binaries = (await readdir(nativeRoot)).filter(name => /\.(?:node|dylib)$/.test(name)).map(name => join(nativeRoot, name))
        if (binaries.length === 0) throw InfraError('Managed alignment graph has no target-native binaries', { stage: 'setup:alignment' })
        await assertManagedDynamicLibraryClosure(binaries)
      }
      if (!(await validateManagedJsRuntime('bun')).ok) throw InfraError('Managed Bun integrity changed before alignment validation', { stage: 'setup:alignment' })
      const probe = Bun.spawn([getBunBinary(), '--no-env-file', '-e', 'const {createRequire}=require("node:module");const r=createRequire(process.cwd()+"/package.json");const o=r("onnxruntime-node");if(!o.InferenceSession||!o.Tensor)process.exit(1)'], { cwd: assertManagedRuntimePath(root), env: childEnv(), stdout: 'pipe', stderr: 'pipe', signal: AbortSignal.timeout(30_000) })
      const [probeCode, , probeError] = await Promise.all([probe.exited, readBoundedTextStream(probe.stdout), readBoundedTextStream(probe.stderr)])
      if (probeCode !== 0) throw InfraError(`Managed alignment native backend failed loading: ${probeError.text}`, { stage: 'setup:alignment' })
    } })
    installed = true
  } finally { if (installed) await rm(assertManagedRuntimePath(staging), { recursive: true, force: true }) }
})
