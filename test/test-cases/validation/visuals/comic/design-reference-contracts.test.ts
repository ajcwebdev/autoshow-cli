import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDesignReferenceSnapshot, resolveDesignReferencesAcrossPanels } from '~/cli/commands/visuals/comic/comic-utils/design-reference'
import type { PanelBundleData, PanelPrimaryReferenceInput, SceneDesignReference } from '~/types'

const bridgeLocation = { key: 'bridge', raw: 'bridge' }
const originalCwd = process.cwd()
const temporaryRoots: string[] = []
const mapping: SceneDesignReference = { key: 'console-panel', sourcePath: 'input/designs/console.png', usage: 'Bridge console layout' }
const hash = (bytes: string): string => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')

const fixture = () => {
  const project = realpathSync(mkdtempSync(join(tmpdir(), 'comic-live-design-')))
  temporaryRoots.push(project)
  process.chdir(project)
  mkdirSync(join(project, 'input/designs'), { recursive: true })
  const source = join(project, mapping.sourcePath)
  writeFileSync(source, 'canonical-design-v1')
  const workspace = join(project, 'output/scene')
  return { project, source, workspace }
}

afterEach(() => {
  process.chdir(originalCwd)
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

const panelBundle = (panel: Partial<PanelBundleData['panels'][number]>): PanelBundleData => ({
  schemaVersion: 4, snapshotId: 'old-character-snapshot',
  title: 'Design Reference Contract', location: 'Bridge', panels: [{
    number: 1, description: 'Authored staging 1.',
    shotPlan: 'Medium eye-level shot 1; hero is screen left, facing right; exclude all unlisted cast.',
    characterKeys: ['hero'], speech: [], sourceSegmentIds: ['beat-1'],
    sourceSegments: [{ id: 'beat-1', type: 'direction', text: 'Authored staging 1.', sourceSpans: [], beatIndex: 1, location: bridgeLocation }],
    locationKey: 'bridge', locationSnapshotId: 'old-location-snapshot',
    ...panel,
  }],
})

const referenceInput = (workspace: string, panel: Partial<PanelBundleData['panels'][number]>): PanelPrimaryReferenceInput => ({
  panelDirectory: join(workspace, 'metadata/panel-prompts/panel-01'), entries: [], bundleData: panelBundle(panel),
})

describe('live canonical design references', () => {
  test('authored mappings resolve without a snapshot manifest or generated key list', () => {
    const { source, workspace } = fixture()
    expect(resolveDesignReferencesAcrossPanels([referenceInput(workspace, { designReferences: [mapping] })])).toEqual([
      { key: mapping.key, usage: mapping.usage, path: source, sha256: hash('canonical-design-v1') },
    ])
    expect(existsSync(workspace)).toBe(false)
  })

  test('canonical replacement is used immediately despite stale snapshot IDs and files', () => {
    const { source, workspace } = fixture()
    const assets = join(workspace, 'assets')
    mkdirSync(assets, { recursive: true })
    writeFileSync(join(assets, 'design-references.json'), 'obsolete invalid snapshot manifest')
    const input = referenceInput(workspace, { designReferences: [mapping], designReferenceKeys: ['retired-design-key'], designSnapshotId: 'old-snapshot' })
    expect(resolveDesignReferencesAcrossPanels([input])[0]?.sha256).toBe(hash('canonical-design-v1'))
    writeFileSync(source, 'canonical-design-v2')
    expect(resolveDesignReferencesAcrossPanels([input])).toEqual([
      { key: mapping.key, usage: mapping.usage, path: source, sha256: hash('canonical-design-v2') },
    ])
    expect(readFileSync(join(assets, 'design-references.json'), 'utf8')).toBe('obsolete invalid snapshot manifest')
  })

  test('descriptor creation hashes current files without writing any snapshot files', async () => {
    const { source, workspace } = fixture()
    const first = await createDesignReferenceSnapshot(workspace, [mapping, mapping])
    expect(first?.snapshotId).toBe('live')
    expect(first?.designs).toHaveLength(1)
    expect(first?.designs[0]?.sourcePath).toBe(mapping.sourcePath)
    expect(first?.designs[0]?.sha256).toBe(hash('canonical-design-v1'))
    expect(existsSync(workspace)).toBe(false)
    writeFileSync(source, 'canonical-design-v2')
    expect((await createDesignReferenceSnapshot(workspace, [mapping]))?.designs[0]?.sha256).toBe(hash('canonical-design-v2'))
    expect(existsSync(workspace)).toBe(false)
  })

  test('no design mappings produce no references or files', async () => {
    const { workspace } = fixture()
    expect(resolveDesignReferencesAcrossPanels([referenceInput(workspace, {})])).toEqual([])
    expect(await createDesignReferenceSnapshot(workspace, [])).toBeUndefined()
    expect(existsSync(workspace)).toBe(false)
  })

  test('missing current files fail even when an obsolete snapshot could exist', async () => {
    const { source, workspace } = fixture()
    rmSync(source)
    expect(() => resolveDesignReferencesAcrossPanels([referenceInput(workspace, { designReferences: [mapping] })])).toThrow('source is missing')
    await expect(createDesignReferenceSnapshot(workspace, [mapping])).rejects.toThrow('source is missing')
  })

  test('unsafe paths and symlinks escaping input are rejected', () => {
    const { project, workspace } = fixture()
    const outside = join(project, 'outside.png')
    writeFileSync(outside, 'outside-input')
    symlinkSync(outside, join(project, 'input/designs/escaped.png'))
    for (const sourcePath of ['/tmp/design.png', 'input/../outside.png', 'input\\designs\\console.png', 'input/designs/escaped.png']) {
      expect(() => resolveDesignReferencesAcrossPanels([referenceInput(workspace, { designReferences: [{ ...mapping, sourcePath }] })])).toThrow('Unsafe design reference source path')
    }
  })

  test('conflicting canonical mappings for one design key fail before resolving', async () => {
    const { workspace } = fixture()
    for (const conflicting of [{ ...mapping, usage: 'A different layout contract' }, { ...mapping, sourcePath: 'input/designs/other.png' }]) {
      const inputs = [referenceInput(workspace, { designReferences: [mapping] }), referenceInput(workspace, { designReferences: [conflicting] })]
      expect(() => resolveDesignReferencesAcrossPanels(inputs)).toThrow('conflicting source paths or usage')
      await expect(createDesignReferenceSnapshot(workspace, [mapping, conflicting])).rejects.toThrow('conflicting source paths or usage')
    }
  })

  test('legacy key-only references fail with an actionable missing-mapping error', () => {
    const { workspace } = fixture()
    expect(() => resolveDesignReferencesAcrossPanels([referenceInput(workspace, { designReferenceKeys: [mapping.key], designSnapshotId: 'old' })])).toThrow('canonical source mappings')
  })

  test('same mapping across panels is deduplicated while distinct workspaces stay separate', () => {
    const { source, workspace } = fixture()
    const input = referenceInput(workspace, { designReferences: [mapping] })
    expect(resolveDesignReferencesAcrossPanels([input, input])).toEqual([{ key: mapping.key, usage: mapping.usage, path: source, sha256: hash('canonical-design-v1') }])
    expect(() => resolveDesignReferencesAcrossPanels([input, referenceInput(`${workspace}-other`, { designReferences: [mapping] })])).toThrow('Mixed run directories')
  })
})
