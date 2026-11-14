/** Offline installed-graph inventory. --state activates the shipped distribution without downloading or reinstalling packages. */
import { access, lstat, mkdir, readFile, readdir, readlink, realpath, rm, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { writeCommandPayload } from '../utils/app-logger/result-emitter'
import { SUPPORTED_BUN_VERSION } from '../utils/bun-version'
import { ValidationError } from '../utils/error-handler'

const insideDockerRuntime = (parent: string, child: string): boolean => {
  const route = relative(parent, child)
  return route === '' || (!isAbsolute(route) && route !== '..' && !route.startsWith(`..${sep}`))
}

/** The immutable application exposes one exact alias; each managed route must remain inside runtime. */
const inspectManagedDockerDependencyAlias = async (root: string, ownerUid?: number): Promise<string> => {
  const application = await realpath(root)
  const aliasPath = join(application, 'node_modules')
  const alias = await lstat(aliasPath)
  const expectedOwner = ownerUid ?? (await lstat(application)).uid
  if (!alias.isSymbolicLink() || await readlink(aliasPath) !== 'runtime/tools/project-dependencies/node_modules') {
    throw ValidationError('Application dependencies must use the relative managed runtime alias')
  }
  if (alias.uid !== expectedOwner) throw ValidationError('Application dependency alias has unexpected owner')
  const runtime = join(application, 'runtime')
  if (!(await lstat(runtime)).isDirectory() || await realpath(runtime) !== runtime) throw ValidationError('Managed dependency runtime must be an actual directory')
  let current = runtime
  let remaining = ['tools', 'project-dependencies', 'node_modules']
  let hops = 0
  while (remaining.length > 0) {
    const next = join(current, remaining.shift()!)
    const metadata = await lstat(next)
    if (metadata.isSymbolicLink()) {
      const target = await readlink(next)
      const destination = resolve(dirname(next), target)
      if (isAbsolute(target) || !insideDockerRuntime(runtime, destination) || ++hops > 40) throw ValidationError('Managed dependency alias route escapes runtime')
      remaining = [...relative(runtime, destination).split(sep).filter(Boolean), ...remaining]
      current = runtime
    } else {
      if (!metadata.isDirectory()) throw ValidationError('Managed dependency alias must resolve to a directory')
      current = next
    }
  }
  const installed = await realpath(current)
  if (!insideDockerRuntime(runtime, installed)) throw ValidationError('Managed dependency alias resolves outside runtime')
  return installed
}

export const inspectInstalledDependencies = async (root: string) => {
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { dependencies: Record<string, string> }
  const lock = Bun.JSONC.parse(await readFile(join(root, 'bun.lock'), 'utf8')) as { packages: Record<string, [string, ...unknown[]]> }
  const graph = await inspectManagedDockerDependencyAlias(root)
  const inventory = []
  for (const [name, expected] of Object.entries(manifest.dependencies)) {
    if (!insideDockerRuntime(graph, await realpath(join(graph, name)))) throw ValidationError(`Shipped dependency escapes the managed graph: ${name}`)
    const installed = JSON.parse(await readFile(join(graph, name, 'package.json'), 'utf8')) as { name: string; version: string }
    if (installed.name !== name || installed.version !== expected || lock.packages[name]?.[0] !== `${name}@${expected}`) throw ValidationError(`Shipped dependency does not match the frozen graph: ${name}`)
    inventory.push({ name, version: installed.version })
  }
  const { validateProjectRuntimeDependencies } = await import('./project-runtime-dependencies')
  await validateProjectRuntimeDependencies({ projectRoot: root, production: true })
  for (const { name } of inventory) {
    if (!Object.keys(await import(join(graph, name))).length) throw ValidationError(`Empty production import: ${name}`)
  }
  return inventory
}

/** Fixture policies can model ownership locally; the executable always uses UID 0 and actual runtime access. */
export const inspectImmutableApplication = async (root: string, policy: { ownerUid?: number; checkWriteAccess?: boolean } = {}) => {
  const application = await realpath(root)
  const ownerUid = policy.ownerUid ?? 0
  const roots = ['src', 'config', 'package.json', 'bun.lock', 'bunfig.toml', 'tsconfig.json']
  const within = (parent: string, child: string): boolean => {
    const path = relative(parent, child)
    return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`))
  }
  const immutable = (path: string) => roots.some(item => within(join(application, item), path))
  const stateLink = join(application, 'config/autoshow.json')
  const inspectLinkRoute = async (path: string): Promise<void> => {
    const name = relative(application, path)
    let current = dirname(path)
    let remaining = (await readlink(path)).split(sep)
    let hops = 1
    const restart = (target: string): string[] => {
      if (!target.startsWith(`${application}${sep}`)) throw ValidationError(`Application link escapes immutable paths: ${name}`)
      current = application
      return target.slice(application.length + 1).split(sep)
    }
    const first = await readlink(path)
    if (isAbsolute(first)) remaining = restart(first)
    while (remaining.length) {
      const part = remaining.shift()!
      if (!part || part === '.') continue
      current = part === '..' ? dirname(current) : join(current, part)
      if (current === application) continue
      if (!immutable(current) || current === stateLink) throw ValidationError(`Application link escapes immutable paths: ${name}`)
      const metadata = await lstat(current)
      if (metadata.isSymbolicLink()) {
        if (metadata.uid !== ownerUid || ++hops > 40) throw ValidationError(`Application link has an unsafe route: ${name}`)
        const target = await readlink(current)
        current = dirname(current)
        remaining = [...(isAbsolute(target) ? restart(target) : target.split(sep)), ...remaining]
      }
    }
    if (!immutable(current)) throw ValidationError(`Application link escapes immutable paths: ${name}`)
    await realpath(path)
  }
  let checkedPaths = 0
  let alignment = await Bun.file(join(application, 'runtime/tools/stt-alignment/package.json')).exists()
    && await Bun.file(join(application, 'runtime/tools/stt-alignment/node_modules/onnxruntime-node/package.json')).exists()
  const inspect = async (path: string, recursive = true): Promise<void> => {
    const name = relative(application, path) || '.'
    const metadata = await lstat(path)
    if (metadata.uid !== ownerUid) throw ValidationError(`Application path has unexpected owner: ${name}`)
    checkedPaths++
    if (metadata.isSymbolicLink()) {
      if (name === join('config', 'autoshow.json')) {
        if (await readlink(path) !== '../runtime/autoshow.json') throw ValidationError('Unexpected writable configuration link')
        return
      }
      try { await inspectLinkRoute(path) }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code) throw ValidationError(`Application link is not resolvable: ${name}`)
        throw error
      }
      return
    }
    if (!metadata.isFile() && !metadata.isDirectory()) throw ValidationError(`Unsupported application artifact: ${name}`)
    if (name === join('config', 'autoshow.json')) throw ValidationError('Writable configuration must use the runtime link')
    if ((metadata.mode & 0o022) !== 0) throw ValidationError(`Application path permits group/other writes: ${name}`)
    const readableMode = metadata.isDirectory() ? 0o555 : 0o444
    if ((metadata.mode & readableMode) !== readableMode) throw ValidationError(`Application path is not readable/traversable: ${name}`)
    await access(path, metadata.isDirectory() ? constants.R_OK | constants.X_OK : constants.R_OK)
    if (policy.checkWriteAccess !== false) {
      let writable = false
      try { await access(path, constants.W_OK); writable = true } catch { /* Runtime writes must be refused. */ }
      if (writable) throw ValidationError(`Runtime can modify installed application path: ${name}`)
    }
    if (metadata.isDirectory() && recursive) {
      const entries = await readdir(path, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name === '.DS_Store') continue
        await inspect(join(path, entry.name))
      }
    }
  }
  await inspect(application, false)
  for (const item of roots) {
    if (['src', 'config'].includes(item) && !(await lstat(join(application, item))).isDirectory()) throw ValidationError(`Immutable root must be an actual directory: ${item}`)
    await inspect(join(application, item))
  }
  await inspectManagedDockerDependencyAlias(application, ownerUid)
  checkedPaths++
  const configLink = join(application, 'config', 'autoshow.json')
  if (!(await lstat(configLink)).isSymbolicLink()) throw ValidationError('Writable configuration must use the runtime link')
  return { checkedPaths, alignment }
}

if (import.meta.main) {
  if (Bun.version !== SUPPORTED_BUN_VERSION) throw ValidationError('Unexpected shipped Bun version')
  if (process.getuid?.() === 0) throw ValidationError('Run installed-image verification as the runtime user')
  const root = '/app'
  if (process.argv.includes('--state')) {
    const bootstrapModule = './docker-runtime-seed-bundle.js'
    const { hydrateDockerRuntime } = await import(bootstrapModule) as typeof import('./docker-runtime-seed')
    const hydrated = await hydrateDockerRuntime('/opt/autoshow-runtime', join(root, 'runtime'))
    if (!hydrated.reused) {
      // Reset Bun's package-directory lookup cache after cold graph activation.
      const child = Bun.spawn([process.execPath, '--no-env-file', import.meta.path, ...Bun.argv.slice(2)], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' })
      process.exit(await child.exited)
    }
  }
  const inventory = await inspectInstalledDependencies(root)
  const immutable = await inspectImmutableApplication(root)
  if (process.argv.includes('--state')) {
    const loaderModule = '../cli/commands/setup-and-utilities/config-command/config-loader'
    const writerModule = '../cli/commands/setup-and-utilities/config-command/config-writer'
    const [{ loadConfig }, { writeConfig }] = await Promise.all([
      import(loaderModule) as Promise<typeof import('../cli/commands/setup-and-utilities/config-command/config-loader')>,
      import(writerModule) as Promise<typeof import('../cli/commands/setup-and-utilities/config-command/config-writer')>
    ])
    for (const path of ['/app/runtime', '/app/input', '/app/output', '/app/runtime/cache']) {
      await mkdir(path, { recursive: true })
      const probe = join(path, `.autoshow-permission-${process.pid}`)
      await writeFile(probe, 'permission check\n', { flag: 'wx' })
      await rm(probe)
    }
    const path = '/app/runtime/autoshow.json'
    const before = await Bun.file(path).exists() ? await readFile(path, 'utf8') : undefined
    try {
      await writeConfig(path, { pricing: { maxCents: 25 } }, { managedDefault: true })
      await loadConfig(path, { allowLegacyFallback: true })
      const saved = JSON.parse(await readFile(path, 'utf8')) as { pricing?: { maxCents?: number } }
      if (saved.pricing?.maxCents !== 25) throw ValidationError('Default config writer failed')
    } finally {
      if (before !== undefined) await writeFile(path, before)
      else await rm('/app/runtime/autoshow.json', { force: true })
    }
  }
  writeCommandPayload(`${JSON.stringify({ status: 'passed', bun: Bun.version, uid: process.getuid?.(), inventory, immutableApplication: true, immutable, state: process.argv.includes('--state') })}\n`)
}
