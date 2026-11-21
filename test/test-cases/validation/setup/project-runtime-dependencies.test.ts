import { expect, test } from 'bun:test'
import { chmod, lstat, mkdir, readFile, readdir, readlink, rm, symlink, unlink, utimes, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createRuntimeTempDirectory } from '~/utils/runtime-state'
import { ensureProjectRuntimeDependencies, installProjectRuntimeDependencies, snapshotProjectDependencyGraph, validateProjectRuntimeDependencies } from '~/tools/project-runtime-dependencies'

const HELPER = resolve(import.meta.dir, '../../../../src/tools/project-runtime-dependencies.ts')
const graphPath = (root: string): string => join(root, 'runtime/tools/project-dependencies/node_modules')
const runFixtureCommand = async (args: string[], cwd: string, env: NodeJS.ProcessEnv) => {
  const child = Bun.spawn(args, { cwd, env, stdout: 'pipe', stderr: 'pipe' })
  const timer = setTimeout(() => child.kill('SIGKILL'), 10000)
  try {
    const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    return { exitCode, stdout, stderr }
  } finally { clearTimeout(timer) }
}
const fixture = async (): Promise<string> => {
  const root = await createRuntimeTempDirectory('project-graph-')
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'fixture', dependencies: { sample: '1.2.3' } }))
  await writeFile(join(root, 'bun.lock'), '{ "fixture": "frozen" }\n')
  await writeFile(join(root, 'bunfig.toml'), '[install.cache]\ndir="runtime/cache/bun"\n')
  await mkdir(join(root, 'node_modules/.store/sample'), { recursive: true })
  await writeFile(join(root, 'node_modules/.store/sample/package.json'), JSON.stringify({ name: 'sample', version: '1.2.3' }))
  await writeFile(join(root, 'node_modules/.store/sample/tool'), 'preserved executable\n')
  await chmod(join(root, 'node_modules/.store/sample/tool'), 0o751)
  await utimes(join(root, 'node_modules/.store/sample/tool'), 1234567890, 1234567890)
  await symlink('.store/sample', join(root, 'node_modules/sample'))
  return root
}

test('project graph relocation preserves every byte, permission, timestamp, inode and relative link', async () => {
  const root = await fixture()
  try {
    const original = join(root, 'node_modules')
    const before = await snapshotProjectDependencyGraph(original)
    const inode = await lstat(join(original, '.store/sample/tool'), { bigint: true })
    const receipt = await ensureProjectRuntimeDependencies({ projectRoot: root })
    expect(receipt.entries).toEqual(before)
    expect(await snapshotProjectDependencyGraph(graphPath(root))).toEqual(before)
    const after = await lstat(join(graphPath(root), '.store/sample/tool'), { bigint: true })
    expect([after.ino, after.dev]).toEqual([inode.ino, inode.dev])
    expect(await readlink(original)).toBe('runtime/tools/project-dependencies/node_modules')
    expect(await validateProjectRuntimeDependencies({ projectRoot: root })).toEqual(receipt)
    const metadata = await lstat(join(root, 'runtime/tools/project-dependencies/project-dependencies.json'))
    await validateProjectRuntimeDependencies({ projectRoot: root })
    expect((await lstat(join(root, 'runtime/tools/project-dependencies/project-dependencies.json'))).mtimeMs).toBe(metadata.mtimeMs)
    await writeFile(join(graphPath(root), '.store/sample/tool'), 'tampered executable\n')
    await expect(validateProjectRuntimeDependencies({ projectRoot: root })).rejects.toThrow('differ from their receipt')
    await expect(ensureProjectRuntimeDependencies({ projectRoot: root })).rejects.toThrow('differs from its receipt')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('distinct destination graphs and escaping links are preserved and rejected', async () => {
  const root = await fixture()
  try {
    const before = await snapshotProjectDependencyGraph(join(root, 'node_modules'))
    await mkdir(graphPath(root), { recursive: true })
    await writeFile(join(graphPath(root), 'sentinel'), 'distinct graph')
    await expect(ensureProjectRuntimeDependencies({ projectRoot: root })).rejects.toThrow('distinct runtime dependency graph')
    expect(await snapshotProjectDependencyGraph(join(root, 'node_modules'))).toEqual(before)
    expect(await readFile(join(graphPath(root), 'sentinel'), 'utf8')).toBe('distinct graph')
    await rm(graphPath(root), { recursive: true })
    await writeFile(join(root, 'outside'), 'retained outside payload')
    await symlink('../outside', join(root, 'node_modules/escape'))
    await expect(ensureProjectRuntimeDependencies({ projectRoot: root })).rejects.toThrow('escapes its movable graph')
    expect(await readFile(join(root, 'outside'), 'utf8')).toBe('retained outside payload')
    expect((await lstat(join(root, 'node_modules'))).isDirectory()).toBe(true)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('bootstrap refuses runtime parent links outside the selected runtime', async () => {
  const root = await fixture()
  const outside = await createRuntimeTempDirectory('project-graph-outside-')
  try {
    await mkdir(join(root, 'runtime'))
    await symlink(outside, join(root, 'runtime/tools'))
    await expect(ensureProjectRuntimeDependencies({ projectRoot: root })).rejects.toThrow('physical runtime root')
    expect(await Bun.file(join(outside, 'project-dependencies/migration.json')).exists()).toBe(false)
  } finally { await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }) }
})

for (const name of ['project-dependencies.json', 'migration.json', 'installation.json']) {
  test(`dependency control ${name} refuses existing and dangling external links without changing either tree`, async () => {
    const root = await fixture()
    const outside = await createRuntimeTempDirectory('project-graph-control-outside-')
    try {
      const before = await snapshotProjectDependencyGraph(join(root, 'node_modules'))
      const parent = join(root, 'runtime/tools/project-dependencies')
      await mkdir(parent, { recursive: true })
      const sentinel = join(outside, 'sentinel')
      await writeFile(sentinel, 'external control bytes must remain untouched\n')
      await chmod(sentinel, 0o640)
      await utimes(sentinel, 1234567890, 1234567890)
      const metadata = await lstat(sentinel, { bigint: true })
      const control = join(parent, name)
      for (const target of [sentinel, join(outside, 'missing-control')]) {
        await symlink(target, control)
        for (const operation of [ensureProjectRuntimeDependencies, validateProjectRuntimeDependencies, installProjectRuntimeDependencies]) {
          await expect(operation({ projectRoot: root })).rejects.toThrow('control file escapes its physical runtime storage')
        }
        expect(await readlink(control)).toBe(target)
        expect(await snapshotProjectDependencyGraph(join(root, 'node_modules'))).toEqual(before)
        expect(await readFile(sentinel, 'utf8')).toBe('external control bytes must remain untouched\n')
        const after = await lstat(sentinel, { bigint: true })
        expect([after.ino, after.mode, after.mtimeNs]).toEqual([metadata.ino, metadata.mode, metadata.mtimeNs])
        expect(await Bun.file(join(outside, 'missing-control')).exists()).toBe(false)
        await unlink(control)
      }
    } finally { await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }) }
  })
}

for (const checkpoint of ['prepared', 'graph-moved', 'alias-linked'] as const) {
  test(`failed ${checkpoint} checkpoint restores the original graph without losing metadata`, async () => {
    const root = await fixture()
    try {
      const before = await snapshotProjectDependencyGraph(join(root, 'node_modules'))
      await expect(ensureProjectRuntimeDependencies({ projectRoot: root, onCheckpoint: phase => {
        if (phase === checkpoint) throw new Error('injected interruption')
      } })).rejects.toThrow('injected interruption')
      expect((await lstat(join(root, 'node_modules'))).isDirectory()).toBe(true)
      expect(await snapshotProjectDependencyGraph(join(root, 'node_modules'))).toEqual(before)
      expect(await Bun.file(join(root, 'runtime/tools/project-dependencies/migration.json')).exists()).toBe(false)
      await ensureProjectRuntimeDependencies({ projectRoot: root })
      await validateProjectRuntimeDependencies({ projectRoot: root })
    } finally { await rm(root, { recursive: true, force: true }) }
  })
}

test('a killed migration recovers its pinned complete graph without reinstalling', async () => {
  const root = await fixture()
  try {
    const before = await snapshotProjectDependencyGraph(join(root, 'node_modules'))
    const source = `import {ensureProjectRuntimeDependencies} from ${JSON.stringify(HELPER)}; await ensureProjectRuntimeDependencies({projectRoot:${JSON.stringify(root)},onCheckpoint(phase){if(phase==='graph-moved')process.kill(process.pid,'SIGKILL')}})`
    const child = Bun.spawn([process.execPath, '--no-env-file', '-e', source], {
      env: { ...process.env, BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0' }, stdout: 'pipe', stderr: 'pipe'
    })
    expect(await child.exited).not.toBe(0)
    const receipt = await ensureProjectRuntimeDependencies({ projectRoot: root })
    expect(receipt.entries).toEqual(before)
    expect(await validateProjectRuntimeDependencies({ projectRoot: root })).toEqual(receipt)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('production seed storage preserves the eventual active relative alias and supports offline fixture sealing', async () => {
  const root = await fixture()
  const seed = await createRuntimeTempDirectory('project-graph-seed-')
  try {
    const options = { projectRoot: root, storageRuntimeRoot: seed, production: true }
    const receipt = await ensureProjectRuntimeDependencies(options)
    expect(await readlink(join(root, 'node_modules'))).toBe('runtime/tools/project-dependencies/node_modules')
    expect(await validateProjectRuntimeDependencies(options)).toEqual(receipt)
    await unlink(join(seed, 'tools/project-dependencies/project-dependencies.json'))
    await expect(validateProjectRuntimeDependencies(options)).rejects.toThrow('receipt is missing')
    expect(await ensureProjectRuntimeDependencies({ ...options, refresh: true })).toEqual(receipt)
  } finally { await rm(root, { recursive: true, force: true }); await rm(seed, { recursive: true, force: true }) }
})

test('readiness rejects changed source pins, altered lookup aliases and permission changes without repair', async () => {
  const root = await fixture()
  try {
    await ensureProjectRuntimeDependencies({ projectRoot: root })
    const lock = await readFile(join(root, 'bun.lock'))
    await writeFile(join(root, 'bun.lock'), 'changed lock pin\n')
    await expect(validateProjectRuntimeDependencies({ projectRoot: root })).rejects.toThrow('differ from their receipt')
    expect(await readFile(join(root, 'bun.lock'), 'utf8')).toBe('changed lock pin\n')
    await writeFile(join(root, 'bun.lock'), lock)
    await chmod(join(graphPath(root), '.store/sample/tool'), 0o700)
    await expect(validateProjectRuntimeDependencies({ projectRoot: root })).rejects.toThrow('differ from their receipt')
    await chmod(join(graphPath(root), '.store/sample/tool'), 0o751)
    await unlink(join(root, 'node_modules'))
    await symlink('./runtime/tools/project-dependencies/node_modules', join(root, 'node_modules'))
    await expect(validateProjectRuntimeDependencies({ projectRoot: root })).rejects.toThrow('relative runtime lookup alias')
    expect(await readlink(join(root, 'node_modules'))).toBe('./runtime/tools/project-dependencies/node_modules')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('fresh Bun installs use the runtime cache, invoke the hook, and retain the managed alias on reinstall', async () => {
  const root = await createRuntimeTempDirectory('project-graph-install-')
  let server: ReturnType<typeof Bun.serve> | undefined
  try {
    await mkdir(join(root, 'archive/package'), { recursive: true })
    await writeFile(join(root, 'archive/package/package.json'), JSON.stringify({ name: 'offline-project-fixture', version: '1.0.0' }))
    await writeFile(join(root, 'archive/package/index.js'), 'export default "local fixture"\n')
    const tar = Bun.spawn(['tar', '-czf', join(root, 'fixture.tgz'), '-C', join(root, 'archive'), 'package'], { stdout: 'pipe', stderr: 'pipe' })
    expect(await tar.exited).toBe(0)
    const archive = await readFile(join(root, 'fixture.tgz'))
    server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch(request) {
      const url = new URL(request.url)
      if (url.pathname === '/fixture.tgz') return new Response(archive)
      if (url.pathname === '/offline-project-fixture') return Response.json({ name: 'offline-project-fixture', 'dist-tags': { latest: '1.0.0' }, versions: {
        '1.0.0': { name: 'offline-project-fixture', version: '1.0.0', dist: { tarball: `${url.origin}/fixture.tgz` } }
      } })
      return new Response('unknown local fixture', { status: 404 })
    } })
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'offline-consumer', dependencies: { 'offline-project-fixture': '1.0.0' }, scripts: {
      postinstall: `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 bun --no-env-file ${JSON.stringify(HELPER)} --project-root .`
    } }))
    await writeFile(join(root, 'bunfig.toml'), `[install]\nregistry="http://127.0.0.1:${server.port}"\nlinker="isolated"\n[install.cache]\ndir="runtime/cache/bun"\n`)
    await mkdir(join(root, 'private-home'))
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: join(root, 'private-home'), BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0' }
    delete env['BUN_INSTALL_CACHE_DIR']
    delete env['BUN_INSTALL']
    for (const args of [['install'], ['install', '--frozen-lockfile']]) {
      const child = await runFixtureCommand([process.execPath, '--no-env-file', ...args], root, env)
      expect(child.exitCode, child.stderr).toBe(0)
      await validateProjectRuntimeDependencies({ projectRoot: root })
      expect(await readlink(join(root, 'node_modules'))).toBe('runtime/tools/project-dependencies/node_modules')
    }
    expect((await lstat(join(root, 'runtime/cache/bun'))).isDirectory()).toBe(true)
    expect(await Bun.file(join(root, 'private-home/.bun/install/cache')).exists()).toBe(false)
    // Clearing disposable runtime data can leave the source lookup alias dangling.
    await rm(join(root, 'runtime/tools/project-dependencies'), { recursive: true })
    const restored = await runFixtureCommand([process.execPath, '--no-env-file', HELPER, '--project-root', root, '--install', '--offline'], root, env)
    expect(restored.exitCode, restored.stderr).toBe(0)
    await validateProjectRuntimeDependencies({ projectRoot: root })
    // A no-op native install cannot turn changed transitive/package bytes into trusted bytes.
    const changedFile = join(root, 'node_modules/offline-project-fixture/index.js')
    await writeFile(changedFile, 'export default "modified after install"\n')
    const changed = await runFixtureCommand([process.execPath, '--no-env-file', 'install', '--frozen-lockfile'], root, env)
    expect(changed.exitCode, changed.stderr).not.toBe(0)
    expect(await readFile(changedFile, 'utf8')).toBe('export default "modified after install"\n')
    await expect(validateProjectRuntimeDependencies({ projectRoot: root })).rejects.toThrow('differ from their receipt')
    const repair = await runFixtureCommand([process.execPath, '--no-env-file', HELPER, '--project-root', root, '--install', '--offline'], root, env)
    expect(repair.exitCode, repair.stderr).toBe(0)
    expect(await readFile(changedFile, 'utf8')).toBe('export default "local fixture"\n')
    await validateProjectRuntimeDependencies({ projectRoot: root })
    const parent = join(root, 'runtime/tools/project-dependencies')
    const backups = (await readdir(parent)).filter(name => name.startsWith('previous-'))
    expect(backups.length).toBeGreaterThan(0)
    expect((await Promise.all(backups.map(name => Bun.file(join(parent, name, 'node_modules/offline-project-fixture/index.js')).text().catch(() => '')))).some(text => text.includes('modified after install'))).toBe(true)
    const beforeFailure = await snapshotProjectDependencyGraph(graphPath(root))
    await expect(installProjectRuntimeDependencies({ projectRoot: root, offline: true, onCheckpoint: checkpoint => {
      if (checkpoint === 'graph-moved') throw new Error('injected installation activation failure')
    } })).rejects.toThrow('injected installation activation failure')
    expect(await snapshotProjectDependencyGraph(graphPath(root))).toEqual(beforeFailure)
    await validateProjectRuntimeDependencies({ projectRoot: root })
    // The explicit lifecycle opt-out remains effective until the standalone bootstrap is invoked.
    await unlink(join(root, 'node_modules'))
    await rm(join(root, 'runtime/tools/project-dependencies'), { recursive: true })
    const optedOut = await runFixtureCommand([process.execPath, '--no-env-file', 'install', '--frozen-lockfile', '--ignore-scripts'], root, env)
    expect(optedOut.exitCode, optedOut.stderr).toBe(0)
    expect((await lstat(join(root, 'node_modules'))).isSymbolicLink()).toBe(false)
    await expect(validateProjectRuntimeDependencies({ projectRoot: root })).rejects.toThrow('relative runtime lookup alias')
    await ensureProjectRuntimeDependencies({ projectRoot: root })
    await validateProjectRuntimeDependencies({ projectRoot: root })
  } finally { server?.stop(true); await rm(root, { recursive: true, force: true }) }
}, 30000)
