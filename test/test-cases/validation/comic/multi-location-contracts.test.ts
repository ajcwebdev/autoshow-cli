import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { createLocationReferenceSnapshots, normalizeLocationKey, resolveLocationCatalogEntry } from '~/cli/commands/process-steps/step-8-comic/comic-utils/location-reference'
import { resolveLocationReferencesAcrossPanels } from '~/cli/commands/process-steps/step-8-comic/comic-utils/panel-prompt-utils'
import { validateSceneSourceSegmentCoverage } from '~/cli/commands/process-steps/step-8-comic/comic-utils/source-coverage-utils'
import { parseScriptMarkdownToStructuredData } from '~/cli/commands/process-steps/step-8-comic/comic-utils/structured-script-utils/structured-script-parser'
import type { CharacterCatalogService, LocationReferenceCatalog, PanelPrimaryReferenceInput, ScenePromptData, StructuredScriptSourceSegment } from '~/types'
import { makeTempDir } from '../../../test-utils/temp-dirs'

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
    expect(structured.schemaVersion).toBe(5)
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

    const typed = {
      ...catalog,
      locations: [
        { key: 'base-exterior', name: 'Base Exterior', aliases: ['EXT. AIM BASE — CONTINUOUS'], specification: 'Test.', sourceScripts: [] },
        { key: 'base-interior', name: 'Base Interior', aliases: ['INT. AIM BASE — CONTINUOUS'], specification: 'Test.', sourceScripts: [] },
      ],
    }
    expect(resolveLocationCatalogEntry('EXT. AIM BASE — CONTINUOUS', typed).key).toBe('base-exterior')
    expect(resolveLocationCatalogEntry('INT. AIM BASE — CONTINUOUS', typed).key).toBe('base-interior')
  })

  test('requires panel locationKey to match one source location and rejects transition-spanning panels', () => {
    const location = (key: string) => ({ key, raw: key })
    const segments: StructuredScriptSourceSegment[] = [
      { id: 'beat-0001', type: 'direction', text: 'Room.', sourceSpans: [], location: location('quarters') },
      { id: 'beat-0002', type: 'transition', text: 'Hallway.', sourceSpans: [], location: location('hallway') },
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

  test('snapshots each distinct location once and rejects tampered or missing snapshot manifests on the panel resolution path', async () => {
    const root = await makeTempDir('autoshow-multi-location-snapshots-')
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
        specificationSha256: new Bun.CryptoHasher('sha256').update(entry.specification).digest('hex'),
        views: [{
          view: 'establishing',
          generationId: `generation-${entry.key}`,
          image: sheet,
          imageSha256: new Bun.CryptoHasher('sha256').update(bytes).digest('hex'),
          model: 'fixture',
          createdAt: '2026-01-01T00:00:00.000Z',
        }],
      })
    }
    await Bun.write(join(locations, 'locations-reference.json'), JSON.stringify(catalog))
    await Bun.write(join(locations, 'location-sketches.json'), JSON.stringify({ schemaVersion: 2, sketches }))
    const run = join(root, 'run')
    const manifest = await createLocationReferenceSnapshots(run, ['quarters', 'hallway', 'quarters'])
    expect(manifest.snapshots.every(snapshot => snapshot.sheet.path.startsWith('assets/location-references/'))).toBe(true)
    expect(manifest.snapshots.map(snapshot => snapshot.locationKey)).toEqual(['quarters', 'hallway'])
    const panelInput = (runDirectory: string, index: number, snapshot: { locationKey: string; snapshotId: string }): PanelPrimaryReferenceInput => ({
      panelDirectory: join(runDirectory, 'metadata', 'panel-prompts', `panel-0${index + 1}`),
      entries: [],
      bundleData: {
        schemaVersion: 4,
        snapshotId: 'character-snapshot',
        title: 'Move',
        location: 'quarters then hallway',
        panels: [{
          number: index + 1,
          description: `Panel ${index + 1}.`,
          shotPlan: `Panel ${index + 1} shot.`,
          characterKeys: [],
          speech: [],
          sourceSegmentIds: [`beat-000${index + 1}`],
          sourceSegments: [{ id: `beat-000${index + 1}`, type: 'direction', text: `Panel ${index + 1}.`, sourceSpans: [], location: { key: snapshot.locationKey, raw: snapshot.locationKey } }],
          locationKey: snapshot.locationKey,
          locationSnapshotId: snapshot.snapshotId,
        }],
      },
    })
    const panels = manifest.snapshots.map((snapshot, index) => panelInput(run, index, snapshot))
    expect(resolveLocationReferencesAcrossPanels(panels)).toHaveLength(2)
    const firstAsset = resolve(run, manifest.snapshots[0]!.sheet.path)
    await Bun.write(firstAsset, 'tampered')
    expect(() => resolveLocationReferencesAcrossPanels(panels)).toThrow(/Location snapshot asset was modified/)

    const emptyRun = join(root, 'empty-run')
    await mkdir(join(emptyRun, 'assets'), { recursive: true })
    expect(() => resolveLocationReferencesAcrossPanels([panelInput(emptyRun, 0, manifest.snapshots[0]!)])).toThrow(/Missing location-references\.json/)
  })

  test('composes schema-version-2 views in canonical order and records source provenance', async () => {
    const root = await makeTempDir('autoshow-multi-view-location-')
    roots.push(root)
    const characters = join(root, 'input', 'characters')
    const locations = join(root, 'input', 'locations')
    await mkdir(characters, { recursive: true })
    await mkdir(locations, { recursive: true })
    configureCharactersRoot(characters)
    const location = catalog.locations[0]!
    const establishing = join(locations, 'quarters--reference.png')
    const reverse = join(locations, 'quarters--reference-reverse.png')
    const command = Bun.which('magick') ?? Bun.which('convert')
    if (!command) throw new Error('ImageMagick is required for multi-view location snapshot coverage')
    for (const [path, color] of [[establishing, 'red'], [reverse, 'blue']] as const) {
      const result = Bun.spawnSync([command, '-size', '1x1', `xc:${color}`, path])
      if (result.exitCode !== 0) throw new Error(result.stderr.toString())
    }
    const bytes = async (path: string) => Buffer.from(await Bun.file(path).arrayBuffer())
    await Bun.write(join(locations, 'locations-reference.json'), JSON.stringify({ ...catalog, locations: [location] }))
    await Bun.write(join(locations, 'location-sketches.json'), JSON.stringify({ schemaVersion: 2, sketches: [{
      locationKey: location.key,
      specificationSha256: new Bun.CryptoHasher('sha256').update(location.specification).digest('hex'),
      views: [
        { view: 'establishing', generationId: 'establishing-generation', image: 'quarters--reference.png', imageSha256: new Bun.CryptoHasher('sha256').update(await bytes(establishing)).digest('hex'), model: 'fixture', createdAt: '2026-01-01T00:00:00.000Z' },
        { view: 'reverse', generationId: 'reverse-generation', image: 'quarters--reference-reverse.png', imageSha256: new Bun.CryptoHasher('sha256').update(await bytes(reverse)).digest('hex'), model: 'fixture', createdAt: '2026-01-02T00:00:00.000Z' },
      ],
    }] }))
    const run = join(root, 'run')
    const snapshot = (await createLocationReferenceSnapshots(run, ['quarters'])).snapshots[0]!
    expect(snapshot.schemaVersion).toBe(2)
    expect(snapshot.sourceViews.map(view => [view.view, view.generationId])).toEqual([['establishing', 'establishing-generation'], ['reverse', 'reverse-generation']])
    expect(snapshot.sheet.path).toEndWith('/quarters--reference-sheet.png')
    const identify = Bun.which('identify')
    if (!identify) throw new Error('ImageMagick identify is required for multi-view location snapshot coverage')
    const identified = Bun.spawnSync([identify, '-format', '%wx%h', resolve(run, snapshot.sheet.path)])
    expect(identified.exitCode).toBe(0)
    expect(identified.stdout.toString()).toBe('2x1')
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
    ].join('\n'), 'input/scripts/01-script/02-change-of-venue.md', {
      locationCatalog: catalog,
      characterCatalog: emptyCharacterCatalog,
    })
    const keys = structured.sourceSegments.map(segment => segment.location.key)
    expect(Array.from(new Set(keys))).toEqual(['quarters', 'hallway'])
    expect(keys.indexOf('hallway')).toBeGreaterThan(0)
    expect(keys.slice(keys.indexOf('hallway')).every(key => key === 'hallway')).toBe(true)
  })
})
