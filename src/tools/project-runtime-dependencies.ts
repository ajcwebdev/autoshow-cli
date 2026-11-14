/** Source-checkout bootstrap. Deliberately imports no installed packages. */
import { createHash } from 'node:crypto'
import { hostname } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { lstat, mkdir, open, readFile, readdir, readlink, rename, rm, symlink, unlink } from 'node:fs/promises'
import { SOURCE_ROOT } from '../utils/project-root'
import { pathIsPhysicallyWithinRoot, pathIsWithinRoot } from '../utils/runtime-containment'

export interface ProjectDependenciesOptions {
  projectRoot?: string
  /** Active runtime addressed by the relative source lookup alias. */
  runtimeRoot?: string
  /** Build-time runtime seed, when different from the eventual active runtime. */
  storageRuntimeRoot?: string
  production?: boolean
  /** Only a trusted completed install should replace an existing integrity receipt. */
  refresh?: boolean
  onCheckpoint?: (checkpoint: 'prepared' | 'graph-moved' | 'alias-linked') => void | Promise<void>
}

export interface ProjectDependencyInstallOptions extends ProjectDependenciesOptions {
  /** Never contact a registry; fail if the private cache cannot satisfy the frozen lock. */
  offline?: boolean
  timeoutMs?: number
}

export interface ProjectDependencyEntry {
  path: string
  kind: 'directory' | 'file' | 'symlink'
  mode: number
  mtimeNs: string
  size?: string
  sha256?: string
  target?: string
}

export interface ProjectDependenciesReceipt {
  version: 1
  production: boolean
  manifests: Record<string, string>
  entries: ProjectDependencyEntry[]
}

interface Paths {
  project: string
  runtime: string
  storage: string
  graph: string
  alias: string
  aliasTarget: string
  parent: string
  receipt: string
  journal: string
}
interface Journal {
  version: 1
  pid: number
  host: string
  receipt: ProjectDependenciesReceipt
}
const MANIFESTS = ['package.json', 'bun.lock', 'bunfig.toml'] as const
const digest = (data: string | Uint8Array): string => createHash('sha256').update(data).digest('hex')
const absent = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT'
const statMaybe = async (path: string) => {
  try { return await lstat(path) } catch (error) { if (absent(error)) return undefined; throw error }
}
function fail(message: string): never { throw new Error(`Project dependency runtime: ${message}`) }
const pathsFor = (options: ProjectDependenciesOptions): Paths => {
  const project = resolve(options.projectRoot ?? SOURCE_ROOT)
  const runtime = resolve(options.runtimeRoot ?? join(project, 'runtime'))
  const storage = resolve(options.storageRuntimeRoot ?? runtime)
  const parent = join(storage, 'tools/project-dependencies')
  const graph = join(parent, 'node_modules')
  const receipt = join(parent, 'project-dependencies.json')
  const journal = join(parent, 'migration.json')
  const installation = join(parent, 'installation.json')
  const alias = join(project, 'node_modules')
  const activeGraph = join(runtime, 'tools/project-dependencies/node_modules')
  const aliasTarget = relative(project, activeGraph)
  if (!pathIsWithinRoot(project, runtime) || runtime === project || !aliasTarget || isAbsolute(aliasTarget)) {
    fail('the active runtime must be inside the source checkout.')
  }
  if (!pathIsPhysicallyWithinRoot(project, runtime) || !pathIsPhysicallyWithinRoot(storage, parent)) {
    fail('runtime storage escapes its physical runtime root through a symbolic link.')
  }
  // The selected runtime itself must not redirect the managed tree elsewhere.
  if (pathIsWithinRoot(project, storage) && !pathIsPhysicallyWithinRoot(project, storage)) {
    fail('runtime storage escapes the source checkout.')
  }
  if (![receipt, journal, installation].every(path => pathIsPhysicallyWithinRoot(storage, path))) {
    fail('a dependency control file escapes its physical runtime storage.')
  }
  return { project, runtime, storage, graph, alias, aliasTarget, parent,
    receipt, journal }
}

const manifestHashes = async (paths: Paths): Promise<Record<string, string>> => {
  const hashes: Record<string, string> = {}
  for (const name of MANIFESTS) hashes[name] = digest(await readFile(join(paths.project, name)))
  return hashes
}
const same = (first: unknown, second: unknown): boolean => JSON.stringify(first) === JSON.stringify(second)
const payload = (receipt: ProjectDependenciesReceipt) => receipt.entries.map(({ mtimeNs: _mtimeNs, ...entry }) => entry)

/** Complete payload inventory, including modes, timestamps and relative link relationships. */
export const snapshotProjectDependencyGraph = async (graph: string): Promise<ProjectDependencyEntry[]> => {
  const entries: ProjectDependencyEntry[] = []
  const visit = async (path: string, name: string): Promise<void> => {
    const info = await lstat(path, { bigint: true })
    const base = { path: name, mode: Number(info.mode & 0o7777n), mtimeNs: info.mtimeNs.toString() }
    if (info.isSymbolicLink()) {
      const target = await readlink(path)
      if (isAbsolute(target) || !pathIsPhysicallyWithinRoot(graph, resolve(dirname(path), target))) {
        fail(`installed symbolic link escapes its movable graph: ${name}`)
      }
      entries.push({ ...base, kind: 'symlink', target })
    } else if (info.isDirectory()) {
      entries.push({ ...base, kind: 'directory' })
      for (const child of (await readdir(path)).filter(child => child !== '.DS_Store').sort()) {
        await visit(join(path, child), name === '.' ? child : `${name}/${child}`)
      }
    } else if (info.isFile()) {
      entries.push({ ...base, kind: 'file', size: info.size.toString(), sha256: digest(await readFile(path)) })
    } else fail(`unsupported installed entry: ${name}`)
  }
  await visit(graph, '.')
  return entries
}

const verifyVersions = async (paths: Paths, graph: string, requestedProduction?: boolean): Promise<boolean> => {
  const manifest = JSON.parse(await readFile(join(paths.project, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>; devDependencies?: Record<string, string>
  }
  const dev = manifest.devDependencies ?? {}
  const anyDev = (await Promise.all(Object.keys(dev).map(name => statMaybe(join(graph, name))))).some(Boolean)
  const production = requestedProduction ?? !anyDev
  const expected = { ...manifest.dependencies, ...(production ? {} : dev) }
  for (const [name, version] of Object.entries(expected)) {
    if (!pathIsPhysicallyWithinRoot(graph, join(graph, name))) fail(`package escapes runtime storage: ${name}`)
    let installed: { name?: string; version?: string }
    try { installed = JSON.parse(await readFile(join(graph, name, 'package.json'), 'utf8')) as typeof installed }
    catch { fail(`missing or unreadable installed package: ${name}; run bun install --frozen-lockfile.`) }
    if (installed.name !== name || (version.match(/^\d+\.\d+\.\d+(?:[-+].+)?$/) && installed.version !== version)) {
      fail(`installed package does not match the source manifest: ${name}`)
    }
  }
  return production
}

const buildReceipt = async (paths: Paths, graph: string, production?: boolean): Promise<ProjectDependenciesReceipt> => {
  const rootInfo = await statMaybe(graph)
  if (!rootInfo?.isDirectory() || rootInfo.isSymbolicLink()) fail('installed graph must be a physical directory inside runtime storage.')
  if (graph === paths.graph && !pathIsPhysicallyWithinRoot(paths.storage, graph)) fail('installed graph escapes physical runtime storage.')
  const manifests = await manifestHashes(paths)
  const selectedProduction = await verifyVersions(paths, graph, production)
  const entries = await snapshotProjectDependencyGraph(graph)
  if (!same(manifests, await manifestHashes(paths))) fail('source manifests changed while inspecting installed packages; retry after the install finishes.')
  return { version: 1, production: selectedProduction, manifests, entries }
}
const assertReceipt = async (paths: Paths, graph: string, receipt: ProjectDependenciesReceipt, production?: boolean, preserveTimestamps = false): Promise<void> => {
  if (receipt.version !== 1 || !Array.isArray(receipt.entries) || typeof receipt.production !== 'boolean') fail('invalid installed graph receipt.')
  const actual = await buildReceipt(paths, graph, production ?? receipt.production)
  // A runtime seed may be copied across filesystems with different timestamp precision.
  // Timestamps remain evidence for rename preservation; executable readiness pins bytes, modes and links.
  const comparable = (value: ProjectDependenciesReceipt) => preserveTimestamps ? value : { ...value, entries: payload(value) }
  if (!same(comparable(receipt), comparable(actual))) fail('installed graph or source manifests differ from their receipt; complete a trusted bun install before refreshing it.')
}
const writeJson = async (path: string, value: unknown): Promise<void> => {
  const temporary = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`
  const handle = await open(temporary, 'wx', 0o600)
  try { await handle.writeFile(`${JSON.stringify(value)}\n`); await handle.sync() }
  finally { await handle.close() }
  try { await rename(temporary, path) } catch (error) { await rm(temporary, { force: true }); throw error }
}
const readReceipt = async (paths: Paths): Promise<ProjectDependenciesReceipt> => {
  try { return JSON.parse(await readFile(paths.receipt, 'utf8')) as ProjectDependenciesReceipt }
  catch { return fail('installed graph receipt is missing or invalid; run the project dependency bootstrap after a trusted install.') }
}
const assertAlias = async (paths: Paths): Promise<void> => {
  const info = await statMaybe(paths.alias)
  if (!info?.isSymbolicLink() || await readlink(paths.alias) !== paths.aliasTarget) fail('source node_modules must be the managed relative runtime lookup alias.')
  // Seed verification intentionally checks its separate physical graph; active runtime may not exist yet.
  if (paths.storage === paths.runtime && !pathIsPhysicallyWithinRoot(paths.runtime, resolve(paths.project, paths.aliasTarget))) {
    fail('the source dependency alias escapes the physical runtime directory.')
  }
}

/** Read-only readiness check: never creates directories, repairs links or refreshes receipts. */
export const validateProjectRuntimeDependencies = async (options: ProjectDependenciesOptions = {}): Promise<ProjectDependenciesReceipt> => {
  const paths = pathsFor(options)
  if (await statMaybe(installationJournalPath(paths))) fail('an unfinished frozen installation needs recovery before this graph can be used.')
  if (await statMaybe(paths.journal)) fail('an unfinished dependency migration needs recovery before this graph can be used.')
  await assertAlias(paths)
  const receipt = await readReceipt(paths)
  await assertReceipt(paths, paths.graph, receipt, options.production)
  return receipt
}

const ownerIsAlive = (journal: Journal): boolean => {
  if (journal.host !== hostname()) return true
  try { process.kill(journal.pid, 0); return true }
  catch (error) { return (error as NodeJS.ErrnoException).code !== 'ESRCH' }
}

/** Relocate by rename, then publish the relative source lookup alias. No network or package manager. */
export const ensureProjectRuntimeDependencies = async (options: ProjectDependenciesOptions = {}): Promise<ProjectDependenciesReceipt> => {
  const paths = pathsFor(options)
  await mkdir(paths.parent, { recursive: true })
  await recoverInstallation(paths)
  if (!pathIsPhysicallyWithinRoot(paths.storage, paths.parent)) fail('runtime storage changed during bootstrap.')
  let existingJournal: Journal | undefined
  try { existingJournal = JSON.parse(await readFile(paths.journal, 'utf8')) as Journal }
  catch (error) { if (!absent(error)) fail('migration journal is invalid; preserve it for recovery.') }
  if (existingJournal) {
    if (existingJournal.version !== 1 || !Number.isSafeInteger(existingJournal.pid) || ownerIsAlive(existingJournal)) {
      fail('a dependency migration is already active or has an unverified owner; retry after it finishes.')
    }
    const original = await statMaybe(paths.alias)
    const moved = await statMaybe(paths.graph)
    if (original?.isDirectory() && !moved) {
      await assertReceipt(paths, paths.alias, existingJournal.receipt, options.production, true)
      await unlink(paths.journal)
    } else if ((!original || original.isSymbolicLink()) && moved?.isDirectory()) {
      await assertReceipt(paths, paths.graph, existingJournal.receipt, options.production, true)
      if (!original) await symlink(paths.aliasTarget, paths.alias, 'dir')
      await assertAlias(paths)
      await writeJson(paths.receipt, existingJournal.receipt)
      await unlink(paths.journal)
      return existingJournal.receipt
    } else fail('interrupted migration has conflicting graphs; preserve both and resolve the conflict before retrying.')
  }

  const original = await statMaybe(paths.alias)
  const destination = await statMaybe(paths.graph)
  if (original?.isSymbolicLink()) {
    await assertAlias(paths)
    if (!destination?.isDirectory() || destination.isSymbolicLink()) fail('managed dependency payload is absent; run bun install --frozen-lockfile.')
    const refreshed = await buildReceipt(paths, paths.graph, options.production)
    if (!options.refresh) {
      const previous = await readReceipt(paths)
      if (previous.version !== 1 || !Array.isArray(previous.entries) || previous.production !== refreshed.production || !same(payload(previous), payload(refreshed))) {
        fail('installed graph differs from its receipt; use the explicit frozen dependency installer to repair it without discarding the previous graph.')
      }
      if (same(previous.manifests, refreshed.manifests)) return previous
      // A source/config edit can repin an otherwise byte-for-byte identical graph.
      // Merely changing package scripts never authorizes sealing changed package data.
    }
    await writeJson(paths.receipt, refreshed)
    return refreshed
  }
  if (destination) fail('a distinct runtime dependency graph already exists; both graphs were preserved.')
  if (!original?.isDirectory()) fail('source dependency graph is absent; run bun install --frozen-lockfile first.')
  const receipt = await buildReceipt(paths, paths.alias, options.production)
  const journal: Journal = { version: 1, pid: process.pid, host: hostname(), receipt }
  // Exclusive creation is the cross-process migration lock. Never overwrite another owner.
  const handle = await open(paths.journal, 'wx', 0o600)
  try { await handle.writeFile(`${JSON.stringify(journal)}\n`); await handle.sync() }
  finally { await handle.close() }
  let moved = false
  let linked = false
  try {
    await options.onCheckpoint?.('prepared')
    if (!same(receipt.manifests, await manifestHashes(paths))) fail('source manifests changed before migration.')
    await rename(paths.alias, paths.graph)
    moved = true
    await options.onCheckpoint?.('graph-moved')
    await assertReceipt(paths, paths.graph, receipt, options.production, true)
    await symlink(paths.aliasTarget, paths.alias, 'dir')
    linked = true
    await options.onCheckpoint?.('alias-linked')
    await assertAlias(paths)
    await writeJson(paths.receipt, receipt)
    await unlink(paths.journal)
    return receipt
  } catch (error) {
    // A normal failure restores the original tree. SIGKILL leaves the durable journal for the next invocation.
    if (linked && (await statMaybe(paths.alias))?.isSymbolicLink() && await readlink(paths.alias) === paths.aliasTarget) await unlink(paths.alias)
    if (moved && !(await statMaybe(paths.alias))) await rename(paths.graph, paths.alias)
    if (!(await statMaybe(paths.graph)) && (await statMaybe(paths.alias))?.isDirectory()) await unlink(paths.journal)
    throw error
  }
}

interface InstallationJournal {
  version: 1
  pid: number
  host: string
  stage: string
  backup: string
  original: 'runtime' | 'source' | 'absent'
  receipt: ProjectDependenciesReceipt
}
const installationJournalPath = (paths: Paths): string => join(paths.parent, 'installation.json')

const recoverInstallation = async (paths: Paths): Promise<void> => {
  let journal: InstallationJournal
  try { journal = JSON.parse(await readFile(installationJournalPath(paths), 'utf8')) as InstallationJournal }
  catch (error) { if (absent(error)) return; return fail('invalid installation journal; preserve it for recovery.') }
  if (journal.version !== 1 || !Number.isSafeInteger(journal.pid) || journal.pid <= 0 || ownerIsAlive(journal)
    || !/^install-[a-f0-9-]+$/.test(journal.stage) || !/^previous-[a-f0-9-]+$/.test(journal.backup)
    || !['runtime', 'source', 'absent'].includes(journal.original)) fail('an installation is active or has an unverified recovery journal.')
  const backup = join(paths.parent, journal.backup)
  const savedGraph = join(backup, 'node_modules')
  const source = journal.original === 'source' ? paths.alias : paths.graph
  if (await statMaybe(paths.graph)) {
    // A completed publish can safely finish its receipt/alias after an abrupt stop.
    try { await assertReceipt(paths, paths.graph, journal.receipt, journal.receipt.production, true) }
    catch {
      if (await statMaybe(savedGraph)) fail('interrupted installation has conflicting graphs; both were preserved.')
      await unlink(installationJournalPath(paths))
      return
    }
    const alias = await statMaybe(paths.alias)
    if (!alias) await symlink(paths.aliasTarget, paths.alias, 'dir')
    await assertAlias(paths)
    await writeJson(paths.receipt, journal.receipt)
  } else if (await statMaybe(savedGraph)) {
    if (await statMaybe(source)) fail('interrupted installation source conflicts with its preserved graph.')
    await rename(savedGraph, source)
    const savedReceipt = join(backup, 'project-dependencies.json')
    if (await statMaybe(savedReceipt)) await rename(savedReceipt, paths.receipt)
  }
  await unlink(installationJournalPath(paths))
}

/** Explicit frozen reinstall. Build in runtime, preserve the previous graph, then publish. */
export const installProjectRuntimeDependencies = async (options: ProjectDependencyInstallOptions = {}): Promise<ProjectDependenciesReceipt> => {
  const paths = pathsFor(options)
  if (paths.storage !== paths.runtime) fail('install into the active runtime before creating a separate runtime seed.')
  await mkdir(paths.parent, { recursive: true })
  await recoverInstallation(paths)
  if (await statMaybe(paths.journal)) await ensureProjectRuntimeDependencies(options)
  const alias = await statMaybe(paths.alias)
  const current = await statMaybe(paths.graph)
  if (alias?.isSymbolicLink()) await assertAlias(paths)
  else if (alias && !alias.isDirectory()) fail('the source dependency lookup is neither a directory nor the managed alias.')
  if (current && (!current.isDirectory() || current.isSymbolicLink())) fail('installed graph must be a physical runtime directory.')
  if (current && !alias?.isSymbolicLink()) fail('a distinct runtime dependency graph already exists; both graphs were preserved.')
  const id = crypto.randomUUID()
  const stageName = `install-${id}`
  const backupName = `previous-${id}`
  const stage = join(paths.parent, stageName)
  const backup = join(paths.parent, backupName)
  const stagedGraph = join(stage, 'node_modules')
  const cache = join(paths.runtime, 'cache/bun')
  const temporary = join(paths.runtime, 'tmp')
  if (![stage, backup, cache, temporary].every(path => pathIsPhysicallyWithinRoot(paths.runtime, path))) fail('installer paths escape the physical runtime.')
  await mkdir(stage)
  await mkdir(cache, { recursive: true })
  await mkdir(temporary, { recursive: true })
  const pins = await manifestHashes(paths)
  for (const name of MANIFESTS) await writeFileWithinStage(stage, name, await readFile(join(paths.project, name)))
  const args = [process.execPath, '--no-env-file', 'install', '--frozen-lockfile', '--ignore-scripts', `--cache-dir=${cache}`]
  if (options.production) args.push('--production', '--omit=peer')
  if (options.offline) args.push('--offline')
  const installEnv: Record<string, string> = {
    PATH: process.env['PATH'] ?? dirname(process.execPath), BUN_INSTALL_CACHE_DIR: cache,
    BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0', TMPDIR: temporary, TMP: temporary, TEMP: temporary
  }
  if (process.env['HOME']) installEnv['HOME'] = process.env['HOME']
  const child = Bun.spawn(args, { cwd: stage, stdout: 'inherit', stderr: 'inherit', env: installEnv })
  const timer = setTimeout(() => child.kill('SIGKILL'), options.timeoutMs ?? 120000)
  let exitCode: number
  try { exitCode = await child.exited } finally { clearTimeout(timer) }
  if (exitCode !== 0) fail(`frozen installation failed (${exitCode}); the previous graph and runtime installation staging were preserved.`)
  if (!same(pins, await manifestHashes(paths))) fail('source manifests changed during the frozen install; staging and previous packages were preserved.')
  const receipt = await buildReceipt(paths, stagedGraph, options.production)
  const journal: InstallationJournal = { version: 1, pid: process.pid, host: hostname(), stage: stageName, backup: backupName,
    original: current ? 'runtime' : alias?.isDirectory() ? 'source' : 'absent', receipt }
  const lock = await open(installationJournalPath(paths), 'wx', 0o600)
  try { await lock.writeFile(`${JSON.stringify(journal)}\n`); await lock.sync() } finally { await lock.close() }
  let movedPrevious = false
  let movedReceipt = false
  let published = false
  let linked = false
  try {
    await options.onCheckpoint?.('prepared')
    const original = journal.original === 'source' ? paths.alias : paths.graph
    if (journal.original !== 'absent') {
      await mkdir(backup)
      await rename(original, join(backup, 'node_modules'))
      movedPrevious = true
    }
    if (await statMaybe(paths.receipt)) {
      await mkdir(backup, { recursive: true })
      await rename(paths.receipt, join(backup, 'project-dependencies.json'))
      movedReceipt = true
    }
    await rename(stagedGraph, paths.graph)
    published = true
    await options.onCheckpoint?.('graph-moved')
    if (!(await statMaybe(paths.alias))) { await symlink(paths.aliasTarget, paths.alias, 'dir'); linked = true }
    await options.onCheckpoint?.('alias-linked')
    await assertAlias(paths)
    await writeJson(paths.receipt, receipt)
    await unlink(installationJournalPath(paths))
    return receipt
  } catch (error) {
    if (linked) await unlink(paths.alias)
    if (published) await rename(paths.graph, stagedGraph)
    if (movedPrevious) await rename(join(backup, 'node_modules'), journal.original === 'source' ? paths.alias : paths.graph)
    if (movedReceipt) await rename(join(backup, 'project-dependencies.json'), paths.receipt)
    await unlink(installationJournalPath(paths))
    throw error
  }
}

const writeFileWithinStage = async (stage: string, name: string, data: Uint8Array): Promise<void> => {
  const handle = await open(join(stage, name), 'wx', 0o600)
  try { await handle.writeFile(data) } finally { await handle.close() }
}

const runProjectDependencyBootstrap = async (): Promise<void> => {
  const options: ProjectDependenciesOptions = {}
  let verify = false
  let install = false
  let offline = false
  const args = process.argv.slice(2)
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === '--verify') verify = true
    else if (arg === '--install') install = true
    else if (arg === '--offline') offline = true
    else if (arg === '--production') options.production = true
    else if (arg === '--refresh') options.refresh = true
    else if (arg === '--project-root' || arg === '--runtime-root' || arg === '--storage-runtime-root') {
      const value = args[++index]
      if (!value || value.startsWith('--')) fail(`missing value for ${arg}`)
      if (arg === '--project-root') options.projectRoot = value
      else if (arg === '--runtime-root') options.runtimeRoot = value
      else options.storageRuntimeRoot = value
    } else fail(`unknown argument: ${arg}`)
  }
  if ((install && verify) || (offline && !install)) fail('--install and --verify are exclusive; --offline requires --install.')
  const receipt = await (install ? installProjectRuntimeDependencies({ ...options, offline }) : verify ? validateProjectRuntimeDependencies(options) : ensureProjectRuntimeDependencies(options))
  console.log(JSON.stringify({ status: verify ? 'verified' : 'ready', production: receipt.production, entries: receipt.entries.length }))
}

if (import.meta.main) {
  void runProjectDependencyBootstrap().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
