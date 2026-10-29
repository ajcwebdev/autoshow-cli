import { InfraError } from '~/utils/error-handler'
import { randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, readdir, realpath, rm, rmdir, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

type Owner = { schemaVersion: 1; token: string; kind: string; pid: number }
export type ProjectMaintenanceLease = { assertHeld: () => Promise<void>; release: () => Promise<void> }
type Layout = { root: string; output: string; base: string; outputCreated: boolean }
const code = (error: unknown): string | undefined => (error as NodeJS.ErrnoException)?.code
const parentCleanupRace = (error: unknown): boolean => code(error) === 'ENOENT' ||
  // APFS can report EINVAL when mkdir races removal of its empty parent inode.
  process.platform === 'darwin' && code(error) === 'EINVAL' && (error as NodeJS.ErrnoException).syscall === 'mkdir'
const entries = async (path: string): Promise<string[]> => (await readdir(path)).filter(name => name !== '.DS_Store')
const absent = async (path: string): Promise<boolean> => {
  try { await lstat(path); return false } catch (error) { if (code(error) === 'ENOENT') return true; throw error }
}
const directory = async (path: string): Promise<boolean> => {
  try { await mkdir(path); return true } catch (error) { if (code(error) !== 'EEXIST') throw error }
  const info = await lstat(path)
  if (!info.isDirectory() || info.isSymbolicLink()) throw InfraError(`Workspace lease path must be a real directory: ${path}`)
  return false
}
const realDirectory = async (path: string): Promise<void> => {
  const info = await lstat(path)
  if (!info.isDirectory() || info.isSymbolicLink()) throw InfraError(`Workspace lease path must be a real directory: ${path}`)
}
const ensureLayout = async (paths: Layout): Promise<void> => {
  const deadline = Date.now() + 5_000
  while (true) {
    await realDirectory(paths.root)
    try {
      paths.outputCreated = await directory(paths.output) || paths.outputCreated
      await directory(paths.base)
      return
    } catch (error) {
      // The last lease may remove empty parents while a new claim is being initialized.
      if (!parentCleanupRace(error) || Date.now() >= deadline) throw error
    }
  }
}
const layout = async (projectRoot: string): Promise<Layout> => {
  const requested = resolve(projectRoot)
  await realDirectory(requested)
  const root = await realpath(requested), output = join(root, 'output')
  const paths: Layout = { root, output, base: join(output, '.autoshow-workspace-leases'), outputCreated: false }
  try { await ensureLayout(paths) } catch (error) { if (paths.outputCreated) await rmdir(output).catch(() => undefined); throw error }
  return paths
}
const ownerBytes = (owner: Owner): string => `${JSON.stringify(owner)}\n`
const readOwner = async (path: string): Promise<Owner> => {
  await realDirectory(path)
  const ownerPath = join(path, 'owner.json'), info = await lstat(ownerPath)
  if (!info.isFile() || info.isSymbolicLink()) throw InfraError('Workspace lease owner must be a regular file')
  const owner = JSON.parse(await readFile(ownerPath, 'utf8')) as Owner
  if (owner.schemaVersion !== 1 || typeof owner.token !== 'string' || typeof owner.kind !== 'string') throw InfraError('Malformed workspace lease owner')
  return owner
}
const assertOwner = async (path: string, owner: Owner): Promise<void> => {
  const actual = await readOwner(path)
  if (ownerBytes(actual) !== ownerBytes(owner)) throw InfraError('Workspace lease ownership changed; refusing mutation')
}
const makeOwner = (kind: string): Owner => ({ schemaVersion: 1, token: randomUUID(), kind, pid: process.pid })
const createOwned = async (path: string, owner: Owner): Promise<void> => {
  await mkdir(path)
  try { await writeFile(join(path, 'owner.json'), ownerBytes(owner), { flag: 'wx', mode: 0o600 }) }
  catch (error) { await rmdir(path).catch(() => undefined); throw error }
}
const removeOwned = async (path: string, owner: Owner): Promise<void> => {
  await assertOwner(path, owner)
  const contents = await entries(path)
  if (contents.length !== 1 || contents[0] !== 'owner.json') throw InfraError('Workspace lease contains foreign entries; refusing cleanup')
  await rm(path, { recursive: true })
}
const cleanupParents = async (paths: Layout, removeOutput: boolean): Promise<void> => {
  try { await realDirectory(paths.base); await rmdir(paths.base) } catch (error) { if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(code(error) ?? '')) throw error }
  if (removeOutput) {
    try { await realDirectory(paths.output); await rmdir(paths.output) } catch (error) {
      if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(code(error) ?? '')) throw error
      if (code(error) !== 'ENOENT') {
        try {
          // A new claim can recreate the base before empty-output cleanup finishes.
          // Transfer lease-created output ownership to that lifecycle under its gate.
          if ((await entries(paths.output)).every(entry => entry === '.autoshow-workspace-leases')) {
            paths.outputCreated = true
            await withGate(paths, async () => undefined)
          }
        } catch (error) { if (code(error) !== 'ENOENT') throw error }
      }
    }
  }
}

// A short structural gate serializes lease creation/release; unlike workflow leases it is never reaped automatically.
const withGate = async <T>(paths: Layout, action: () => Promise<T>): Promise<T> => {
  const gate = join(paths.base, 'gate'), owner = makeOwner('layout-gate')
  const deadline = Date.now() + 5_000
  while (true) {
    if (Date.now() >= deadline) throw InfraError('Workspace lease layout gate is busy; no stale owner is removed automatically')
    await ensureLayout(paths)
    try { await createOwned(gate, owner); break } catch (error) {
      if (parentCleanupRace(error)) continue
      if (code(error) !== 'EEXIST') throw error
      try { await realDirectory(gate) } catch (error) { if (code(error) === 'ENOENT') continue; throw error }
      await new Promise(resolveWait => setTimeout(resolveWait, 10))
    }
  }
  let removeOutput = false
  try {
    const statePath = join(paths.base, 'state.json')
    let state = { schemaVersion: 1, outputCreated: paths.outputCreated }
    if (!await absent(statePath)) {
      const stat = await lstat(statePath)
      if (!stat.isFile() || stat.isSymbolicLink()) throw InfraError('Workspace lease state must be a regular file')
      const previous = JSON.parse(await readFile(statePath, 'utf8')) as typeof state
      if (previous.schemaVersion !== 1 || typeof previous.outputCreated !== 'boolean') throw InfraError('Malformed workspace lease state')
      state = { schemaVersion: 1, outputCreated: previous.outputCreated || paths.outputCreated }
    }
    await writeFile(statePath, `${JSON.stringify(state)}\n`, { mode: 0o600 })
    try { return await action() } finally {
      const writers = join(paths.base, 'writers')
      const noWriters = await absent(writers) || (await realDirectory(writers), (await entries(writers)).length === 0)
      if (noWriters && await absent(join(paths.base, 'maintenance'))) {
        if (!await absent(writers)) await rm(writers, { recursive: true })
        const contents = await entries(paths.base)
        if (contents.every(entry => ['state.json', 'gate'].includes(entry))) {
          await unlink(statePath)
          removeOutput = state.outputCreated
        }
      }
    }
  } finally {
    await removeOwned(gate, owner)
    await cleanupParents(paths, removeOutput)
  }
}

export const acquireProjectMaintenanceLease = async (projectRoot: string): Promise<ProjectMaintenanceLease> => {
  const paths = await layout(projectRoot), maintenance = join(paths.base, 'maintenance'), owner = makeOwner('maintenance')
  await withGate(paths, async () => {
    if (!await absent(maintenance)) throw InfraError('Workspace maintenance lease is already held; refusing concurrent maintenance')
    await createOwned(maintenance, owner)
    try {
      const writers = join(paths.base, 'writers')
      if (!await absent(writers)) {
        await realDirectory(writers)
        if ((await entries(writers)).length) throw InfraError('Workspace writer leases are active; refusing maintenance')
      }
    } catch (error) { await removeOwned(maintenance, owner); throw error }
  })
  let released = false
  return {
    assertHeld: async () => { if (released) throw InfraError('Workspace maintenance lease is released'); await assertOwner(maintenance, owner) },
    release: async () => {
      if (released) return
      await withGate(paths, async () => { await removeOwned(maintenance, owner) })
      released = true
    }
  }
}

export const acquireProjectWriterLease = async (projectRoot: string, options: { afterWriterClaim?: () => Promise<void> } = {}): Promise<ProjectMaintenanceLease> => {
  const paths = await layout(projectRoot), owner = makeOwner('writer'), writers = join(paths.base, 'writers'), claim = join(writers, owner.token)
  await withGate(paths, async () => {
    const maintenance = join(paths.base, 'maintenance')
    if (!await absent(maintenance)) throw InfraError('Workspace maintenance lease is active; retry this command after maintenance')
    await directory(writers)
    await createOwned(claim, owner)
    try {
      await options.afterWriterClaim?.()
      if (!await absent(maintenance)) throw InfraError('Workspace maintenance began while the writer claimed its lease')
    } catch (error) { await removeOwned(claim, owner); throw error }
  })
  let released = false
  return {
    assertHeld: async () => { if (released) throw InfraError('Workspace writer lease is released'); await assertOwner(claim, owner) },
    release: async () => {
      if (released) return
      await withGate(paths, async () => { await removeOwned(claim, owner) })
      released = true
    }
  }
}

export const withProjectWriterLease = async <T>(projectRoots: readonly string[], operation: () => Promise<T>): Promise<T> => {
  const leases: ProjectMaintenanceLease[] = []
  try {
    for (const root of [...new Set(projectRoots.map(root => resolve(root)))].sort()) leases.push(await acquireProjectWriterLease(root))
    return await operation()
  } finally {
    let failure: unknown
    for (const lease of leases.reverse()) try { await lease.release() } catch (error) { failure ??= error }
    if (failure) throw failure
  }
}

const existingDirectoryAncestor = async (path: string): Promise<string> => {
  let current = resolve(path)
  while (await absent(current)) { const parent = dirname(current); if (parent === current) throw InfraError(`No existing directory ancestor: ${path}`); current = parent }
  current = await realpath(current)
  if (!(await lstat(current)).isDirectory()) current = dirname(current)
  return current
}

const workspaceAncestor = async (path: string): Promise<string | undefined> => {
  let current = await existingDirectoryAncestor(path)
  while (true) {
    for (const marker of ['AGENTS.md', '.git']) if (!await absent(join(current, marker))) return current
    const parent = dirname(current)
    if (parent === current) return undefined
    current = parent
  }
}

export const resolveProjectMaintenanceRoots = async (cwd: string, flags: Readonly<Record<string, unknown>>, parameters: Readonly<Record<string, string | string[]>> = {}): Promise<string[]> => {
  const roots = new Set<string>(), own = await workspaceAncestor(cwd)
  if (own) roots.add(own)
  let explicitDestination = false
  for (const key of ['output-dir', 'output-root']) {
    const value = flags[key]
    if (typeof value !== 'string' || !value.trim() || /^[a-z][a-z\d+.-]*:/i.test(value) || value.includes('\0')) continue
    const destination = resolve(cwd, value)
    roots.add(await workspaceAncestor(destination) ?? await existingDirectoryAncestor(destination))
    explicitDestination = true
  }
  // A markerless invocation directory may be a read-only container workdir.
  // Explicit destinations own its writes; real source workspaces still participate below.
  if (!own && !explicitDestination) roots.add(await realpath(cwd))
  const values: string[] = []
  for (const key of ['output-dir', 'output-root', 'characters-root', 'input-dir', 'input-root']) if (typeof flags[key] === 'string') values.push(flags[key] as string)
  for (const key of ['input', 'outputDirs', 'path', 'scriptPath']) {
    const value = parameters[key]
    if (Array.isArray(value)) values.push(...value)
    else if (typeof value === 'string') values.push(value)
  }
  for (const value of values) {
    if (!value.trim() || /^[a-z][a-z\d+.-]*:/i.test(value) || value.includes('\0')) continue
    const root = await workspaceAncestor(resolve(cwd, value))
    if (root) roots.add(root)
  }
  return [...roots].sort()
}
