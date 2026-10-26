import { afterAll, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { chmod, copyFile, link, lstat, mkdir, readFile, realpath, symlink, unlink, utimes, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { execFileSync } from 'node:child_process'
import { applyMediaConsolidation, createNativeMediaCloneAdapter, resumeMediaConsolidation, verifyAppliedMediaConsolidation, type MediaCloneAdapter } from '~/tools/apply-media-consolidation'
import { prepareMediaConsolidation } from '~/tools/prepare-media-consolidation'
import { acquireProjectMaintenanceLease } from '~/utils/project-maintenance-lease'
import { createTempDirTracker } from '../../../test-utils/temp-dirs'

const temporary = createTempDirTracker('autoshow-media-application-')
afterAll(async () => await temporary.cleanup())
const hash = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex')
const fakeAdapter: MediaCloneAdapter = {
  async capture(root, path) {
    const stat = await lstat(join(root, path), { bigint: true })
    if (!stat.isFile()) throw new Error('Not a regular file')
    return { path, sha256: hash(await readFile(join(root, path))), dev: Number(stat.dev), ino: Number(stat.ino), nlink: Number(stat.nlink), mode: Number(stat.mode & 0o7777n), uid: Number(stat.uid), gid: Number(stat.gid), mtimeNs: String(stat.mtimeNs), ctimeNs: String(stat.ctimeNs), flags: 0, xattrSha256: {}, acl: [] }
  },
  async clone(source, target) { await copyFile(source, target) },
  async copyMetadata(source, target) {
    const stat = await lstat(source)
    await chmod(target, stat.mode & 0o7777)
    await utimes(target, stat.atime, stat.mtime)
  }
}
const lease = async () => ({ assertHeld: async () => undefined, release: async () => undefined })
const fixture = async (secondDuplicate = false, thirdDuplicate = false) => {
  const root = await temporary.make()
  await mkdir(join(root, 'scene'))
  await mkdir(join(root, 'canonical'))
  await writeFile(join(root, 'scene/a.png'), 'identical immutable media')
  await writeFile(join(root, 'scene/b.png'), 'different independent media')
  await writeFile(join(root, 'canonical/a.png'), 'identical immutable media')
  if (secondDuplicate) { await writeFile(join(root, 'scene/c.png'), 'identical immutable media'); await utimes(join(root, 'scene/c.png'), 1_700_000_000, 1_700_000_001) }
  if (thirdDuplicate) { await writeFile(join(root, 'scene/d.png'), 'identical immutable media'); await utimes(join(root, 'scene/d.png'), 1_700_000_000, 1_700_000_001) }
  await writeFile(join(root, 'scene/manifest.json'), '{"record":"unchanged"}')
  for (const path of ['scene/a.png', 'scene/b.png', 'canonical/a.png']) await utimes(join(root, path), 1_700_000_000, 1_700_000_001)
  await chmod(join(root, 'scene/a.png'), 0o640)
  await writeFile(join(root, 'scope.json'), JSON.stringify({ schemaVersion: 1, groups: [{ id: 'media', roots: ['scene'], keeperRoots: ['canonical'], extensions: ['.png'] }], preservationRoots: ['scene/manifest.json'] }))
  const plan = await prepareMediaConsolidation(root, 'scope.json', 'prepared')
  const native = { files: await Promise.all(plan.mediaFiles.map(row => fakeAdapter.capture(root, row.path))) }
  await writeFile(join(root, 'prepared/native-metadata.json'), JSON.stringify(native))
  return { root, plan, native, apply: async (extra = {}) => await applyMediaConsolidation(root, 'prepared/plan.json', 'applied', { adapter: fakeAdapter, acquireLease: lease, ...extra }), verify: async () => await verifyAppliedMediaConsolidation(root, 'applied/receipt.json', fakeAdapter) }
}

const protectedAttributeFixture = async (second = false, third = false) => {
  const context = await fixture(second, third), attributes = new Map<number, string>()
  const setClass = async (path: string, value: string) => attributes.set((await lstat(join(context.root, path))).ino, hash(value))
  for (const row of context.plan.mediaFiles) await setClass(row.path, row.path === 'canonical/a.png' || third && row.path === 'scene/a.png' ? 'class-a' : 'class-b')
  const adapter: MediaCloneAdapter = {
    async capture(root, path) {
      const result = await fakeAdapter.capture(root, path)
      return { ...result, xattrSha256: { 'com.apple.provenance': attributes.get(result.ino)! } }
    },
    async clone(source, target) {
      await fakeAdapter.clone(source, target)
      attributes.set((await lstat(target)).ino, attributes.get((await lstat(source)).ino)!)
    },
    // Simulate a successful metadata syscall that silently ignores protected provenance.
    copyMetadata: fakeAdapter.copyMetadata
  }
  await writeFile(join(context.root, 'prepared/native-metadata.json'), JSON.stringify({ files: await Promise.all(context.plan.mediaFiles.map(row => adapter.capture(context.root, row.path))) }))
  return { ...context, adapter, setClass }
}

const kernelAssignmentFixture = async (otherAttribute?: string, changedAfterCopy = false, inventedAssignment = false) => {
  const context = await protectedAttributeFixture(), otherValues = new Map<number, string>()
  if (otherAttribute) for (const row of context.plan.mediaFiles) otherValues.set((await lstat(join(context.root, row.path))).ino, hash('expected-other-attribute'))
  const adapter: MediaCloneAdapter = {
    async capture(root, path) {
      const value = await context.adapter.capture(root, path)
      return otherAttribute ? { ...value, xattrSha256: { ...value.xattrSha256, [otherAttribute]: otherValues.get(value.ino)! } } : value
    },
    async clone(source, destination) {
      await context.adapter.clone(source, destination)
      const clonePath = relative(await realpath(context.root), destination)
      await context.setClass(clonePath, 'native-kernel-assignment')
      if (otherAttribute) otherValues.set((await lstat(destination)).ino, hash('unexpected-other-attribute'))
      return { assignment: 'clonefile(2)', kernelAssignedXattrs: { 'com.apple.provenance': hash(inventedAssignment ? 'operator-invented' : 'native-kernel-assignment') } }
    },
    async copyMetadata(original, destination) {
      await fakeAdapter.copyMetadata(original, destination)
      if (changedAfterCopy) await context.setClass(relative(await realpath(context.root), destination), 'changed-after-copy')
    }
  }
  await writeFile(join(context.root, 'prepared/native-metadata.json'), JSON.stringify({ files: await Promise.all(context.plan.mediaFiles.map(row => adapter.capture(context.root, row.path))) }))
  return { ...context, adapter }
}

test('application keeps required paths and metadata, changes only authorized inode, and verifies receipt', async () => {
  const context = await fixture(), before = await fakeAdapter.capture(context.root, 'scene/a.png'), keeper = await fakeAdapter.capture(context.root, 'canonical/a.png')
  const originalPlan = await readFile(join(context.root, 'prepared/plan.json')), metadata = await readFile(join(context.root, 'scene/manifest.json'))
  const result = await context.apply()
  expect(result.status).toBe('complete')
  expect(result.appliedFiles).toHaveLength(1)
  expect(result.logicalReplacementBytes).toBe(Buffer.byteLength('identical immutable media'))
  const after = await fakeAdapter.capture(context.root, 'scene/a.png')
  expect(after.ino).not.toBe(before.ino)
  expect(after.ino).not.toBe(keeper.ino)
  expect([after.sha256, after.mode, after.uid, after.gid, after.mtimeNs]).toEqual([before.sha256, before.mode, before.uid, before.gid, before.mtimeNs])
  expect(await fakeAdapter.capture(context.root, 'canonical/a.png')).toEqual(keeper)
  expect(await readFile(join(context.root, 'prepared/plan.json'))).toEqual(originalPlan)
  expect(await readFile(join(context.root, 'scene/manifest.json'))).toEqual(metadata)
  expect(await context.verify()).toMatchObject({ appliedFiles: 1, verifiedMediaFiles: 3, verifiedMetadataFiles: 2 })
  const journal = (await readFile(join(context.root, 'applied/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line))
  expect(journal.map(row => row.phase)).toEqual(['clone-started', 'ready-to-replace', 'replaced-and-verified'])
})

test('clone-backed required paths have independent future writes', async () => {
  const context = await fixture()
  await context.apply()
  await writeFile(join(context.root, 'scene/a.png'), 'changed target content')
  expect(await readFile(join(context.root, 'canonical/a.png'), 'utf8')).toBe('identical immutable media')
  await expect(context.verify()).rejects.toThrow('verification mismatch')
})

test('journal initialization failure releases maintenance without replacing source media', async () => {
  const context = await fixture(), before = await fakeAdapter.capture(context.root, 'scene/a.png')
  await expect(context.apply({ acquireLease: async (root: string) => {
    const held = await acquireProjectMaintenanceLease(root)
    await mkdir(join(root, 'applied/journal.jsonl'))
    return held
  } })).rejects.toMatchObject({ code: 'EEXIST' })
  const next = await acquireProjectMaintenanceLease(context.root)
  try { await next.assertHeld() } finally { await next.release() }
  expect(await fakeAdapter.capture(context.root, 'scene/a.png')).toEqual(before)
})

test('resume rejects a symlink journal before appending and releases maintenance', async () => {
  const context = await fixture(true); let calls = 0
  const adapter: MediaCloneAdapter = { ...fakeAdapter, async clone(source, target) { if (++calls === 2) throw new Error('interrupted clone'); await fakeAdapter.clone(source, target) } }
  await expect(context.apply({ adapter })).rejects.toThrow('interrupted clone')
  const outside = await temporary.make(), destination = join(outside, 'journal.jsonl')
  await writeFile(destination, 'external bytes')
  await unlink(join(context.root, 'applied/journal.jsonl'))
  await symlink(destination, join(context.root, 'applied/journal.jsonl'))
  await expect(resumeMediaConsolidation(context.root, 'applied/receipt.json', { adapter: fakeAdapter })).rejects.toThrow('Symlink rejected')
  expect(await readFile(destination, 'utf8')).toBe('external bytes')
  const next = await acquireProjectMaintenanceLease(context.root)
  try { await next.assertHeld() } finally { await next.release() }
})

test('same-size changed, missing, mode-changed, or inode-replaced media fails before replacement', async () => {
  const mutations = [
    async (root: string) => await writeFile(join(root, 'scene/a.png'), 'Identical immutable media'),
    async (root: string) => await unlink(join(root, 'scene/a.png')),
    async (root: string) => await chmod(join(root, 'scene/a.png'), 0o600),
    async (root: string) => { const bytes = await readFile(join(root, 'scene/a.png')); await unlink(join(root, 'scene/a.png')); await writeFile(join(root, 'scene/a.png'), bytes) }
  ]
  for (const mutate of mutations) {
    const context = await fixture(), keeper = await readFile(join(context.root, 'canonical/a.png'))
    await mutate(context.root)
    await expect(context.apply()).rejects.toThrow()
    expect(await readFile(join(context.root, 'canonical/a.png'))).toEqual(keeper)
    expect(JSON.parse(await readFile(join(context.root, 'applied/receipt.json'), 'utf8')).appliedFiles).toHaveLength(0)
  }
})

test('changed preservation metadata aborts before media mutation', async () => {
  const context = await fixture(), before = await lstat(join(context.root, 'scene/a.png'))
  await writeFile(join(context.root, 'scene/manifest.json'), '{"record":"tampered"}')
  await expect(context.apply()).rejects.toThrow('Preserved metadata changed')
  expect((await lstat(join(context.root, 'scene/a.png'))).ino).toBe(before.ino)
})

test('mutating target immediately before rename is detected without overwriting the new bytes', async () => {
  const context = await fixture()
  await expect(context.apply({ beforeReplace: async () => await writeFile(join(context.root, 'scene/a.png'), 'concurrent user change') })).rejects.toThrow('Source changed before atomic replacement')
  expect(await readFile(join(context.root, 'scene/a.png'), 'utf8')).toBe('concurrent user change')
  const receipt = JSON.parse(await readFile(join(context.root, 'applied/receipt.json'), 'utf8'))
  expect(receipt.status).toBe('failed')
  expect(receipt.appliedFiles).toHaveLength(0)
})

test('unsupported native cloning aborts without replacing source media', async () => {
  const context = await fixture()
  const adapter: MediaCloneAdapter = { ...fakeAdapter, async clone() { throw new Error('native clone unsupported') } }
  await expect(context.apply({ adapter })).rejects.toThrow('native clone unsupported')
  expect(await readFile(join(context.root, 'scene/a.png'), 'utf8')).toBe('identical immutable media')
})

test('a hardlink-producing clone adapter is rejected before it can change keeper metadata', async () => {
  const context = await fixture(), before = await fakeAdapter.capture(context.root, 'canonical/a.png')
  const adapter: MediaCloneAdapter = { ...fakeAdapter, async clone(source, target) { await link(source, target) } }
  await expect(context.apply({ adapter })).rejects.toThrow('not an independent regular file')
  const after = await fakeAdapter.capture(context.root, 'canonical/a.png')
  expect([after.sha256, after.mode, after.mtimeNs]).toEqual([before.sha256, before.mode, before.mtimeNs])
  expect(await readFile(join(context.root, 'scene/a.png'), 'utf8')).toBe('identical immutable media')
})

test('a failed mid-run resumes completed inode changes against the immutable original plan', async () => {
  const context = await fixture(true); let calls = 0
  const adapter: MediaCloneAdapter = { ...fakeAdapter, async clone(source, target) { if (++calls === 2) throw new Error('interrupted clone'); await fakeAdapter.clone(source, target) } }
  const planBytes = await readFile(join(context.root, 'prepared/plan.json'))
  await expect(context.apply({ adapter })).rejects.toThrow('interrupted clone')
  const beforeResume = JSON.parse(await readFile(join(context.root, 'applied/receipt.json'), 'utf8'))
  expect(beforeResume.appliedFiles).toHaveLength(1)
  const firstInode = (await lstat(join(context.root, 'scene/a.png'))).ino
  const result = await resumeMediaConsolidation(context.root, 'applied/receipt.json', { adapter: fakeAdapter, acquireLease: lease })
  expect(result.status).toBe('complete')
  expect(result.appliedFiles).toHaveLength(2)
  expect((await lstat(join(context.root, 'scene/a.png'))).ino).toBe(firstInode)
  expect(await readFile(join(context.root, 'prepared/plan.json'))).toEqual(planBytes)
  expect(await context.verify()).toMatchObject({ appliedFiles: 2 })
})

test('resume reconciles a published inode recorded in the fsynced ready journal but missing from the receipt', async () => {
  const context = await fixture(true); let calls = 0
  const adapter: MediaCloneAdapter = { ...fakeAdapter, async clone(source, target) { if (++calls === 2) throw new Error('interrupted clone'); await fakeAdapter.clone(source, target) } }
  await expect(context.apply({ adapter })).rejects.toThrow('interrupted clone')
  const path = join(context.root, 'applied/receipt.json'), receipt = JSON.parse(await readFile(path, 'utf8')); receipt.appliedFiles = []; receipt.logicalReplacementBytes = 0
  const bytes = `${JSON.stringify(receipt, null, 2)}\n`; await writeFile(path, bytes); await writeFile(join(context.root, 'applied/receipt.sha256'), `${hash(bytes)}  receipt.json\n`)
  const result = await resumeMediaConsolidation(context.root, 'applied/receipt.json', { adapter: fakeAdapter, acquireLease: lease })
  expect(result.appliedFiles).toHaveLength(2)
  expect(await context.verify()).toMatchObject({ appliedFiles: 2 })
})

test('post-application verification rejects duplicate preservation paths and inconsistent replacement totals', async () => {
  for (const change of ['paths', 'bytes']) {
    const context = await fixture(); await context.apply()
    const path = join(context.root, 'applied/receipt.json'), receipt = JSON.parse(await readFile(path, 'utf8'))
    if (change === 'paths') receipt.preservedFiles[0] = receipt.preservedFiles[1]
    else receipt.logicalReplacementBytes += 1
    const bytes = `${JSON.stringify(receipt, null, 2)}\n`; await writeFile(path, bytes); await writeFile(join(context.root, 'applied/receipt.sha256'), `${hash(bytes)}  receipt.json\n`)
    await expect(context.verify()).rejects.toThrow(change === 'paths' ? 'metadata set mismatch' : 'byte total mismatch')
  }
})

test('the explicit authorized plan hash is checked before source replacement', async () => {
  const context = await fixture()
  await expect(context.apply({ expectedPlanSha256: '0'.repeat(64) })).rejects.toThrow('explicitly authorized checksum')
  expect(await readFile(join(context.root, 'scene/a.png'), 'utf8')).toBe('identical immutable media')
})

test('silently ignored protected-attribute copies fail closed before source replacement', async () => {
  const context = await protectedAttributeFixture(), before = await context.adapter.capture(context.root, 'scene/a.png')
  await expect(context.apply({ adapter: context.adapter })).rejects.toThrow('Clone integrity or metadata mismatch')
  expect(await context.adapter.capture(context.root, 'scene/a.png')).toEqual(before)
})

test('explicit compatible-keeper policy retains a class representative and clones its compatible duplicate', async () => {
  const context = await protectedAttributeFixture(true), before = await context.adapter.capture(context.root, 'scene/a.png'), oldPlan = await readFile(join(context.root, 'prepared/plan.json'))
  const result = await context.apply({ adapter: context.adapter, metadataCompatibleKeepers: true })
  expect(result.appliedFiles.map(row => [row.path, row.keeperPath, row.effectiveKeeperPath])).toEqual([['scene/c.png', 'canonical/a.png', 'scene/a.png']])
  expect(result.retainedFiles?.map(row => row.path)).toEqual(['scene/a.png'])
  expect(await context.adapter.capture(context.root, 'scene/a.png')).toEqual(before)
  expect(await readFile(join(context.root, 'prepared/plan.json'))).toEqual(oldPlan)
  expect(await verifyAppliedMediaConsolidation(context.root, 'applied/receipt.json', context.adapter)).toMatchObject({ appliedFiles: 1, retainedFiles: 1, retainedLogicalBytes: 25 })
})

test('a singleton protected metadata class is retained without unnecessary self-cloning', async () => {
  const context = await protectedAttributeFixture(), before = await context.adapter.capture(context.root, 'scene/a.png')
  const result = await context.apply({ adapter: context.adapter, metadataCompatibleKeepers: true })
  expect(result.appliedFiles).toHaveLength(0)
  expect(result.retainedFiles).toHaveLength(1)
  expect(result.logicalReplacementBytes).toBe(0)
  expect(await context.adapter.capture(context.root, 'scene/a.png')).toEqual(before)
  expect(await verifyAppliedMediaConsolidation(context.root, 'applied/receipt.json', context.adapter)).toMatchObject({ appliedFiles: 0, retainedFiles: 1 })
})

test('an explicit class-aware resume preserves completed replacements and the immutable original baseline', async () => {
  const context = await protectedAttributeFixture(true, true), oldPlan = await readFile(join(context.root, 'prepared/plan.json'))
  await expect(context.apply({ adapter: context.adapter })).rejects.toThrow('Clone integrity or metadata mismatch')
  const partial = JSON.parse(await readFile(join(context.root, 'applied/receipt.json'), 'utf8'))
  expect(partial.appliedFiles.map((row: { path: string }) => row.path)).toEqual(['scene/a.png'])
  const first = await context.adapter.capture(context.root, 'scene/a.png')
  const result = await resumeMediaConsolidation(context.root, 'applied/receipt.json', { adapter: context.adapter, acquireLease: lease, metadataCompatibleKeepers: true })
  expect(result.appliedFiles.map(row => row.path)).toEqual(['scene/a.png', 'scene/d.png'])
  expect(result.retainedFiles?.map(row => row.path)).toEqual(['scene/c.png'])
  expect(await context.adapter.capture(context.root, 'scene/a.png')).toEqual(first)
  expect(await readFile(join(context.root, 'prepared/plan.json'))).toEqual(oldPlan)
  expect(await verifyAppliedMediaConsolidation(context.root, 'applied/receipt.json', context.adapter)).toMatchObject({ appliedFiles: 2, retainedFiles: 1 })
})

test('verification rejects an incompatible effective keeper or a forged retained representative', async () => {
  for (const variant of ['keeper', 'retained']) {
    const context = await protectedAttributeFixture(true)
    await context.apply({ adapter: context.adapter, metadataCompatibleKeepers: true })
    const path = join(context.root, 'applied/receipt.json'), receipt = JSON.parse(await readFile(path, 'utf8'))
    if (variant === 'keeper') receipt.appliedFiles[0].effectiveKeeperPath = 'canonical/a.png'
    else receipt.retainedFiles[0].native.ino += 1
    const bytes = `${JSON.stringify(receipt, null, 2)}\n`; await writeFile(path, bytes); await writeFile(join(context.root, 'applied/receipt.sha256'), `${hash(bytes)}  receipt.json\n`)
    await expect(verifyAppliedMediaConsolidation(context.root, 'applied/receipt.json', context.adapter)).rejects.toThrow()
  }
})

test('a checksummed read-only keeper catalog avoids retaining a compatible singleton target', async () => {
  const context = await protectedAttributeFixture(), outside = 'external-keepers/approved.png'
  await mkdir(join(context.root, 'external-keepers'))
  await writeFile(join(context.root, outside), 'identical immutable media'); await context.setClass(outside, 'class-b')
  const before = await context.adapter.capture(context.root, outside)
  await writeFile(join(context.root, 'keepers.json'), JSON.stringify({ schemaVersion: 1, keepers: [{ ...before, bytes: 25 }] }))
  const originalTarget = await context.adapter.capture(context.root, 'scene/a.png')
  const result = await context.apply({ adapter: context.adapter, metadataCompatibleKeepers: true, keeperCatalogPath: 'keepers.json' })
  expect(result.retainedFiles).toHaveLength(0)
  expect(result.appliedFiles.map(row => [row.path, row.keeperPath, row.effectiveKeeperPath])).toEqual([['scene/a.png', 'canonical/a.png', outside]])
  expect(await context.adapter.capture(context.root, outside)).toEqual(before)
  expect((await context.adapter.capture(context.root, 'scene/a.png')).sha256).toBe(originalTarget.sha256)
  expect(await verifyAppliedMediaConsolidation(context.root, 'applied/receipt.json', context.adapter)).toMatchObject({ appliedFiles: 1, retainedFiles: 0 })
  await writeFile(join(context.root, 'keepers.json'), '{"schemaVersion":1,"keepers":[]}')
  await expect(verifyAppliedMediaConsolidation(context.root, 'applied/receipt.json', context.adapter)).rejects.toThrow('keeper catalog')
})

test('an altered auxiliary keeper or catalog without explicit compatible policy is rejected before mutation', async () => {
  const context = await protectedAttributeFixture(), outside = 'external-keepers/approved.png'
  const targetBefore = await context.adapter.capture(context.root, 'scene/a.png')
  await mkdir(join(context.root, 'external-keepers'))
  await writeFile(join(context.root, outside), 'identical immutable media'); await context.setClass(outside, 'class-b')
  const original = await context.adapter.capture(context.root, outside)
  await writeFile(join(context.root, 'keepers.json'), JSON.stringify({ schemaVersion: 1, keepers: [{ ...original, bytes: 25 }] }))
  await expect(context.apply({ adapter: context.adapter, keeperCatalogPath: 'keepers.json' })).rejects.toThrow('explicit metadata-compatible')
  await writeFile(join(context.root, outside), 'Identical immutable media')
  await expect(context.apply({ adapter: context.adapter, metadataCompatibleKeepers: true, keeperCatalogPath: 'keepers.json' })).rejects.toThrow('Read-only keeper baseline changed')
  expect(await context.adapter.capture(context.root, 'scene/a.png')).toEqual(targetBefore)
})

test('explicit kernel-label policy applies the original target and audits only the clonefile-assigned label', async () => {
  const context = await kernelAssignmentFixture(), oldNative = await readFile(join(context.root, 'prepared/native-metadata.json'))
  const result = await context.apply({ adapter: context.adapter, acceptKernelProvenance: true })
  expect(result.keeperPolicy).toBe('original-plan-with-kernel-provenance')
  expect(result.appliedFiles).toHaveLength(1)
  expect(result.retainedFiles).toHaveLength(0)
  expect(result.appliedFiles[0]!.effectiveKeeperPath).toBe('canonical/a.png')
  expect(result.appliedFiles[0]!.kernelAssignedXattrChanges).toEqual([{ name: 'com.apple.provenance', beforeSha256: hash('class-b'), afterSha256: hash('native-kernel-assignment'), assignment: 'clonefile(2)' }])
  expect(await readFile(join(context.root, 'prepared/native-metadata.json'))).toEqual(oldNative)
  expect(await verifyAppliedMediaConsolidation(context.root, 'applied/receipt.json', context.adapter)).toMatchObject({ appliedFiles: 1, retainedFiles: 0, kernelAssignedXattrTransitions: 1 })
})

test('kernel-label acceptance never permits custom or quarantine attribute changes', async () => {
  for (const name of ['user.custom', 'com.apple.quarantine']) {
    const context = await kernelAssignmentFixture(name), before = await context.adapter.capture(context.root, 'scene/a.png')
    await expect(context.apply({ adapter: context.adapter, acceptKernelProvenance: true })).rejects.toThrow('Clone integrity or metadata mismatch')
    expect(await context.adapter.capture(context.root, 'scene/a.png')).toEqual(before)
  }
})

test('invented assignment hashes or later label changes fail before source replacement', async () => {
  for (const [afterCopy, invented] of [[false, true], [true, false]]) {
    const context = await kernelAssignmentFixture(undefined, afterCopy, invented), before = await context.adapter.capture(context.root, 'scene/a.png')
    await expect(context.apply({ adapter: context.adapter, acceptKernelProvenance: true })).rejects.toThrow(invented ? 'assignment changed before metadata copying' : 'Clone integrity or metadata mismatch')
    expect(await context.adapter.capture(context.root, 'scene/a.png')).toEqual(before)
  }
})

test('missing, tampered, or widened kernel transition records are rejected by verification', async () => {
  for (const variant of ['missing', 'hash', 'name']) {
    const context = await kernelAssignmentFixture(); await context.apply({ adapter: context.adapter, acceptKernelProvenance: true })
    const path = join(context.root, 'applied/receipt.json'), receipt = JSON.parse(await readFile(path, 'utf8'))
    if (variant === 'missing') delete receipt.appliedFiles[0].kernelAssignedXattrChanges
    else if (variant === 'hash') receipt.appliedFiles[0].kernelAssignedXattrChanges[0].afterSha256 = hash('arbitrary-operator-value')
    else receipt.appliedFiles[0].kernelAssignedXattrChanges[0].name = 'com.apple.quarantine'
    const bytes = `${JSON.stringify(receipt, null, 2)}\n`; await writeFile(path, bytes); await writeFile(join(context.root, 'applied/receipt.sha256'), `${hash(bytes)}  receipt.json\n`)
    await expect(verifyAppliedMediaConsolidation(context.root, 'applied/receipt.json', context.adapter)).rejects.toThrow()
  }
})

test('explicit original-plan kernel policy clears prior class retentions and preserves completed files', async () => {
  const context = await protectedAttributeFixture(true, true)
  await expect(context.apply({ adapter: context.adapter })).rejects.toThrow('Clone integrity or metadata mismatch')
  await expect(resumeMediaConsolidation(context.root, 'applied/receipt.json', { adapter: context.adapter, acquireLease: lease, metadataCompatibleKeepers: true, beforeReplace: async () => { throw new Error('pause before next replacement') } })).rejects.toThrow('pause before next replacement')
  const partial = JSON.parse(await readFile(join(context.root, 'applied/receipt.json'), 'utf8')), first = await context.adapter.capture(context.root, 'scene/a.png')
  expect(partial.retainedFiles.map((row: { path: string }) => row.path)).toEqual(['scene/c.png'])
  const nativeAdapter: MediaCloneAdapter = {
    ...context.adapter,
    async clone(source, destination) {
      await context.adapter.clone(source, destination)
      const value = await context.adapter.capture(context.root, relative(await realpath(context.root), destination))
      return { assignment: 'clonefile(2)', kernelAssignedXattrs: { 'com.apple.provenance': value.xattrSha256['com.apple.provenance']! } }
    }
  }
  const result = await resumeMediaConsolidation(context.root, 'applied/receipt.json', { adapter: nativeAdapter, acquireLease: lease, acceptKernelProvenance: true })
  expect(result.appliedFiles).toHaveLength(3)
  expect(result.retainedFiles).toHaveLength(0)
  expect(result.policyHistory?.at(-1)?.retainedPathsBefore).toEqual(['scene/c.png'])
  expect(await context.adapter.capture(context.root, 'scene/a.png')).toEqual(first)
  expect(await verifyAppliedMediaConsolidation(context.root, 'applied/receipt.json', nativeAdapter)).toMatchObject({ appliedFiles: 3, retainedFiles: 0, kernelAssignedXattrTransitions: 2 })
})

test('source symlinks and protected/traversal plan paths fail closed', async () => {
  const context = await fixture()
  await unlink(join(context.root, 'scene/a.png'))
  await symlink(join(context.root, 'canonical/a.png'), join(context.root, 'scene/a.png'))
  await expect(context.apply()).rejects.toThrow('Symlink rejected')
  for (const path of ['../prepared/plan.json', '.autoshow/private.json', '/outside.json']) await expect(applyMediaConsolidation(context.root, path, 'other', { adapter: fakeAdapter, acquireLease: lease })).rejects.toThrow()
})

test('tampered preparation or application receipts are rejected', async () => {
  const context = await fixture()
  await writeFile(join(context.root, 'prepared/plan.json'), '{}')
  await expect(context.apply()).rejects.toThrow('checksum mismatch')
  const other = await fixture()
  await other.apply()
  await writeFile(join(other.root, 'applied/receipt.json'), '{}')
  await expect(other.verify()).rejects.toThrow('checksum mismatch')
})

test('lost maintenance lease aborts before replacement and releases ownership', async () => {
  const context = await fixture(); let calls = 0, released = false
  const acquireLease = async () => ({ assertHeld: async () => { if (++calls > 1) throw new Error('lease lost') }, release: async () => { released = true } })
  await expect(context.apply({ acquireLease })).rejects.toThrow('lease lost')
  expect(released).toBe(true)
  expect(JSON.parse(await readFile(join(context.root, 'applied/receipt.json'), 'utf8')).appliedFiles).toHaveLength(0)
})

test('native clonefile engine preserves target metadata and write isolation on disposable macOS files', async () => {
  if (process.platform !== 'darwin') return
  const root = await temporary.make(), source = join(root, 'source.png'), original = join(root, 'original.png'), clone = join(root, 'clone.png')
  await writeFile(source, Buffer.alloc(64 * 1024, 3)); await writeFile(original, Buffer.alloc(64 * 1024, 3)); await chmod(original, 0o640)
  execFileSync('/usr/bin/xattr', ['-w', 'user.autoshow-keeper-only', 'must-not-survive', source])
  execFileSync('/usr/bin/xattr', ['-w', 'user.autoshow-common', 'keeper-value', source])
  execFileSync('/usr/bin/xattr', ['-w', 'user.autoshow-test', 'target-owned-metadata', original])
  execFileSync('/usr/bin/xattr', ['-w', 'user.autoshow-common', 'target-value', original])
  await utimes(original, 1_700_000_000, 1_700_000_001)
  const adapter = await createNativeMediaCloneAdapter({ acceptKernelProvenance: true }), before = await adapter.capture(root, 'original.png')
  const assignment = await adapter.clone(source, clone), atCreation = await adapter.capture(root, 'clone.png')
  expect(assignment?.assignment).toBe('clonefile(2)')
  expect(assignment?.kernelAssignedXattrs['com.apple.provenance']).toBe(atCreation.xattrSha256['com.apple.provenance'] ?? null)
  await adapter.copyMetadata(original, clone)
  const after = await adapter.capture(root, 'clone.png')
  const expectedAttrs = { ...before.xattrSha256 }
  if (atCreation.xattrSha256['com.apple.provenance']) expectedAttrs['com.apple.provenance'] = atCreation.xattrSha256['com.apple.provenance']
  else delete expectedAttrs['com.apple.provenance']
  expect([after.sha256, after.mode, after.uid, after.gid, after.mtimeNs, after.xattrSha256, after.acl]).toEqual([before.sha256, before.mode, before.uid, before.gid, before.mtimeNs, expectedAttrs, before.acl])
  expect(after.ino).not.toBe((await lstat(source)).ino)
  await writeFile(clone, 'independent clone change')
  expect(await readFile(source)).toEqual(Buffer.alloc(64 * 1024, 3))
  await expect(adapter.clone(source, clone)).rejects.toThrow('no fallback')
})
