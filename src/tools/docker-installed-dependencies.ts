/** Runs inside the built image, with networking disabled. Never installs or repairs dependencies. */
import { access, lstat, mkdir, readFile, readdir, readlink, realpath, rm, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'
import { loadConfig } from '../cli/commands/setup-and-utilities/config-command/config-loader'
import { writeConfig } from '../cli/commands/setup-and-utilities/config-command/config-writer'
import { writeCommandPayload } from '../utils/app-logger/result-emitter'
import { SUPPORTED_BUN_VERSION } from '../utils/bun-version'
import { ValidationError } from '../utils/error-handler'

export const inspectInstalledDependencies = async (root: string) => {
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { dependencies: Record<string, string> }
  const lock = Bun.JSONC.parse(await readFile(join(root, 'bun.lock'), 'utf8')) as { packages: Record<string, [string, ...unknown[]]> }
  const inventory = []
  for (const [name, expected] of Object.entries(manifest.dependencies)) {
    const installed = JSON.parse(await readFile(join(root, 'node_modules', name, 'package.json'), 'utf8')) as { name: string; version: string }
    if (installed.name !== name || installed.version !== expected || lock.packages[name]?.[0] !== `${name}@${expected}`) throw ValidationError(`Shipped dependency does not match the frozen graph: ${name}`)
    if (!Object.keys(await import(join(root, 'node_modules', name))).length) throw ValidationError(`Empty production import: ${name}`)
    inventory.push({ name, version: installed.version })
  }
  return inventory
}

/** Fixture policies can model ownership locally; the executable always uses UID 0 and actual runtime access. */
export const inspectImmutableApplication = async (root: string, policy: { ownerUid?: number; checkWriteAccess?: boolean } = {}) => {
  const application = await realpath(root)
  const ownerUid = policy.ownerUid ?? 0
  const roots = ['src', 'node_modules', 'config', 'package.json', 'bun.lock', 'bunfig.toml', 'tsconfig.json']
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
  let alignment = false
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
      if (name === join('config', 'stt-alignment')) alignment = true
      const entries = await readdir(path, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name === '.DS_Store') continue
        await inspect(join(path, entry.name))
      }
    }
  }
  await inspect(application, false)
  for (const item of roots) {
    if (['src', 'node_modules', 'config'].includes(item) && !(await lstat(join(application, item))).isDirectory()) throw ValidationError(`Immutable root must be an actual directory: ${item}`)
    await inspect(join(application, item))
  }
  const configLink = join(application, 'config', 'autoshow.json')
  if (!(await lstat(configLink)).isSymbolicLink()) throw ValidationError('Writable configuration must use the runtime link')
  return { checkedPaths, alignment }
}

if (import.meta.main) {
  if (Bun.version !== SUPPORTED_BUN_VERSION) throw ValidationError('Unexpected shipped Bun version')
  if (process.getuid?.() === 0) throw ValidationError('Run installed-image verification as the runtime user')
  const root = '/app'
  const inventory = await inspectInstalledDependencies(root)
  const immutable = await inspectImmutableApplication(root)
  if (process.argv.includes('--state')) {
    for (const path of ['/app/runtime', '/app/input', '/app/output', '/home/bun/.cache']) {
      await mkdir(path, { recursive: true })
      const probe = join(path, `.autoshow-permission-${process.pid}`)
      await writeFile(probe, 'permission check\n', { flag: 'wx' })
      await rm(probe)
    }
    const path = '/app/config/autoshow.json'
    const before = await Bun.file(path).exists() ? await readFile(path, 'utf8') : undefined
    try {
      await writeConfig(path, { pricing: { maxCents: 25 } })
      await loadConfig(path)
      const saved = JSON.parse(await readFile(path, 'utf8')) as { pricing?: { maxCents?: number } }
      if (saved.pricing?.maxCents !== 25) throw ValidationError('Default config writer failed')
    } finally {
      if (before !== undefined) await writeFile(path, before)
      else await rm('/app/runtime/autoshow.json', { force: true })
    }
  }
  writeCommandPayload(`${JSON.stringify({ status: 'passed', bun: Bun.version, uid: process.getuid?.(), inventory, immutableApplication: true, immutable, state: process.argv.includes('--state') })}\n`)
}
