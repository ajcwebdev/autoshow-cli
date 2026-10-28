import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import * as v from 'valibot'
import { migrateLiveComicReferences } from '~/tools/migrate-live-comic-references'
import { configureCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import { extractPanelBundleData } from '~/cli/commands/visuals/comic/comic-utils/panel-prompt-utils'
import { StructuredScriptDataSchema } from '~/cli/commands/visuals/comic/schemas/schemas'
import { acquireProjectWriterLease } from '~/utils/project-maintenance-lease'
import { createLiveCharacterFixture } from '../../../../test-utils/live-character-reference-fixture'
import { makeTempDir } from '../../../../test-utils/temp-dirs'

const roots: string[] = []
const hash = (bytes: string): string => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
const bundleValue = (locationKey = 'cargo-bay') => ({
  schemaVersion: 4, snapshotId: 'retired-characters', title: 'Reviewed scene', location: 'Cargo bay',
  panels: [{ number: 1, description: 'Hero holds the reviewed marker.', shotPlan: 'Medium shot.', characterKeys: ['hero'], speech: [{ speaker: { kind: 'character', characterKey: 'hero', offscreen: false }, line: 'The source dialogue stays.' }], sourceSegmentIds: [], sourceSegments: [], locationKey, locationSnapshotId: 'retired-location', designSnapshotId: 'retired-design', designReferenceKeys: ['marker'], designReferences: [{ key: 'marker', sourcePath: 'input/designs/marker.png', usage: 'Preserve the marker.' }] }],
})
const legacyInlineSegment = () => ({ id: 'segment-1', type: 'dialogue', text: 'The source dialogue stays.', rawMarkdown: '**HERO:** The source dialogue stays.', beatIndex: 0, speakerKey: 'hero', speakerLabel: 'HERO', delivery: 'matter-of-fact', location: { key: 'cargo-bay', raw: 'INT. CARGO BAY' } })
const structuredScriptValue = () => ({
  schemaVersion: 5, scriptSlug: 'scene', sourceFile: 'input/scripts/scene.md',
  sourceIdentity: { schemaVersion: 1, canonicalPath: 'input/scripts/scene.md', scriptSlug: 'scene', contentSha256: 'a'.repeat(64), identityHash: 'b'.repeat(64) },
  document: { heading: 'Episode', title: 'Reviewed scene', metadata: [] },
  scene: { heading: 'INT. CARGO BAY', title: 'Reviewed scene', location: { key: 'cargo-bay', raw: 'INT. CARGO BAY' }, soundscape: { cues: [], ambientBeds: [] } },
  characterKeys: ['hero'], beats: [], sourceSegments: [{ ...legacyInlineSegment(), sourceSpans: [] }],
})

const addWorkspace = async (root: string, name: string, locationKey = 'cargo-bay') => {
  const workspace = join(root, 'output', 'ep01', name)
  const panelDirectory = join(workspace, 'metadata', 'panel-prompts', 'panel-01')
  await mkdir(panelDirectory, { recursive: true })
  const path = join(panelDirectory, 'scene-panel-1.md')
  const prefix = '# Reviewed bundle\n\n```json\n{"unrelated":"source preamble"}\n```\n\nSource text stays.\n\n'
  const suffix = '\n\nSource footer stays.\n'
  const content = `${prefix}\`\`\`json\n${JSON.stringify(bundleValue(locationKey), null, 2)}\n\`\`\`${suffix}`
  await writeFile(path, content)
  const assets = join(workspace, 'assets')
  for (const name of ['character-references', 'location-references', 'design-references']) {
    await mkdir(join(assets, name, 'retired'), { recursive: true })
    await writeFile(join(assets, name, 'retired', 'reference.png'), `stale-${name}`)
    await writeFile(join(assets, `${name}.json`), '{"retired":true}')
  }
  await writeFile(join(assets, 'location-reference.json'), '{"legacy":true}')
  await writeFile(join(assets, 'layout.svg'), '<svg>reviewed structural guide</svg>')
  await mkdir(join(workspace, 'panels'), { recursive: true })
  await writeFile(join(workspace, 'panels', 'panel-01.png'), 'accepted-canonical-panel')
  return { workspace, path, assets, content, prefix, suffix }
}

const fixture = async () => {
  const root = await realpath(await makeTempDir('autoshow-live-reference-migration-'))
  roots.push(root)
  await createLiveCharacterFixture(root)
  const locations = join(root, 'input', 'locations')
  await mkdir(locations, { recursive: true })
  const specification = 'Fixed straight loading rail and a round hatch.'
  await writeFile(join(locations, 'cargo-bay--reference.png'), 'current-canonical-location')
  await writeFile(join(locations, 'locations-reference.json'), JSON.stringify({ schemaVersion: 1, styleImage: '../characters/hero.png', locations: [{ key: 'cargo-bay', name: 'Cargo Bay', specification, sourceScripts: [] }] }))
  await writeFile(join(locations, 'location-sketches.json'), JSON.stringify({ schemaVersion: 2, sketches: [{ locationKey: 'cargo-bay', specificationSha256: hash(specification), views: [{ view: 'establishing', generationId: 'canonical-location', image: 'cargo-bay--reference.png', imageSha256: hash('current-canonical-location'), model: 'gpt-image-2.5-sunburst', createdAt: '2026-10-26T00:00:00Z' }] }] }))
  await mkdir(join(root, 'input', 'designs'), { recursive: true })
  await writeFile(join(root, 'input', 'designs', 'marker.png'), 'current-canonical-design')
  return { root, ...await addWorkspace(root, '01-first') }
}

afterEach(async () => {
  configureCharactersRoot('input/characters')
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('live reference workspace migration', () => {
  test('dry run validates current references without rewriting bundles or removing snapshots', async () => {
    const f = await fixture()
    const result = await migrateLiveComicReferences({ root: f.root })
    expect(result).toMatchObject({ operation: 'dry-run', workspaces: 1, bundlesValidated: 1, bundlesWithLegacyIds: 1, bundlesRewritten: 0, canonicalReferenceFilesValidated: 7, snapshotRoots: 7, snapshotFiles: 7, snapshotImageFiles: 3 })
    expect(await readFile(f.path, 'utf8')).toBe(f.content)
    expect(existsSync(join(f.assets, 'character-references', 'retired', 'reference.png'))).toBe(true)
    expect(existsSync(join(f.root, 'output', '.autoshow-workspace-leases'))).toBe(false)
  })

  test('apply removes only frozen reference material and preserves reviewed content and canonical files', async () => {
    const f = await fixture()
    const result = await migrateLiveComicReferences({ root: f.root, apply: true })
    expect(result).toMatchObject({ operation: 'applied', workspaces: 1, bundlesRewritten: 1, snapshotFiles: 7, snapshotImageFiles: 3 })
    const content = await readFile(f.path, 'utf8')
    expect(content.startsWith(f.prefix)).toBe(true)
    expect(content.endsWith(f.suffix)).toBe(true)
    const actual = JSON.parse([...content.matchAll(/```json\s*([\s\S]*?)\s*```/g)].at(-1)![1]!)
    const expected = bundleValue() as Record<string, unknown>
    delete expected['snapshotId']
    for (const panel of expected['panels'] as Array<Record<string, unknown>>) { delete panel['locationSnapshotId']; delete panel['designSnapshotId'] }
    expect(actual).toEqual(expected)
    expect((await readdir(f.assets)).sort()).toEqual(['layout.svg'])
    expect(await readFile(join(f.workspace, 'panels', 'panel-01.png'), 'utf8')).toBe('accepted-canonical-panel')
    expect(await readFile(join(f.root, 'input', 'designs', 'marker.png'), 'utf8')).toBe('current-canonical-design')
    expect(existsSync(join(f.root, 'output', '.autoshow-workspace-leases'))).toBe(false)
    const second = await migrateLiveComicReferences({ root: f.root, apply: true })
    expect(second).toMatchObject({ bundlesValidated: 1, bundlesWithLegacyIds: 0, bundlesRewritten: 0, snapshotFiles: 0, snapshotRoots: 0 })
    expect(await readFile(f.path, 'utf8')).toBe(content)
  })

  test('validates every workspace before changing the first one', async () => {
    const f = await fixture()
    const bad = await addWorkspace(f.root, '02-invalid', 'unregistered-location')
    await expect(migrateLiveComicReferences({ root: f.root, apply: true })).rejects.toThrow('does not resolve')
    expect(await readFile(f.path, 'utf8')).toBe(f.content)
    expect(await readFile(bad.path, 'utf8')).toBe(bad.content)
    expect(existsSync(join(f.assets, 'character-references.json'))).toBe(true)
    expect(existsSync(join(bad.assets, 'location-references', 'retired', 'reference.png'))).toBe(true)
    expect(existsSync(join(f.root, 'output', '.autoshow-workspace-leases'))).toBe(false)
  })

  test('migrates reviewed v4 inline segments without spans without inventing or rewriting source provenance', async () => {
    const f = await fixture()
    const value = bundleValue() as { panels: Array<Record<string, unknown>> }
    value.panels[0]!['sourceSegmentIds'] = ['segment-1']
    value.panels[0]!['sourceSegments'] = [legacyInlineSegment()]
    const content = `${f.prefix}\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`${f.suffix}`
    await writeFile(f.path, content)
    const structuredPath = join(f.workspace, 'metadata', 'structured-script.json')
    const structuredBytes = JSON.stringify(structuredScriptValue(), null, 2) + '\n'
    await writeFile(structuredPath, structuredBytes)
    expect(extractPanelBundleData(content).panels[0]!.sourceSegments[0]!.sourceSpans).toEqual([])
    expect(await migrateLiveComicReferences({ root: f.root, apply: true })).toMatchObject({ bundlesValidated: 1, bundlesRewritten: 1 })
    const migrated = await readFile(f.path, 'utf8')
    const raw = JSON.parse([...migrated.matchAll(/```json\s*([\s\S]*?)\s*```/g)].at(-1)![1]!)
    expect(raw.panels[0].sourceSegments).toEqual([legacyInlineSegment()])
    expect(Object.hasOwn(raw.panels[0].sourceSegments[0], 'sourceSpans')).toBe(false)
    expect(raw.panels[0].sourceSegmentIds).toEqual(['segment-1'])
    expect(await readFile(structuredPath, 'utf8')).toBe(structuredBytes)
    expect(migrated.startsWith(f.prefix)).toBe(true)
    expect(migrated.endsWith(f.suffix)).toBe(true)
  })

  test('rejects malformed explicit inline spans before migration changes any bundle or snapshot', async () => {
    const f = await fixture()
    const value = bundleValue() as { panels: Array<Record<string, unknown>> }
    value.panels[0]!['sourceSegments'] = [{ ...legacyInlineSegment(), sourceSpans: [{ kind: 'invented-provenance', start: 0, end: 1, indexUnit: 'unicode-scalar-value', text: 'T' }] }]
    const content = `${f.prefix}\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`${f.suffix}`
    await writeFile(f.path, content)
    expect(() => extractPanelBundleData(content)).toThrow('reviewed schemaVersion 4')
    await expect(migrateLiveComicReferences({ root: f.root, apply: true })).rejects.toThrow('reviewed schemaVersion 4')
    expect(await readFile(f.path, 'utf8')).toBe(content)
    expect(existsSync(join(f.assets, 'character-references.json'))).toBe(true)
    expect(existsSync(join(f.root, 'output', '.autoshow-workspace-leases'))).toBe(false)
  })

  test('continues requiring explicit source spans in authoritative structured scripts', () => {
    const value = structuredScriptValue()
    expect(v.safeParse(StructuredScriptDataSchema, value).success).toBe(true)
    const missingSpans = { ...value, sourceSegments: [legacyInlineSegment()] }
    const parsed = v.safeParse(StructuredScriptDataSchema, missingSpans)
    expect(parsed.success).toBe(false)
    if (!parsed.success) expect(parsed.issues.some(issue => issue.path?.map(item => item.key).join('.') === 'sourceSegments.0.sourceSpans')).toBe(true)
  })

  test('rejects symlinked snapshot trees without touching their external targets', async () => {
    const f = await fixture()
    const target = join(f.assets, 'character-references')
    await rm(target, { recursive: true })
    await symlink(join(f.root, 'input', 'characters'), target)
    await expect(migrateLiveComicReferences({ root: f.root, apply: true })).rejects.toThrow('symbolic links')
    expect(await readFile(f.path, 'utf8')).toBe(f.content)
    expect(existsSync(join(f.root, 'input', 'characters', 'hero.png'))).toBe(true)
  })

  test('refuses to migrate while a supported writer owns the workspace', async () => {
    const f = await fixture()
    const writer = await acquireProjectWriterLease(f.root)
    try {
      await expect(migrateLiveComicReferences({ root: f.root, apply: true })).rejects.toThrow('writer leases are active')
      expect(await readFile(f.path, 'utf8')).toBe(f.content)
      expect(existsSync(join(f.assets, 'design-references.json'))).toBe(true)
    } finally { await writer.release() }
  })
})
