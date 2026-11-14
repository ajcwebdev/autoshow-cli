import { expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, rename, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inspectImmutableApplication } from '~/tools/docker-installed-dependencies'
import { inspectFirstUse } from '~/tools/docker-first-use'

const ownerUid = process.getuid!()
const policy = { ownerUid, checkWriteAccess: false }
const withApplication = async (run: (root: string) => Promise<void>) => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-permission-fixture-'))
  try {
    await chmod(root, 0o755)
    for (const path of ['src/nested', 'runtime/tools/project-dependencies/node_modules/.store/package', 'config/defuddle', 'config/stt-alignment', 'runtime/tools/stt-alignment/node_modules/onnxruntime-node']) {
      await mkdir(join(root, path), { recursive: true })
    }
    for (const path of ['src/nested/entry.ts', 'src/nested/compiled-dependency.js', 'runtime/tools/project-dependencies/node_modules/.store/package/index.js', 'config/defuddle/package.json', 'config/stt-alignment/package.json', 'config/stt-alignment/bun.lock', 'runtime/tools/stt-alignment/package.json', 'runtime/tools/stt-alignment/node_modules/onnxruntime-node/package.json', 'package.json', 'bun.lock', 'bunfig.toml', 'tsconfig.json']) {
      await writeFile(join(root, path), '{}\n', { mode: 0o644 })
      await chmod(join(root, path), 0o644)
    }
    await symlink('.store/package', join(root, 'runtime/tools/project-dependencies/node_modules/package'))
    await symlink('runtime/tools/project-dependencies/node_modules', join(root, 'node_modules'))
    await symlink('../runtime/autoshow.json', join(root, 'config/autoshow.json'))
    await run(root)
  } finally {
    await chmod(join(root, 'src/nested'), 0o755).catch(() => {})
    await rm(root, { recursive: true, force: true })
  }
}

test('immutable traversal covers nested dependencies and frozen alignment templates while accepting runtime state', async () => withApplication(async root => {
  const result = await inspectImmutableApplication(root, policy)
  expect(result.alignment).toBe(true)
  expect(result.checkedPaths).toBeGreaterThan(15)
  await writeFile(join(root, 'runtime/autoshow.json'), '{}\n', { mode: 0o666 })
  expect(await inspectImmutableApplication(root, policy)).toEqual(result)
}))

test('frozen alignment templates alone do not count as an installed runtime backend', async () => withApplication(async root => {
  await rm(join(root, 'runtime/tools/stt-alignment'), { recursive: true })
  expect((await inspectImmutableApplication(root, policy)).alignment).toBe(false)
}))

for (const invalid of [
  { name: 'nested group-write source', path: 'src/nested/entry.ts', mode: 0o664, issue: /group\/other writes/ },
  { name: 'nested other-write bundled dependency asset', path: 'src/nested/compiled-dependency.js', mode: 0o646, issue: /group\/other writes/ },
  { name: 'group-write frozen alignment manifest', path: 'config/stt-alignment/bun.lock', mode: 0o775, issue: /group\/other writes/ },
  { name: 'unreadable source', path: 'src/nested/entry.ts', mode: 0o600, issue: /readable\/traversable/ },
  { name: 'untraversable source directory', path: 'src/nested', mode: 0o744, issue: /readable\/traversable/ }
]) {
  test(`immutable traversal rejects ${invalid.name}`, async () => withApplication(async root => {
    await chmod(join(root, invalid.path), invalid.mode)
    await expect(inspectImmutableApplication(root, policy)).rejects.toThrow(invalid.issue)
  }))
}

test('immutable traversal checks ownership independently of runtime write access', async () => withApplication(async root => {
  await expect(inspectImmutableApplication(root, { ownerUid: ownerUid + 1, checkWriteAccess: false })).rejects.toThrow(/unexpected owner/)
  await expect(inspectImmutableApplication(root, { ownerUid })).rejects.toThrow(/Runtime can modify/)
}))

test('immutable traversal rejects a writable application root that permits replacing protected descendants', async () => withApplication(async root => {
  await chmod(root, 0o777)
  await expect(inspectImmutableApplication(root, policy)).rejects.toThrow(/group\/other writes: \./)
}))

test('immutable traversal rejects symlink routes through writable state even when their final target is immutable', async () => withApplication(async root => {
  await symlink('../src/nested/entry.ts', join(root, 'runtime/bridge'))
  await symlink('../runtime/bridge', join(root, 'src/bridge'))
  await expect(inspectImmutableApplication(root, policy)).rejects.toThrow(/link escapes/)
}))

test('immutable traversal rejects a symlink route through the exempt configuration link', async () => withApplication(async root => {
  await mkdir(join(root, 'runtime/autoshow.json'))
  await symlink('../../src/nested/entry.ts', join(root, 'runtime/autoshow.json/bridge'))
  await symlink('../config/autoshow.json/bridge', join(root, 'src/bridge'))
  await expect(inspectImmutableApplication(root, policy)).rejects.toThrow(/link escapes/)
}))

test('immutable traversal rejects directory roots replaced with links', async () => withApplication(async root => {
  await rm(join(root, 'src'), { recursive: true })
  await symlink('config', join(root, 'src'))
  await expect(inspectImmutableApplication(root, policy)).rejects.toThrow(/actual directory/)
}))

test('immutable traversal accepts a managed dependency generation while retaining its mutable installation role', async () => withApplication(async root => {
  const installed = join(root, 'runtime/tools/project-dependencies')
  const generation = join(root, 'runtime/tools/generations/one/project-dependencies')
  await mkdir(join(root, 'runtime/tools/generations/one'), { recursive: true })
  await rename(installed, generation)
  await symlink('generations/one/project-dependencies', installed)
  await chmod(join(generation, 'node_modules/.store/package/index.js'), 0o666)
  expect((await inspectImmutableApplication(root, policy)).alignment).toBe(true)
}))

for (const target of ['src', './runtime/tools/project-dependencies/node_modules', '/tmp', 'runtime']) {
  test(`immutable traversal rejects an unexpected root dependency alias ${target}`, async () => withApplication(async root => {
    await unlink(join(root, 'node_modules'))
    await symlink(target, join(root, 'node_modules'))
    await expect(inspectImmutableApplication(root, policy)).rejects.toThrow(/relative managed runtime alias/)
  }))
}

test('immutable traversal rejects a dependency alias replaced with a writable installation directory', async () => withApplication(async root => {
  await unlink(join(root, 'node_modules'))
  await mkdir(join(root, 'node_modules'))
  await expect(inspectImmutableApplication(root, policy)).rejects.toThrow(/relative managed runtime alias/)
}))

test('immutable traversal rejects dependency routing outside runtime even when its final target returns inside', async () => withApplication(async root => {
  const installed = join(root, 'runtime/tools/project-dependencies')
  await rename(installed, join(root, 'runtime/tools/retained-dependencies'))
  await symlink('runtime/tools/retained-dependencies', join(root, 'external-bridge'))
  await symlink('../../external-bridge', installed)
  await expect(inspectImmutableApplication(root, policy)).rejects.toThrow(/alias route escapes runtime/)
}))

for (const target of ['../runtime', 'missing', '/tmp']) {
  test(`immutable traversal rejects a dependency link to ${target}`, async () => withApplication(async root => {
    await symlink(target, join(root, 'src/invalid-link'))
    await expect(inspectImmutableApplication(root, policy)).rejects.toThrow(/link escapes|not resolvable/)
  }))
}

test('immutable traversal rejects replacing the writable state link with a file or another target', async () => withApplication(async root => {
  const link = join(root, 'config/autoshow.json')
  await unlink(link)
  await writeFile(link, '{}\n')
  await expect(inspectImmutableApplication(root, policy)).rejects.toThrow(/must use the runtime link/)
  await unlink(link)
  await symlink('../runtime/other.json', link)
  await expect(inspectImmutableApplication(root, policy)).rejects.toThrow(/Unexpected writable configuration link/)
}))

test('first-use probe installs and imports a local synthetic package using an explicit runtime cache and unchanged HOME', async () => {
  const home = await mkdtemp(join(tmpdir(), 'autoshow-first-home-'))
  const cacheDirectory = join(home, 'runtime/cache/bun')
  try { expect(await inspectFirstUse(home, { cacheDirectory })).toMatchObject({ status: 'passed', localPackageInstall: true, originalHome: true }) }
  finally { await rm(home, { recursive: true, force: true }) }
})

test('first-use probe rejects an unwritable runtime Bun cache instead of falling back to HOME', async () => {
  const home = await mkdtemp(join(tmpdir(), 'autoshow-blocked-home-'))
  const cache = join(home, 'runtime/cache/bun')
  try {
    await mkdir(cache, { recursive: true })
    await chmod(cache, 0o555)
    await expect(inspectFirstUse(home, { cacheDirectory: cache })).rejects.toThrow(/first-use local dependency install failed/)
  } finally {
    await chmod(cache, 0o755)
    await rm(home, { recursive: true, force: true })
  }
})
