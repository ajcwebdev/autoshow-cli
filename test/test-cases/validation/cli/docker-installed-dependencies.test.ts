import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { inspectInstalledDependencies } from '~/tools/docker-installed-dependencies'

const repositoryRoot = resolve(import.meta.dir, '../../../..')
const fixtureName = '@fixture/offline-module'
const fixtureVersion = '1.2.3'
const fixtureDirectory = (root: string): string => join(root, 'node_modules', fixtureName)
const withRoot = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-installed-dependencies-'))
  try { await run(root) } finally { await rm(root, { recursive: true, force: true }) }
}
const writeJson = async (path: string, value: unknown): Promise<void> => { await writeFile(path, JSON.stringify(value)) }
const writeFixtureGraph = async (root: string): Promise<void> => {
  await mkdir(fixtureDirectory(root), { recursive: true })
  await writeJson(join(root, 'package.json'), { private: true, dependencies: { [fixtureName]: fixtureVersion } })
  await writeJson(join(root, 'bun.lock'), { packages: { [fixtureName]: [`${fixtureName}@${fixtureVersion}`] } })
  await writeJson(join(fixtureDirectory(root), 'package.json'), { name: fixtureName, version: fixtureVersion, type: 'module', main: './index.js' })
  await writeFile(join(fixtureDirectory(root), 'index.js'), 'export const ready = true;\n')
}
const snapshotFixtureArtifacts = (root: string): Promise<Array<string | null>> => Promise.all([
  join(root, 'package.json'), join(root, 'bun.lock'), join(fixtureDirectory(root), 'package.json'), join(fixtureDirectory(root), 'index.js')
].map(async path => {
  try { return await readFile(path, 'utf8') } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}))

test('installed-image inventory imports the actual production graph and preserves the shipped manifests', async () => withRoot(async root => {
  const manifestText = await readFile(join(repositoryRoot, 'package.json'), 'utf8')
  const lockText = await readFile(join(repositoryRoot, 'bun.lock'), 'utf8')
  const manifest = JSON.parse(manifestText) as { dependencies: Record<string, string> }
  await writeFile(join(root, 'package.json'), manifestText)
  await writeFile(join(root, 'bun.lock'), lockText)
  for (const name of Object.keys(manifest.dependencies)) {
    const destination = join(root, 'node_modules', name)
    await mkdir(resolve(destination, '..'), { recursive: true })
    await cp(join(repositoryRoot, 'node_modules', name), destination, {
      recursive: true,
      dereference: true,
      filter: source => basename(source) !== '.DS_Store'
    })
  }
  expect(await inspectInstalledDependencies(root)).toEqual(Object.entries(manifest.dependencies).map(([name, version]) => ({ name, version })))
  const valibot = await import(join(root, 'node_modules/valibot')) as typeof import('valibot')
  const converter = await import(join(root, 'node_modules/@valibot/to-json-schema')) as typeof import('@valibot/to-json-schema')
  const schema = valibot.object({ title: valibot.string() })
  expect(valibot.parse(schema, { title: 'Offline image' })).toEqual({ title: 'Offline image' })
  expect(converter.toJsonSchema(schema)).toMatchObject({ type: 'object', properties: { title: { type: 'string' } } })
  expect(await readFile(join(root, 'package.json'), 'utf8')).toBe(manifestText)
  expect(await readFile(join(root, 'bun.lock'), 'utf8')).toBe(lockText)
}))

test('installed-image inventory accepts an independently constructed importable frozen package', async () => withRoot(async root => {
  await writeFixtureGraph(root)
  expect(await inspectInstalledDependencies(root)).toEqual([{ name: fixtureName, version: fixtureVersion }])
}))

const rejectedArtifacts: Array<{ name: string, corrupt: (root: string) => Promise<void>, message: string | RegExp }> = [
  { name: 'missing root manifest', corrupt: root => rm(join(root, 'package.json')), message: /ENOENT/ },
  { name: 'malformed root manifest', corrupt: root => writeFile(join(root, 'package.json'), '{invalid'), message: /JSON|Expected|Unexpected|parse/i },
  { name: 'missing frozen lock', corrupt: root => rm(join(root, 'bun.lock')), message: /ENOENT/ },
  { name: 'malformed frozen lock', corrupt: root => writeFile(join(root, 'bun.lock'), '{invalid'), message: /JSON|Expected|Unexpected|parse/i },
  { name: 'dependency absent from frozen lock', corrupt: root => writeJson(join(root, 'bun.lock'), { packages: {} }), message: /does not match the frozen graph/ },
  { name: 'different frozen dependency version', corrupt: root => writeJson(join(root, 'bun.lock'), { packages: { [fixtureName]: [`${fixtureName}@9.9.9`] } }), message: /does not match the frozen graph/ },
  { name: 'missing installed package', corrupt: root => rm(fixtureDirectory(root), { recursive: true }), message: /ENOENT/ },
  { name: 'malformed installed manifest', corrupt: root => writeFile(join(fixtureDirectory(root), 'package.json'), '{invalid'), message: /JSON|Expected|Unexpected|parse/i },
  { name: 'different installed package identity', corrupt: root => writeJson(join(fixtureDirectory(root), 'package.json'), { name: 'different-package', version: fixtureVersion }), message: /does not match the frozen graph/ },
  { name: 'different installed package version', corrupt: root => writeJson(join(fixtureDirectory(root), 'package.json'), { name: fixtureName, version: '9.9.9' }), message: /does not match the frozen graph/ },
  { name: 'missing module artifact', corrupt: root => rm(join(fixtureDirectory(root), 'index.js')), message: /Cannot find|ModuleNotFound|resolve/i },
  { name: 'module artifact that fails evaluation', corrupt: root => writeFile(join(fixtureDirectory(root), 'index.js'), 'throw new Error("installed module evaluation failed");\n'), message: 'installed module evaluation failed' },
  { name: 'module artifact with no exports', corrupt: root => writeFile(join(fixtureDirectory(root), 'index.js'), 'export {};\n'), message: /Empty production import/ }
]

for (const artifact of rejectedArtifacts) {
  test(`installed-image inventory rejects ${artifact.name} without repairing it`, async () => withRoot(async root => {
    await writeFixtureGraph(root)
    await artifact.corrupt(root)
    const before = await snapshotFixtureArtifacts(root)
    await expect(inspectInstalledDependencies(root)).rejects.toThrow(artifact.message)
    expect(await snapshotFixtureArtifacts(root)).toEqual(before)
  }))
}
