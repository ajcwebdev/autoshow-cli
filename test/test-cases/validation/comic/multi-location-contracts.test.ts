import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { createLocationReferenceSnapshots, normalizeLocationKey, resolveLocationCatalogEntry } from '~/cli/commands/process-steps/step-8-comic/comic-utils/location-reference'
import { resolveLocationReferencesAcrossPanels } from '~/cli/commands/process-steps/step-8-comic/comic-utils/panel-prompt-utils'
import { validateSceneSourceSegmentCoverage } from '~/cli/commands/process-steps/step-8-comic/comic-utils/source-coverage-utils'
import { parseScriptMarkdownToStructuredData } from '~/cli/commands/process-steps/step-8-comic/comic-utils/structured-script-utils/structured-script-parser'
import type { CharacterCatalogService, CompiledPanelBlocking, LocationReferenceCatalog, LocationView, PanelPrimaryReferenceInput, ScenePromptData, StructuredScriptSourceSegment } from '~/types'
import * as v from 'valibot'
import { CompiledPanelBlockingSchema } from '~/cli/commands/process-steps/step-8-comic/schemas/blocking-plan-schemas'
import { makeTempDir } from '../../../test-utils/temp-dirs'

const roots: string[] = []
const sha256 = (value: string | Buffer): string => new Bun.CryptoHasher('sha256').update(value).digest('hex')

const compiledBlockingForView = (nearestView: LocationView): CompiledPanelBlocking => v.parse(CompiledPanelBlockingSchema, {
  planSha256: sha256('blocking-plan'),
  stageStateId: 'quarters-open',
  cameraSetupId: `${nearestView}-camera`,
  camera: { position: { x: 0, y: 0 }, heightM: 1.6, lens: 'normal', framing: 'medium', elevation: 'eye', overShoulderOf: null, headingDeg: nearestView === 'reverse' ? 180 : 0, nearestView },
  axis: null,
  ledger: [],
  offFrameRoster: [],
  croppedOnStage: [],
  extrasInFrame: [],
  dressingInFrame: '',
  anchorsInFrame: [],
  lines: { camera: `Camera "${nearestView}-camera".`, ledger: [], offFrame: '', wardrobe: '', extras: '', dressing: '', anchors: '' },
})

const viewPanelInput = (runDirectory: string, snapshotId: string, locationKey: string, nearestView?: LocationView): PanelPrimaryReferenceInput => ({
  panelDirectory: join(runDirectory, 'metadata', 'panel-prompts', 'panel-01'),
  entries: [],
  bundleData: {
    schemaVersion: 4,
    snapshotId: 'character-snapshot',
    title: 'Quarters',
    location: locationKey,
    panels: [{
      number: 1,
      description: 'A panel.',
      shotPlan: 'A shot.',
      characterKeys: [],
      speech: [],
      sourceSegmentIds: ['beat-0001'],
      sourceSegments: [{ id: 'beat-0001', type: 'direction', text: 'A panel.', sourceSpans: [], location: { key: locationKey, raw: locationKey } }],
      locationKey,
      locationSnapshotId: snapshotId,
    }],
    ...(nearestView ? { blocking: compiledBlockingForView(nearestView), planSha256: sha256('blocking-plan') } : {}),
  },
})
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
    expect(normalizeLocationKey('INT. MESS HALL - SHORTLY AFTER')).toBe('mess-hall')
    expect(normalizeLocationKey('INT. MESS HALL - NEXT DAY')).toBe('mess-hall')
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
    expect(manifest.schemaVersion).toBe(3)
    expect(manifest.snapshots.every(snapshot => snapshot.schemaVersion === 3)).toBe(true)
    expect(manifest.snapshots.every(snapshot => snapshot.views.every(view => view.path.startsWith('assets/location-references/')))).toBe(true)
    expect(manifest.snapshots.map(snapshot => snapshot.views.map(view => view.path.split('/').at(-1)))).toEqual([['quarters--establishing.png'], ['hallway--establishing.png']])
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
    const firstAsset = resolve(run, manifest.snapshots[0]!.views[0]!.path)
    await Bun.write(firstAsset, 'tampered')
    expect(() => resolveLocationReferencesAcrossPanels(panels)).toThrow(/Location snapshot asset was modified/)

    const emptyRun = join(root, 'empty-run')
    await mkdir(join(emptyRun, 'assets'), { recursive: true })
    expect(() => resolveLocationReferencesAcrossPanels([panelInput(emptyRun, 0, manifest.snapshots[0]!)])).toThrow(/Missing location-references\.json/)
  })

  test('registers every view separately in a schema-version-3 snapshot without ImageMagick and selects the camera-matched view', async () => {
    const root = await makeTempDir('autoshow-multi-view-location-')
    roots.push(root)
    const characters = join(root, 'input', 'characters')
    const locations = join(root, 'input', 'locations')
    await mkdir(characters, { recursive: true })
    await mkdir(locations, { recursive: true })
    configureCharactersRoot(characters)
    const location = catalog.locations[0]!
    const viewBytes = { establishing: Buffer.from('establishing-pixels'), reverse: Buffer.from('reverse-pixels') } as const
    await Bun.write(join(locations, 'quarters--reference.png'), viewBytes.establishing)
    await Bun.write(join(locations, 'quarters--reference-reverse.png'), viewBytes.reverse)
    await Bun.write(join(locations, 'locations-reference.json'), JSON.stringify({ ...catalog, locations: [location] }))
    await Bun.write(join(locations, 'location-sketches.json'), JSON.stringify({ schemaVersion: 2, sketches: [{
      locationKey: location.key,
      specificationSha256: sha256(location.specification),
      views: [
        { view: 'establishing', generationId: 'establishing-generation', image: 'quarters--reference.png', imageSha256: sha256(viewBytes.establishing), model: 'fixture', createdAt: '2026-01-01T00:00:00.000Z' },
        { view: 'reverse', generationId: 'reverse-generation', image: 'quarters--reference-reverse.png', imageSha256: sha256(viewBytes.reverse), model: 'fixture', createdAt: '2026-01-02T00:00:00.000Z', lineage: 'clean' },
      ],
    }] }))
    const run = join(root, 'run')
    const manifest = await createLocationReferenceSnapshots(run, ['quarters'])
    const snapshot = manifest.snapshots[0]!
    expect(manifest.schemaVersion).toBe(3)
    expect(snapshot.schemaVersion).toBe(3)
    expect(snapshot.views.map(view => [view.view, view.generationId])).toEqual([['establishing', 'establishing-generation'], ['reverse', 'reverse-generation']])
    expect(snapshot.views.map(view => view.path.split('/').at(-1))).toEqual(['quarters--establishing.png', 'quarters--reverse.png'])
    expect(snapshot.views.map(view => view.label)).toEqual(['establishing view of quarters', 'reverse view of quarters'])
    for (const view of snapshot.views) {
      const copied = Buffer.from(await Bun.file(resolve(run, view.path)).arrayBuffer())
      expect(copied.equals(viewBytes[view.view as 'establishing' | 'reverse'])).toBe(true)
      expect(sha256(copied)).toBe(view.imageSha256)
    }

    const panel = viewPanelInput(run, snapshot.snapshotId, 'quarters')
    expect(resolveLocationReferencesAcrossPanels([panel]).map(reference => reference.view)).toEqual(['establishing'])
    expect(resolveLocationReferencesAcrossPanels([panel], { cameraMatched: true }).map(reference => reference.view)).toEqual(['establishing'])
    const reversePanel = viewPanelInput(run, snapshot.snapshotId, 'quarters', 'reverse')
    const matched = resolveLocationReferencesAcrossPanels([reversePanel], { cameraMatched: true })[0]!
    expect(matched.view).toBe('reverse')
    expect(matched.path).toEndWith('/quarters--reverse.png')
    expect(matched.views.map(view => view.view)).toEqual(['establishing', 'reverse'])
    expect(resolveLocationReferencesAcrossPanels([reversePanel]).map(reference => reference.view)).toEqual(['establishing'])
    expect(resolveLocationReferencesAcrossPanels([reversePanel, reversePanel], { cameraMatched: true }).map(reference => reference.view)).toEqual(['establishing'])
  })

  test('reads a hand-built schema-version-2 snapshot manifest for backward compatibility', async () => {
    const root = await makeTempDir('autoshow-v2-snapshot-compat-')
    roots.push(root)
    const run = join(root, 'run')
    const snapshotId = '1767225600000-v2compatible'
    const sheetRelativePath = `assets/location-references/${snapshotId}/quarters--reference-sheet.png`
    const sheetBytes = Buffer.from('legacy-composed-sheet')
    await Bun.write(join(run, sheetRelativePath), sheetBytes)
    await Bun.write(join(run, 'assets', 'location-references.json'), JSON.stringify({
      schemaVersion: 2,
      snapshots: [{
        schemaVersion: 2,
        snapshotId,
        locationKey: 'quarters',
        specification: 'Quarters.',
        sourceScripts: [],
        sourceViews: [
          { view: 'establishing', generationId: 'establishing-generation', imageSha256: sha256(Buffer.from('establishing-pixels')) },
          { view: 'reverse', generationId: 'reverse-generation', imageSha256: sha256(Buffer.from('reverse-pixels')) },
        ],
        sheet: { path: sheetRelativePath, sha256: sha256(sheetBytes) },
      }],
    }))
    const resolved = resolveLocationReferencesAcrossPanels([viewPanelInput(run, snapshotId, 'quarters')])[0]!
    expect(resolved.view).toBe('establishing')
    expect(resolved.path).toBe(resolve(run, sheetRelativePath))
    expect(resolved.views).toHaveLength(1)
    expect(resolved.views[0]!.label).toBe('composed reference sheet of quarters (establishing, reverse views left to right)')
    const cameraMatched = resolveLocationReferencesAcrossPanels([viewPanelInput(run, snapshotId, 'quarters', 'reverse')], { cameraMatched: true })[0]!
    expect(cameraMatched.view).toBe('establishing')
    expect(cameraMatched.path).toBe(resolve(run, sheetRelativePath))
    await Bun.write(join(run, sheetRelativePath), 'tampered')
    expect(() => resolveLocationReferencesAcrossPanels([viewPanelInput(run, snapshotId, 'quarters')])).toThrow(/Location snapshot asset was modified/)
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
