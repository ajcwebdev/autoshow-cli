import { cp, lstat, mkdir, readFile, readdir, readlink, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { withProcessLock } from '../utils/process-lock'
import { ValidationError } from '../utils/error-handler'

export const DOCKER_RUNTIME_SEED_MANIFEST = '.autoshow-docker-runtime.json'

type DockerRuntimeSeedEntry = { path: string; mode: number; kind: 'directory' } | { path: string; mode: number; kind: 'file'; sha256: string } | { path: string; mode: number; kind: 'symlink'; target: string; targetExists: boolean }
type DockerRuntimeSeedManifest = { schemaVersion: 1; rootMode: number; entries: DockerRuntimeSeedEntry[]; exports: string[] }

const seedDigest = (bytes: Uint8Array | string): string => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
const isSeedRelativePath = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && !isAbsolute(value) && !value.includes('\\') && value.split('/').every(part => part.length > 0 && part !== '.' && part !== '..')
const insideSeedRoot = (root: string, path: string): boolean => {
  const route = relative(root, path)
  return route === '' || (!isAbsolute(route) && route !== '..' && !route.startsWith(`..${sep}`))
}

const dockerSeedLinkTargetExists = async (root: string, path: string): Promise<boolean> => {
  let cursor = path
  let exists = true
  for (;;) {
    try {
      if (!insideSeedRoot(root, await realpath(cursor))) throw ValidationError(`Runtime seed link resolves outside its payload: ${relative(root, path)}`)
      return exists
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      exists = false
      const parent = dirname(cursor)
      if (parent === cursor) throw error
      cursor = parent
    }
  }
}

const inspectDockerRuntimeSeed = async (root: string): Promise<DockerRuntimeSeedManifest> => {
  const entries: DockerRuntimeSeedEntry[] = []
  const walk = async (directory: string): Promise<void> => {
    const children = (await readdir(directory)).filter(name => name !== '.DS_Store' && !(directory === root && name === DOCKER_RUNTIME_SEED_MANIFEST)).sort()
    for (const name of children) {
      const path = join(directory, name)
      const metadata = await lstat(path)
      const nameInSeed = relative(root, path).split(sep).join('/')
      if (metadata.isSymbolicLink()) {
        const target = await readlink(path)
        if (isAbsolute(target) || !insideSeedRoot(root, resolve(dirname(path), target))) throw ValidationError(`Runtime seed link escapes its payload: ${nameInSeed}`)
        const targetExists = await dockerSeedLinkTargetExists(root, resolve(dirname(path), target))
        entries.push({ path: nameInSeed, mode: metadata.mode & 0o777, kind: 'symlink', target, targetExists })
      } else if (metadata.isDirectory()) {
        entries.push({ path: nameInSeed, mode: metadata.mode & 0o777, kind: 'directory' })
        await walk(path)
      }
      else if (metadata.isFile()) entries.push({ path: nameInSeed, mode: metadata.mode & 0o777, kind: 'file', sha256: seedDigest(await readFile(path)) })
      else throw ValidationError(`Unsupported runtime seed entry: ${nameInSeed}`)
    }
  }
  await walk(root)
  const exports: string[] = []
  for (const parent of ['bin', 'tools', 'fonts']) {
    try {
      for (const name of (await readdir(join(root, parent))).filter(value => value !== '.DS_Store').sort()) {
        if (parent === 'tools' && name === 'docker-image') throw ValidationError('Runtime seed cannot own the Docker activation directory')
        exports.push(`${parent}/${name}`)
      }
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
  return { schemaVersion: 1, rootMode: (await lstat(root)).mode & 0o777, entries, exports }
}

export const writeDockerRuntimeSeedManifest = async (seedRoot: string): Promise<void> => {
  const manifest = await inspectDockerRuntimeSeed(resolve(seedRoot))
  await writeFile(join(seedRoot, DOCKER_RUNTIME_SEED_MANIFEST), `${JSON.stringify(manifest)}\n`)
}

const readDockerRuntimeSeedManifest = async (seedRoot: string): Promise<{ manifest: DockerRuntimeSeedManifest; bytes: string; revision: string }> => {
  const bytes = await readFile(join(seedRoot, DOCKER_RUNTIME_SEED_MANIFEST), 'utf8')
  const value: unknown = JSON.parse(bytes)
  if (!value || typeof value !== 'object' || !('schemaVersion' in value) || value.schemaVersion !== 1 || !('entries' in value) || !Array.isArray(value.entries) || !('exports' in value) || !Array.isArray(value.exports)) throw ValidationError('Invalid Docker runtime seed manifest')
  const manifest = value as DockerRuntimeSeedManifest
  if (!Number.isInteger(manifest.rootMode) || manifest.rootMode < 0 || manifest.rootMode > 0o777) throw ValidationError('Invalid Docker runtime seed root permissions')
  const paths = new Set<string>()
  for (const entry of manifest.entries) {
    if (!entry || !isSeedRelativePath(entry.path) || paths.has(entry.path) || !Number.isInteger(entry.mode) || entry.mode < 0 || entry.mode > 0o777 || !['file', 'directory', 'symlink'].includes(entry.kind)) throw ValidationError('Invalid Docker runtime seed entry')
    if (entry.kind === 'file' && !/^[a-f0-9]{64}$/.test(entry.sha256)) throw ValidationError('Invalid Docker runtime seed checksum')
    if (entry.kind === 'symlink' && (typeof entry.target !== 'string' || typeof entry.targetExists !== 'boolean' || isAbsolute(entry.target) || !insideSeedRoot(seedRoot, resolve(dirname(join(seedRoot, entry.path)), entry.target)))) throw ValidationError('Invalid Docker runtime seed link')
    paths.add(entry.path)
  }
  if (!manifest.exports.every(path => isSeedRelativePath(path) && /^(bin|tools|fonts)\/[^/]+$/.test(path) && path !== 'tools/docker-image')) throw ValidationError('Invalid Docker runtime exports')
  return { manifest, bytes, revision: seedDigest(bytes) }
}

const verifyDockerRuntimeSeed = async (seedRoot: string, expected: DockerRuntimeSeedManifest): Promise<void> => {
  const actual = await inspectDockerRuntimeSeed(seedRoot)
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw ValidationError('Docker runtime seed bytes, permissions, links, or exports differ from its manifest')
}

const ensureDockerSeedStateDirectory = async (root: string, subdirectory: string): Promise<void> => {
  let cursor = root
  for (const part of subdirectory.split('/')) {
    cursor = join(cursor, part)
    try { await mkdir(cursor) }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
    if (!insideSeedRoot(root, await realpath(cursor)) || !(await lstat(cursor)).isDirectory()) throw ValidationError(`Runtime seed directory escapes its managed root: ${subdirectory}`)
  }
}

/** Copies the immutable image distribution into a versioned runtime payload; activation is one atomic link swap. */
export const hydrateDockerRuntime = async (seedRoot: string, runtimeRoot: string): Promise<{ revision: string; reused: boolean; files: number }> => {
  const sourceRoot = await realpath(seedRoot)
  const stateRoot = resolve(runtimeRoot)
  const { manifest, revision } = await readDockerRuntimeSeedManifest(sourceRoot)
  const imageRoot = join(stateRoot, 'tools/docker-image')
  const currentPath = join(imageRoot, 'current')
  const expectedExportTarget = (path: string): string => relative(dirname(join(stateRoot, path)), join(currentPath, path))
  const isActive = async (): Promise<boolean> => {
    try {
      const active = await readlink(currentPath)
      if (active !== revision && !new RegExp(`^${revision}-[a-f0-9-]+$`).test(active)) return false
      const payloadPath = join(imageRoot, active)
      if (!insideSeedRoot(stateRoot, await realpath(payloadPath)) || seedDigest(await readFile(join(payloadPath, DOCKER_RUNTIME_SEED_MANIFEST))) !== revision) return false
      await verifyDockerRuntimeSeed(payloadPath, manifest)
      for (const path of manifest.exports) if (await readlink(join(stateRoot, path)) !== expectedExportTarget(path)) return false
      return true
    } catch { return false }
  }
  if (await isActive()) return { revision, reused: true, files: manifest.entries.length }
  // Validate the source before creating any state in a fresh destination.
  await verifyDockerRuntimeSeed(sourceRoot, manifest)
  await mkdir(stateRoot, { recursive: true })
  if (await realpath(stateRoot) !== stateRoot) throw ValidationError('Docker runtime root must be an actual directory')
  await ensureDockerSeedStateDirectory(stateRoot, 'state/process-locks')
  await ensureDockerSeedStateDirectory(stateRoot, 'tools/docker-image')
  await ensureDockerSeedStateDirectory(stateRoot, 'cache/fontconfig')
  await ensureDockerSeedStateDirectory(stateRoot, 'tmp')
  return await withProcessLock('docker-image-seed', async () => {
    if (await isActive()) return { revision, reused: true, files: manifest.entries.length }
    for (const path of manifest.exports) {
      try {
        const existing = await lstat(join(stateRoot, path))
        if (!existing.isSymbolicLink() || await readlink(join(stateRoot, path)) !== expectedExportTarget(path)) throw ValidationError(`Runtime seed would replace an unrelated existing path: ${path}`)
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    }
    const staged = join(imageRoot, `.staging-${crypto.randomUUID()}`)
    try {
      await cp(sourceRoot, staged, { recursive: true, dereference: false, verbatimSymlinks: true, preserveTimestamps: true, filter: path => !path.split(sep).includes('.DS_Store') })
      // cp preserves content and modes; verify their complete relationship before activation.
      await verifyDockerRuntimeSeed(staged, manifest)
      let payloadName = revision
      let payloadPath = join(imageRoot, payloadName)
      try { await verifyDockerRuntimeSeed(payloadPath, manifest) }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          payloadName = `${revision}-${crypto.randomUUID()}`
          payloadPath = join(imageRoot, payloadName)
        }
      }
      try { await rename(staged, payloadPath) }
      catch (error) {
        if (!['EEXIST', 'ENOTEMPTY'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error
        await verifyDockerRuntimeSeed(payloadPath, manifest)
      }
      for (const path of manifest.exports) {
        const destination = join(stateRoot, path)
        await ensureDockerSeedStateDirectory(stateRoot, dirname(path))
        try { await symlink(expectedExportTarget(path), destination) }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
      }
      const next = join(imageRoot, `.next-${crypto.randomUUID()}`)
      await symlink(payloadName, next)
      await rename(next, currentPath)
      return { revision, reused: false, files: manifest.entries.length }
    } finally { await rm(staged, { recursive: true, force: true }) }
  }, { lockRoot: join(stateRoot, 'state/process-locks') })
}

if (import.meta.main) {
  const args = Bun.argv.slice(2)
  if (args[0] !== 'manifest' || args.length !== 2) throw ValidationError('Expected: docker-runtime-seed.ts manifest SEED_DIRECTORY')
  await writeDockerRuntimeSeedManifest(args[1]!)
}
