import { constants, existsSync, realpathSync, statSync } from 'node:fs'
import { access, chmod, mkdir, readFile, stat, symlink, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, posix, relative, resolve } from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { childEnv } from '~/utils/child-env'
import { AppError, InfraError, ValidationError } from '~/utils/error-handler'
import { withProcessLock } from '~/utils/process-lock'
import { readBoundedTextStream } from '~/utils/bounded-capture'
import { RUNTIME_DIR, RUNTIME_TOOLS_DIR, assertRuntimeContainedPath } from '~/utils/runtime-paths'
import { getRuntimeCachePath } from '~/utils/runtime-state'
import { downloadFile } from '~/cli/commands/setup-and-utilities/setup/setup-download/download'
import { createManagedToolStagingDirectory, promoteManagedToolDirectory } from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact'
import { collectManagedSourcePayload, managedSourcePayloadIssue } from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact-payload'
import type { ManagedSourcePayloadFile } from '~/types'

// Official stable channel snapshot: https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json
// The archive checksum pins the upstream bytes reviewed for this optional maintenance tool.
export const FIXTURE_BROWSER_ARTIFACT = {
  version: '157.0.8103.78',
  platform: 'darwin',
  architecture: 'arm64',
  url: 'https://storage.googleapis.com/chrome-for-testing-public/157.0.8103.78/mac-arm64/chrome-mac-arm64.zip',
  sha256: 'bf3b49d0fe62a62397e98641aa736ef813c46014f03ec13d4913442e6966c7fc',
  executable: 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
} as const

const TOOL_DIR = join(RUNTIME_TOOLS_DIR, 'fixture-browser')
const RECEIPT_NAME = '.autoshow-managed-artifact.json'
const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024
const MAX_EXTRACTED_BYTES = 2 * 1024 * 1024 * 1024
const MAX_MEMBER_BYTES = 1024 * 1024 * 1024
const MAX_ENTRIES = 10_000

type BrowserReceipt = {
  schemaVersion: 1
  tool: 'fixture-browser'
  distribution: 'upstream-prebuilt'
  source: typeof FIXTURE_BROWSER_ARTIFACT
  payload: ManagedSourcePayloadFile[]
}

type BrowserArchiveEntry = {
  path: string
  mode: number
  kind: 'directory' | 'file' | 'symlink'
  data: Buffer
}

const invalidArchive = (detail: string): never => {
  throw ValidationError(`Invalid fixture-browser archive: ${detail}`, { stage: 'setup:fixture-browser' })
}

const contained = (root: string, path: string): boolean => {
  const rel = relative(resolve(root), resolve(path))
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('../'))
}

const safeArchivePath = (name: string): string => {
  const path = name.endsWith('/') ? name.slice(0, -1) : name
  if (!path || path.includes('\\') || path.includes('\0') || posix.isAbsolute(path)
    || path.split('/').some(part => !part || part === '.' || part === '..')
    || /^[A-Za-z]:/.test(path)) invalidArchive('unsafe member path')
  return path
}

/** Decode and validate the entire ZIP before writing any member or following a link. */
export const readFixtureBrowserArchive = (bytes: Buffer): BrowserArchiveEntry[] => {
  if (bytes.length > MAX_ARCHIVE_BYTES || bytes.length < 22) invalidArchive('unsupported size')
  let end = bytes.length - 22
  const minimum = Math.max(0, bytes.length - 65_557)
  while (end >= minimum && (bytes.readUInt32LE(end) !== 0x06054b50 || end + 22 + bytes.readUInt16LE(end + 20) !== bytes.length)) end--
  if (end < minimum || bytes.readUInt32LE(end + 4) !== 0) invalidArchive('missing or split central directory')
  const count = bytes.readUInt16LE(end + 10)
  const centralBytes = bytes.readUInt32LE(end + 12)
  const centralOffset = bytes.readUInt32LE(end + 16)
  if (!count || count >= MAX_ENTRIES || count !== bytes.readUInt16LE(end + 8) || centralOffset + centralBytes !== end) invalidArchive('invalid central directory')
  let cursor = centralOffset
  let expandedBytes = 0
  const entries: BrowserArchiveEntry[] = []
  const names = new Set<string>()
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || bytes.readUInt32LE(cursor) !== 0x02014b50) invalidArchive('invalid member header')
    const flags = bytes.readUInt16LE(cursor + 8)
    const method = bytes.readUInt16LE(cursor + 10)
    const crc = bytes.readUInt32LE(cursor + 16)
    const compressed = bytes.readUInt32LE(cursor + 20)
    const size = bytes.readUInt32LE(cursor + 24)
    const nameBytes = bytes.readUInt16LE(cursor + 28)
    const extraBytes = bytes.readUInt16LE(cursor + 30)
    const commentBytes = bytes.readUInt16LE(cursor + 32)
    const localOffset = bytes.readUInt32LE(cursor + 42)
    if (cursor + 46 + nameBytes + extraBytes + commentBytes > end || flags & 1 || ![0, 8].includes(method)) invalidArchive('unsupported member encoding')
    const name = bytes.toString('utf8', cursor + 46, cursor + 46 + nameBytes)
    cursor += 46 + nameBytes + extraBytes + commentBytes
    // Finder metadata is outside the fixture browser payload and is never inspected.
    if (name.split('/').includes('.DS_Store')) continue
    const path = safeArchivePath(name)
    if (names.has(path)) invalidArchive('duplicate member')
    names.add(path)
    const mode = bytes.readUInt32LE(cursor - (46 + nameBytes + extraBytes + commentBytes) + 38) >>> 16
    const type = mode & 0o170000
    if (![0, 0o040000, 0o100000, 0o120000].includes(type)) invalidArchive('unsupported member type')
    const kind = type === 0o120000 ? 'symlink' : name.endsWith('/') || type === 0o040000 ? 'directory' : 'file'
    if (size > MAX_MEMBER_BYTES || (expandedBytes += size) > MAX_EXTRACTED_BYTES) invalidArchive('expanded-size limit exceeded')
    if (localOffset + 30 > centralOffset || bytes.readUInt32LE(localOffset) !== 0x04034b50) invalidArchive('invalid local member')
    const localNameLength = bytes.readUInt16LE(localOffset + 26)
    const dataOffset = localOffset + 30 + localNameLength + bytes.readUInt16LE(localOffset + 28)
    if (bytes.readUInt16LE(localOffset + 6) !== flags || bytes.readUInt16LE(localOffset + 8) !== method
      || bytes.toString('utf8', localOffset + 30, localOffset + 30 + localNameLength) !== name
      || dataOffset + compressed > centralOffset) invalidArchive('local member does not match directory')
    const packed = bytes.subarray(dataOffset, dataOffset + compressed)
    const data = method === 0 ? Buffer.from(packed) : inflateRawSync(packed, { maxOutputLength: Math.max(1, size) })
    if (data.length !== size || Bun.hash.crc32(data) !== crc) invalidArchive('member integrity mismatch')
    if (kind === 'directory' && data.length) invalidArchive('directory has content')
    if (kind === 'symlink') {
      const target = data.toString('utf8')
      const resolved = posix.normalize(posix.join(posix.dirname(path), target))
      if (!target || target.includes('\\') || target.includes('\0') || posix.isAbsolute(target)
        || resolved === '..' || resolved.startsWith('../')) invalidArchive('symlink escapes package')
    }
    entries.push({ path, kind, mode: mode & 0o777, data })
  }
  if (cursor !== end) invalidArchive('central-directory length mismatch')
  const links = new Set(entries.filter(entry => entry.kind === 'symlink').map(entry => entry.path))
  for (const entry of entries) {
    const components = entry.path.split('/')
    for (let i = 1; i < components.length; i++) if (links.has(components.slice(0, i).join('/'))) invalidArchive('member parent is a symlink')
  }
  return entries
}

export const extractFixtureBrowserArchive = async (archivePath: string, destination: string): Promise<void> => {
  assertRuntimeContainedPath(archivePath)
  assertRuntimeContainedPath(destination)
  const archive = await stat(archivePath)
  if (!archive.isFile() || archive.size > MAX_ARCHIVE_BYTES) invalidArchive('unsupported archive file')
  const entries = readFixtureBrowserArchive(await readFile(archivePath))
  for (const entry of entries.filter(entry => entry.kind !== 'symlink')) {
    const target = join(destination, entry.path)
    await mkdir(entry.kind === 'directory' ? target : dirname(target), { recursive: true })
    if (entry.kind === 'file') {
      await writeFile(target, entry.data, { flag: 'wx', mode: entry.mode || 0o644 })
      await chmod(target, entry.mode || 0o644)
    }
    if (entry.kind === 'directory') await chmod(target, entry.mode || 0o755)
  }
  for (const entry of entries.filter(entry => entry.kind === 'symlink')) {
    await mkdir(dirname(join(destination, entry.path)), { recursive: true })
    await symlink(entry.data.toString('utf8'), join(destination, entry.path))
  }
  // This verifies link chains, including links whose individual targets are relative.
  await collectManagedSourcePayload(destination)
}

export const fixtureBrowserArtifactFor = (platform = process.platform, architecture = process.arch): typeof FIXTURE_BROWSER_ARTIFACT => {
  if (platform !== FIXTURE_BROWSER_ARTIFACT.platform || architecture !== FIXTURE_BROWSER_ARTIFACT.architecture) {
    throw InfraError('Automatic fixture-browser provisioning supports macOS ARM64. Provide an executable inside runtime/ through AUTOSHOW_FIXTURE_BROWSER on other platforms.', { stage: 'setup:fixture-browser' })
  }
  return FIXTURE_BROWSER_ARTIFACT
}

export const resolveRuntimeFixtureBrowser = (explicit = process.env['AUTOSHOW_FIXTURE_BROWSER']): string | undefined => {
  const candidate = explicit?.trim() || join(TOOL_DIR, FIXTURE_BROWSER_ARTIFACT.executable)
  const path = assertRuntimeContainedPath(candidate)
  if (!existsSync(path)) return undefined
  const physical = realpathSync(path)
  if (!contained(realpathSync(RUNTIME_DIR), physical) || !statSync(physical).isFile()) throw ValidationError('The fixture browser must be a regular executable inside runtime/.', { stage: 'setup:fixture-browser' })
  return path
}

export const writeFixtureBrowserReceipt = async (directory: string): Promise<void> => {
  assertRuntimeContainedPath(directory)
  const receipt: BrowserReceipt = {
    schemaVersion: 1, tool: 'fixture-browser', distribution: 'upstream-prebuilt',
    source: FIXTURE_BROWSER_ARTIFACT, payload: await collectManagedSourcePayload(directory)
  }
  await writeFile(join(directory, RECEIPT_NAME), `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 })
}

const probeBrowser = async (executable: string): Promise<void> => {
  await access(executable, constants.X_OK)
  const child = Bun.spawn([executable, '--version'], { env: childEnv(), stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' })
  const timer = setTimeout(() => child.kill('SIGTERM'), 20_000)
  try {
    const [stdout, stderr, code] = await Promise.all([readBoundedTextStream(child.stdout), readBoundedTextStream(child.stderr), child.exited])
    if (code !== 0 || !`${stdout.text}\n${stderr.text}`.includes(FIXTURE_BROWSER_ARTIFACT.version)) throw InfraError('The managed fixture browser failed its pinned-version health check.', { stage: 'setup:fixture-browser' })
  } finally { clearTimeout(timer) }
}

/** Ask the operating system for its existing trust decision without starting the app. */
export const assessFixtureBrowserExecutable = async (executable: string): Promise<void> => {
  assertRuntimeContainedPath(executable)
  if (process.platform !== 'darwin') return
  const bundleEnd = executable.indexOf('.app/')
  const bundle = bundleEnd === -1 ? executable : executable.slice(0, bundleEnd + 4)
  for (const [command, args] of [
    ['/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle]],
    ['/usr/sbin/spctl', ['--assess', '--type', 'execute', '--verbose=2', bundle]]
  ] as const) {
    const child = Bun.spawn([command, ...args], { env: childEnv(), stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' })
    const timer = setTimeout(() => child.kill('SIGTERM'), 20_000)
    try {
      const [stdout, stderr, code] = await Promise.all([readBoundedTextStream(child.stdout), readBoundedTextStream(child.stderr), child.exited])
      if (code !== 0) throw InfraError(`macOS did not approve the fixture browser; it was not launched. ${stderr.text.trim() || stdout.text.trim()}`, {
        stage: 'setup:fixture-browser-trust', hints: ['Use an operating-system-approved browser executable installed inside runtime/. No security bypass is performed.']
      })
    } finally { clearTimeout(timer) }
  }
}

export const verifyFixtureBrowserInstallation = async (directory: string, checks: {
  assess?: ((executable: string) => Promise<void>) | undefined
  probe?: ((executable: string) => Promise<void>) | undefined
} = {}): Promise<void> => {
  assertRuntimeContainedPath(directory)
  const receipt = JSON.parse(await Bun.file(join(directory, RECEIPT_NAME)).text()) as BrowserReceipt
  if (receipt.schemaVersion !== 1 || receipt.tool !== 'fixture-browser' || receipt.distribution !== 'upstream-prebuilt'
    || JSON.stringify(receipt.source) !== JSON.stringify(FIXTURE_BROWSER_ARTIFACT) || !Array.isArray(receipt.payload)) {
    throw ValidationError('The fixture-browser installation has an incompatible receipt.', { stage: 'setup:fixture-browser' })
  }
  const issue = managedSourcePayloadIssue(receipt.payload, await collectManagedSourcePayload(directory))
  if (issue) throw ValidationError(`The fixture-browser installation failed integrity validation: ${issue}`, { stage: 'setup:fixture-browser' })
  const executable = join(directory, FIXTURE_BROWSER_ARTIFACT.executable)
  await (checks.assess ?? assessFixtureBrowserExecutable)(executable)
  await (checks.probe ?? probeBrowser)(executable)
}

/** Optional maintenance dependency: never installed by the default CLI setup. */
export const ensureManagedFixtureBrowser = async (): Promise<string> => {
  const explicit = process.env['AUTOSHOW_FIXTURE_BROWSER']?.trim()
  if (explicit) {
    const resolved = resolveRuntimeFixtureBrowser(explicit)
    if (!resolved) throw InfraError('AUTOSHOW_FIXTURE_BROWSER does not name an installed runtime executable.', { stage: 'setup:fixture-browser' })
    await access(resolved, constants.X_OK)
    await assessFixtureBrowserExecutable(resolved)
    return resolved
  }
  const artifact = fixtureBrowserArtifactFor()
  return await withProcessLock('setup-fixture-browser', async () => {
    try { await verifyFixtureBrowserInstallation(TOOL_DIR); return join(TOOL_DIR, artifact.executable) } catch (error) {
      if (error instanceof AppError && error.stage === 'setup:fixture-browser-trust') throw error
      // Repair corrupt or incomplete payloads transactionally; OS rejection is terminal.
    }
    const archive = getRuntimeCachePath('downloads', 'fixture-browser', `chrome-mac-arm64-${artifact.version}.zip`)
    await downloadFile({ url: artifact.url, sha256: artifact.sha256, destination: archive, totalTimeoutMs: 60 * 60_000 })
    await mkdir(dirname(TOOL_DIR), { recursive: true })
    const staging = await createManagedToolStagingDirectory(TOOL_DIR)
    await extractFixtureBrowserArchive(archive, staging)
    await writeFixtureBrowserReceipt(staging)
    await promoteManagedToolDirectory({ stagingDir: staging, destinationDir: TOOL_DIR, validateStaging: async directory => { await verifyFixtureBrowserInstallation(directory) } })
    return join(TOOL_DIR, artifact.executable)
  })
}
