import { afterAll, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { chmod, link, lstat, mkdir, readFile, readdir, symlink, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildMediaConsolidationPlan, prepareMediaConsolidation, verifyMediaConsolidation, type MediaConsolidationConfig } from '~/tools/prepare-media-consolidation'
import { createTempDirTracker } from '../../../test-utils/temp-dirs'

const tempDirs = createTempDirTracker('autoshow-media-consolidation-')
afterAll(async () => await tempDirs.cleanup())

const fixture = async () => {
  const root = await tempDirs.make()
  await mkdir(join(root, 'scene/inputs'), { recursive: true })
  await mkdir(join(root, 'canonical'), { recursive: true })
  await writeFile(join(root, 'scene/inputs/a.png'), 'same immutable bytes')
  await writeFile(join(root, 'scene/inputs/b.png'), 'distinct original bytes')
  await writeFile(join(root, 'canonical/z.png'), 'same immutable bytes')
  await writeFile(join(root, 'scene/manifest.json'), '{"source":"inputs/a.png"}')
  const config: MediaConsolidationConfig = { schemaVersion: 1, groups: [{ id: 'panels', roots: ['scene/inputs'], keeperRoots: ['canonical'], extensions: ['.png'] }], preservationRoots: ['scene/manifest.json'] }
  const saveConfig = async () => await writeFile(join(root, 'scope.json'), JSON.stringify(config))
  await saveConfig()
  return { root, config, saveConfig, prepare: async () => await prepareMediaConsolidation(root, 'scope.json', 'prepared'), verify: async () => await verifyMediaConsolidation(root, 'prepared/plan.json') }
}

test('preparation fingerprints media and metadata without deleting or replacing source files', async () => {
  const context = await fixture()
  const paths = ['scene/inputs/a.png', 'scene/inputs/b.png', 'canonical/z.png', 'scene/manifest.json', 'scope.json']
  const before = await Promise.all(paths.map(async path => ({ path, bytes: await readFile(join(context.root, path)), stat: await lstat(join(context.root, path)) })))
  const plan = await context.prepare()
  expect(plan.summary).toMatchObject({ mediaFiles: 3, uniqueContentFiles: 2, plannedReplacementFiles: 1, plannedReplacementBytes: 20, preservationFiles: 2 })
  expect(plan.mediaFiles.find(row => row.path === 'scene/inputs/a.png')).toMatchObject({ sourceKind: 'target', plannedReplacement: true, keeperPath: 'canonical/z.png' })
  expect(plan.mediaFiles.find(row => row.path === 'canonical/z.png')).toMatchObject({ sourceKind: 'keeper', plannedReplacement: false })
  expect(await context.verify()).toEqual(plan.summary)
  for (const item of before) {
    expect(await readFile(join(context.root, item.path))).toEqual(item.bytes)
    const after = await lstat(join(context.root, item.path))
    expect([after.ino, after.mode, after.mtimeMs, after.nlink]).toEqual([item.stat.ino, item.stat.mode, item.stat.mtimeMs, item.stat.nlink])
  }
  expect((await readdir(join(context.root, 'prepared'))).sort()).toEqual(['plan.json', 'plan.sha256', 'sources.contents.sha256', 'sources.files0', 'verification.json'])
  const packedPaths = (await readFile(join(context.root, 'prepared/sources.files0'), 'utf8')).split('\0').filter(Boolean)
  expect(packedPaths).toEqual(paths.sort())
  expect(await readFile(join(context.root, 'prepared/plan.json'), 'utf8')).not.toContain(context.root)
})

test('lexical duplicate keeper selection is deterministic without explicit keeper roots', async () => {
  const context = await fixture()
  delete context.config.groups[0]!.keeperRoots
  context.config.groups[0]!.roots.push('canonical')
  await context.saveConfig()
  const first = await buildMediaConsolidationPlan(context.root, 'scope.json')
  const second = await buildMediaConsolidationPlan(context.root, 'scope.json')
  expect(first.duplicateSets).toEqual(second.duplicateSets)
  expect(first.duplicateSets[0]?.keeperPath).toBe('canonical/z.png')
})

test('keeper roots may overlap targets in their own group and never become replacement targets', async () => {
  const context = await fixture()
  context.config.groups[0]!.roots = ['scene']
  context.config.groups[0]!.keeperRoots = ['scene/inputs']
  await context.saveConfig()
  const plan = await context.prepare()
  expect(plan.mediaFiles.every(row => row.sourceKind === 'keeper' && !row.plannedReplacement)).toBe(true)
})

test('verification rejects same-length changed media and missing media', async () => {
  const changed = await fixture()
  await changed.prepare()
  await writeFile(join(changed.root, 'scene/inputs/a.png'), 'Same immutable bytes')
  await expect(changed.verify()).rejects.toThrow('baseline mismatch')
  const missing = await fixture()
  await missing.prepare()
  await unlink(join(missing.root, 'canonical/z.png'))
  await expect(missing.verify()).rejects.toThrow('baseline mismatch')
})

test('verification rejects metadata, mode, config, and companion artifact changes', async () => {
  for (const mutate of [
    async (root: string) => await writeFile(join(root, 'scene/manifest.json'), '{"source":"changed"}'),
    async (root: string) => await chmod(join(root, 'scene/inputs/a.png'), 0o600),
    async (root: string) => await writeFile(join(root, 'scope.json'), JSON.stringify({ schemaVersion: 1, groups: [{ id: 'other', roots: ['canonical'], extensions: ['.png'] }] })),
    async (root: string) => await writeFile(join(root, 'prepared/sources.files0'), 'canonical/z.png\0')
  ]) {
    const context = await fixture()
    await context.prepare()
    await mutate(context.root)
    await expect(context.verify()).rejects.toThrow()
  }
})

test('verification rejects tampered plan both before and after recomputing its outer checksum', async () => {
  const context = await fixture()
  const plan = await context.prepare()
  plan.mediaFiles[0]!.plannedReplacement = true
  const bytes = `${JSON.stringify(plan, null, 2)}\n`
  await writeFile(join(context.root, 'prepared/plan.json'), bytes)
  await expect(context.verify()).rejects.toThrow('checksum mismatch')
  await writeFile(join(context.root, 'prepared/plan.sha256'), `${createHash('sha256').update(bytes).digest('hex')}  plan.json\n`)
  await expect(context.verify()).rejects.toThrow('baseline mismatch')
})

test('source symlinks and symlink parents fail closed without creating output', async () => {
  for (const directoryLink of [false, true]) {
    const context = await fixture()
    if (directoryLink) {
      await symlink(join(context.root, 'canonical'), join(context.root, 'alias'))
      context.config.groups[0]!.roots = ['alias/z.png']
    } else {
      await symlink(join(context.root, 'canonical/z.png'), join(context.root, 'scene/inputs/link.png'))
    }
    await context.saveConfig()
    await expect(context.prepare()).rejects.toThrow('Symlinks are not accepted')
    expect((await readdir(context.root)).includes('prepared')).toBe(false)
  }
})

test('symlink outputs and symlink plans are rejected', async () => {
  const context = await fixture()
  await symlink(join(context.root, 'canonical'), join(context.root, 'prepared'))
  await expect(context.prepare()).rejects.toThrow('Symlinks are not accepted')
  const other = await fixture()
  await other.prepare()
  await symlink(join(other.root, 'prepared'), join(other.root, 'prepared-alias'))
  await expect(verifyMediaConsolidation(other.root, 'prepared-alias/plan.json')).rejects.toThrow('Symlinks are not accepted')
})

test('absolute, traversing, protected, and secret scope paths are rejected', async () => {
  for (const path of ['/outside/file.png', '../outside.png', 'scene/../canonical', 'C:/outside.png', 'scene\\outside.png', '.autoshow/assets', '.env', 'credentials.json', 'scene/private.key', 'protected-voice-assets']) {
    const context = await fixture()
    context.config.groups[0]!.roots = [path]
    await context.saveConfig()
    await expect(context.prepare()).rejects.toThrow()
  }
})

test('overlapping groups, duplicate group ids, and nonmedia selections are rejected', async () => {
  const overlap = await fixture()
  overlap.config.groups.push({ id: 'nested', roots: ['scene/inputs/a.png'], extensions: ['.png'] })
  await overlap.saveConfig()
  await expect(overlap.prepare()).rejects.toThrow('Overlapping media roots')
  const duplicate = await fixture()
  duplicate.config.groups.push({ id: 'panels', roots: ['elsewhere'], extensions: ['.png'] })
  await duplicate.saveConfig()
  await expect(duplicate.prepare()).rejects.toThrow('group id')
  const nonmedia = await fixture()
  nonmedia.config.groups[0]!.roots = ['scene/manifest.json']
  await nonmedia.saveConfig()
  await expect(nonmedia.prepare()).rejects.toThrow('Nonmedia file selected')
})

test('output/source overlap, config/output overlap, and existing output files are rejected', async () => {
  const context = await fixture()
  await expect(prepareMediaConsolidation(context.root, 'scope.json', 'scene/inputs/prepared')).rejects.toThrow('Output overlaps')
  await expect(prepareMediaConsolidation(context.root, 'scope.json', 'scene')).rejects.toThrow('Output overlaps')
  await expect(prepareMediaConsolidation(context.root, 'scope.json', 'scope.json')).rejects.toThrow('Output overlaps')
  await context.prepare()
  await expect(context.prepare()).rejects.toThrow('must be absent or empty')
})

test('a newly added source fails baseline verification instead of silently widening an old plan', async () => {
  const context = await fixture()
  await context.prepare()
  await writeFile(join(context.root, 'scene/inputs/new.png'), 'new media')
  await expect(context.verify()).rejects.toThrow('baseline mismatch')
})

test('unsupported media extensions and unselected preservation media fail closed', async () => {
  const context = await fixture()
  context.config.groups[0]!.extensions = ['.json']
  await context.saveConfig()
  await expect(context.prepare()).rejects.toThrow('Nonmedia extension')
  const other = await fixture()
  await writeFile(join(other.root, 'scene/other.wav'), 'unselected paid audio')
  other.config.preservationRoots = ['scene']
  await other.saveConfig()
  await expect(other.prepare()).rejects.toThrow('Unselected media file')
})

test('explicit metadata extension filters preserve metadata without selecting unrelated media', async () => {
  const context = await fixture()
  await writeFile(join(context.root, 'scene/other.wav'), 'unselected paid audio')
  context.config.preservationRoots = ['scene']
  context.config.preservationExtensions = ['.json']
  await context.saveConfig()
  const plan = await context.prepare()
  expect(plan.preservedFiles.map(row => row.path)).toEqual(['scene/manifest.json', 'scope.json'])
  expect(await context.verify()).toEqual(plan.summary)
})

test('existing hardlinked targets require extra review and are never planned replacements', async () => {
  const context = await fixture()
  await link(join(context.root, 'scene/inputs/a.png'), join(context.root, 'outside-group.png'))
  const plan = await context.prepare()
  expect(plan.mediaFiles.find(row => row.path === 'scene/inputs/a.png')).toMatchObject({ nlink: 2, plannedReplacement: false, requiresExtraReview: true, replacementBlockedReason: 'source-has-hardlinks' })
  expect(plan.summary).toMatchObject({ plannedReplacementFiles: 0, blockedReplacementFiles: 1, blockedReplacementBytes: 20 })
  expect(await context.verify()).toEqual(plan.summary)
})
