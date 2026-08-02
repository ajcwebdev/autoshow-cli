import { afterEach, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import {
  createLocationReferenceSnapshots,
  loadAndVerifyLocationReferenceSnapshots,
  normalizeLocationKey,
  resolveLocationCatalogEntry,
  type LocationReferenceCatalog,
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/location-reference'
import { validateSceneSourceSegmentCoverage } from '~/cli/commands/process-steps/step-8-comic/comic-utils/source-coverage-utils'
import { parseScriptMarkdownToStructuredData } from '~/cli/commands/process-steps/step-8-comic/comic-utils/structured-script-utils/structured-script-parser'
import type { CharacterCatalogService, ScenePromptData, StructuredScriptSourceSegment } from '~/types'

const roots: string[] = []
const emptyCharacterCatalog = {
  characterKeys: [],
  resolve: () => undefined,
  detectMentions: () => [],
} as unknown as CharacterCatalogService
const catalog: LocationReferenceCatalog = {
  schemaVersion: 1,
  styleImage: 'style.png',
  locations: [
    { key: 'quarters', name: 'Crew Quarters', aliases: ['ship crew quarters'], specification: 'Quarters.', sourceScripts: [] },
    { key: 'hallway', name: 'Upper Deck Hallway', aliases: ['ship upper deck hallway'], specification: 'Hallway.', sourceScripts: [] },
  ],
}

afterEach(async () => {
  configureCharactersRoot('input/characters')
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('multi-location comic contracts', () => {
  test('parses initial, secondary, temporal, and transition-prefixed sluglines and propagates effective locations', () => {
    const structured = parseScriptMarkdownToStructuredData([
      '# Episode',
      '',
      '## Scene: "Move"',
      '',
      '**INT. SHIP CREW QUARTERS - LATE NIGHT**',
      '',
      'A quiet room.',
      '',
      '**CUT TO: INT. SHIP UPPER DECK HALLWAY - MOMENTS LATER**',
      '',
      'A long corridor.',
    ].join('\n'), 'input/move.md', { locationCatalog: catalog, characterCatalog: emptyCharacterCatalog })
    expect(structured.schemaVersion).toBe(3)
    expect(structured.scene.location.key).toBe('quarters')
    expect(structured.beats.map(beat => beat.location.key)).toEqual(['quarters', 'hallway', 'hallway'])
    expect(structured.sourceSegments.map(segment => segment.location.key)).toEqual(['quarters', 'hallway', 'hallway'])
    expect(normalizeLocationKey('INT. SHIP UPPER DECK HALLWAY - MOMENTS LATER')).toBe('ship-upper-deck-hallway')
  })

  test('resolves aliases deterministically and rejects unknown or ambiguous locations', () => {
    expect(resolveLocationCatalogEntry('INT. SHIP UPPER DECK HALLWAY - EVENING', catalog).key).toBe('hallway')
    expect(() => resolveLocationCatalogEntry('INT. MYSTERY ROOM - DAY', catalog)).toThrow(/does not resolve/)
    const ambiguous: LocationReferenceCatalog = {
      ...catalog,
      locations: [...catalog.locations, { key: 'other-hallway', name: 'Other', aliases: ['ship upper deck hallway'], specification: 'Other.', sourceScripts: [] }],
    }
    expect(() => resolveLocationCatalogEntry('SHIP UPPER DECK HALLWAY', ambiguous)).toThrow(/ambiguous.*hallway.*other-hallway/)
  })

  test('requires panel locationKey to match one source location and rejects transition-spanning panels', () => {
    const location = (key: string) => ({ key, raw: key })
    const segments: StructuredScriptSourceSegment[] = [
      { id: 'beat-0001', type: 'direction', text: 'Room.', location: location('quarters') },
      { id: 'beat-0002', type: 'transition', text: 'Hallway.', location: location('hallway') },
    ]
    const scene = (ids: string[], locationKey: string): ScenePromptData => ({
      schemaVersion: 4,
      title: 'Move',
      location: 'quarters then hallway',
      panels: [{ number: 1, description: 'Move.', shotPlan: 'Wide shot.', characterKeys: [], speech: [], sourceSegmentIds: ids, locationKey }],
    })
    expect(() => validateSceneSourceSegmentCoverage(scene(['beat-0001'], 'quarters'), [segments[0]!])).not.toThrow()
    expect(() => validateSceneSourceSegmentCoverage(scene(['beat-0001'], 'hallway'), [segments[0]!])).toThrow(/does not match/)
    expect(() => validateSceneSourceSegmentCoverage(scene(['beat-0001', 'beat-0002'], 'quarters'), segments)).toThrow(/spans multiple locations.*Split/)
  })

  test('snapshots each distinct location once, verifies checksums, and reads legacy singular manifests', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-multi-location-snapshots-'))
    roots.push(root)
    const characters = join(root, 'input', 'characters')
    const locations = join(root, 'input', 'locations')
    await mkdir(characters, { recursive: true })
    await mkdir(locations, { recursive: true })
    configureCharactersRoot(characters)
    const sketches = []
    for (const entry of catalog.locations) {
      const bytes = Buffer.from(entry.key)
      const sheet = `${entry.key}.png`
      await Bun.write(join(locations, sheet), bytes)
      sketches.push({
        locationKey: entry.key,
        generationId: `generation-${entry.key}`,
        specificationSha256: createHash('sha256').update(entry.specification).digest('hex'),
        sheet,
        sheetSha256: createHash('sha256').update(bytes).digest('hex'),
        model: 'fixture',
        createdAt: '2026-01-01T00:00:00.000Z',
      })
    }
    await Bun.write(join(locations, 'locations-reference.json'), JSON.stringify(catalog))
    await Bun.write(join(locations, 'location-sketches.json'), JSON.stringify({ schemaVersion: 1, sketches }))
    const run = join(root, 'run')
    const manifest = await createLocationReferenceSnapshots(run, ['quarters', 'hallway', 'quarters'])
    expect(manifest.snapshots.map(snapshot => snapshot.locationKey)).toEqual(['quarters', 'hallway'])
    expect(await loadAndVerifyLocationReferenceSnapshots(run)).toHaveLength(2)
    const firstAsset = resolve(run, manifest.snapshots[0]!.sheet.path)
    await Bun.write(firstAsset, 'tampered')
    await expect(loadAndVerifyLocationReferenceSnapshots(run)).rejects.toThrow(/missing or modified/)

    const legacyRun = join(root, 'legacy-run')
    const legacyAsset = join(legacyRun, 'location.png')
    await mkdir(dirname(legacyAsset), { recursive: true })
    await Bun.write(legacyAsset, 'legacy')
    const legacyHash = createHash('sha256').update('legacy').digest('hex')
    await Bun.write(join(legacyRun, 'location-reference.json'), JSON.stringify({ schemaVersion: 1, snapshotId: 'legacy', locationKey: 'quarters', specification: 'Quarters.', sourceScripts: [], sourceGenerationId: 'old', sheet: { path: 'location.png', sha256: legacyHash } }))
    expect((await loadAndVerifyLocationReferenceSnapshots(legacyRun))[0]?.snapshotId).toBe('legacy')
  })

  test('parses a complete script into ordered location segments without an external project fixture', () => {
    const structured = parseScriptMarkdownToStructuredData([
      '# Episode',
      '',
      '## Scene: "A Change of Venue"',
      '',
      '**INT. SHIP CREW QUARTERS - NIGHT**',
      '',
      'A crew member closes a locker.',
      '',
      '**CUT TO: INT. SHIP UPPER DECK HALLWAY - MOMENTS LATER**',
      '',
      'Footsteps cross the long corridor.',
      '',
      'A warning light begins to flash.',
    ].join('\n'), 'input/episode-scripts/01-script/02-change-of-venue.md', {
      locationCatalog: catalog,
      characterCatalog: emptyCharacterCatalog,
    })
    const keys = structured.sourceSegments.map(segment => segment.location.key)
    expect(Array.from(new Set(keys))).toEqual(['quarters', 'hallway'])
    expect(keys.indexOf('hallway')).toBeGreaterThan(0)
    expect(keys.slice(keys.indexOf('hallway')).every(key => key === 'hallway')).toBe(true)
  })
})
