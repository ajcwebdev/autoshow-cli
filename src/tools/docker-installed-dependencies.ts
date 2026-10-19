/** Runs inside the built image, with networking disabled. Never installs or repairs dependencies. */
import { access, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'
import { loadConfig } from '../cli/commands/setup-and-utilities/config-command/config-loader'
import { writeConfig } from '../cli/commands/setup-and-utilities/config-command/config-writer'
import { SUPPORTED_BUN_VERSION } from '../utils/bun-version'

export const inspectInstalledDependencies = async (root: string) => {
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { dependencies: Record<string, string> }
  const lock = Bun.JSONC.parse(await readFile(join(root, 'bun.lock'), 'utf8')) as { packages: Record<string, [string, ...unknown[]]> }
  const inventory = []
  for (const [name, expected] of Object.entries(manifest.dependencies)) {
    const installed = JSON.parse(await readFile(join(root, 'node_modules', name, 'package.json'), 'utf8')) as { name: string; version: string }
    if (installed.name !== name || installed.version !== expected || lock.packages[name]?.[0] !== `${name}@${expected}`) throw new Error(`Shipped dependency does not match the frozen graph: ${name}`)
    if (!Object.keys(await import(join(root, 'node_modules', name))).length) throw new Error(`Empty production import: ${name}`)
    inventory.push({ name, version: installed.version })
  }
  return inventory
}

if (import.meta.main) {
  if (Bun.version !== SUPPORTED_BUN_VERSION) throw new Error('Unexpected shipped Bun version')
  if (process.getuid?.() === 0) throw new Error('Run installed-image verification as the runtime user')
  const root = '/app'
  const inventory = await inspectInstalledDependencies(root)
  for (const path of ['src', 'src/cli/create-cli.ts', 'node_modules', ...inventory.map(item => `node_modules/${item.name}/package.json`), 'package.json', 'bun.lock', 'bunfig.toml', 'tsconfig.json', 'config', 'config/defuddle']) {
    let writable = false
    try { await access(join(root, path), constants.W_OK); writable = true } catch { /* An immutable path must reject writes. */ }
    if (writable) throw new Error(`Runtime can modify installed application path: ${path}`)
    if ((await stat(join(root, path))).uid !== 0) throw new Error(`Application path is not root-owned: ${path}`)
  }
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
      if (saved.pricing?.maxCents !== 25) throw new Error('Default config writer failed')
    } finally {
      if (before !== undefined) await writeFile(path, before)
      else await rm('/app/runtime/autoshow.json', { force: true })
    }
  }
  console.log(JSON.stringify({ status: 'passed', bun: Bun.version, uid: process.getuid?.(), inventory, immutableApplication: true, state: process.argv.includes('--state') }))
}
