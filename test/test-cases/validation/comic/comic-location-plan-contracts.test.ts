import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { buildLocationViewCameraFacts, locationReferenceSketchCommand } from '~/cli/commands/process-steps/step-8-comic/comic-commands/reference-sketch/location-reference-command'
import { computeLocationPlanGeometrySha256, findLocationPlan, getLocationPlansPath, LOCATION_PLANS_SCHEMA_VERSION, readLocationPlans, readLocationPlansSync, stampLocationPlanGeometrySha256 } from '~/cli/commands/process-steps/step-8-comic/comic-utils/location-plan-records'
import { getLocationSketchManifestPath } from '~/cli/commands/process-steps/step-8-comic/comic-utils/location-reference'
import { captureLogEvents } from '../../../test-utils/console-capture'
import type { LocationPlanEntry, LocationViewQaResult } from '~/types'
import { sha256Bytes } from '~/utils/value-helpers'
import { makeTempDir } from '../../../test-utils/temp-dirs'

const roots: string[] = []
const image = Buffer.from('mock-image')
const SPECIFICATION = 'A cargo bay whose fixed loading door faces the wall rails across a wide deck, with a workbench along the right wall.'

const anchor = (overrides: Partial<LocationPlanEntry['anchors'][number]> = {}): LocationPlanEntry['anchors'][number] => ({
  key: 'loading door',
  position: { x: 0, y: 12 },
  footprint: null,
  wall: 'rear',
  facingDeg: null,
  longAxis: null,
  ...overrides,
})

const planEntry = (overrides: Partial<Omit<LocationPlanEntry, 'geometrySha256'>> = {}): LocationPlanEntry => stampLocationPlanGeometrySha256({
  locationKey: 'cargo-bay',
  reviewStatus: 'reviewed',
  reviewedBy: 'anthony',
  reviewedAt: '2026-09-02T00:00:00.000Z',
  drawing: null,
  roomExtent: { width: 10, depth: 14 },
  anchors: [
    anchor(),
    anchor({ key: 'workbench', position: { x: 4, y: 6 }, footprint: { width: 1, depth: 3 }, wall: 'right', facingDeg: 270, longAxis: 'y' }),
  ],
  cameraCells: [{ id: 'door', position: { x: 0, y: 13 }, heightM: 1.6 }],
  ...overrides,
})

const record = (plans: LocationPlanEntry[] = [planEntry()]) => ({ schemaVersion: LOCATION_PLANS_SCHEMA_VERSION, plans })

const fixture = async () => {
  const root = await makeTempDir('autoshow-location-plans-')
  roots.push(root)
  const characters = join(root, 'input', 'characters')
  const locations = join(root, 'input', 'locations')
  await mkdir(characters, { recursive: true })
  await mkdir(locations, { recursive: true })
  await Bun.write(join(characters, 'style-guide.webp'), image)
  await Bun.write(join(locations, 'locations-reference.json'), JSON.stringify({
    schemaVersion: 1,
    styleImage: 'input/characters/style-guide.webp',
    locations: [{ key: 'cargo-bay', name: 'Cargo Bay', aliases: [], specification: SPECIFICATION, sourceScripts: [] }],
  }))
  await Bun.write(join(locations, 'location-sketches.json'), JSON.stringify({ schemaVersion: 2, sketches: [] }))
  configureCharactersRoot(characters)
  return { root, locations }
}

const writePlans = async (locations: string, value: unknown): Promise<void> => {
  await Bun.write(join(locations, 'location-plans.json'), JSON.stringify(value))
}

const qa = (overrides: Partial<LocationViewQaResult> = {}): LocationViewQaResult => ({
  pass: true,
  stableFeaturesMatch: true,
  crossViewGeometryMatch: true,
  requestedAngleMatch: true,
  materiallyDistinctFromExistingViews: true,
  houseStyleMatch: true,
  noPeople: true,
  noCopiedStyleContent: true,
  failedChecks: [],
  editInstructions: '',
  summary: 'Pass.',
  ...overrides,
})

afterEach(async () => {
  configureCharactersRoot('input/characters')
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('reviewed location geometry records', () => {
  test('treats an absent location-plans.json as an empty record on both read paths', async () => {
    const { locations } = await fixture()
    expect(getLocationPlansPath()).toBe(join(locations, 'location-plans.json'))
    expect(await readLocationPlans()).toEqual({ schemaVersion: 1, plans: [] })
    expect(readLocationPlansSync()).toEqual({ schemaVersion: 1, plans: [] })
    expect(findLocationPlan(readLocationPlansSync(), 'cargo-bay')).toBeUndefined()
  })

  test('accepts a reviewed record whose anchors are grounded in the specification', async () => {
    const { locations } = await fixture()
    await writePlans(locations, record())
    const plans = await readLocationPlans()
    expect(plans.plans.map(plan => plan.locationKey)).toEqual(['cargo-bay'])
    expect(findLocationPlan(plans, 'cargo-bay')?.anchors.map(item => item.key)).toEqual(['loading door', 'workbench'])
    expect(readLocationPlansSync()).toEqual(plans)
  })

  test('hashes geometry canonically and independently of key order', () => {
    const entry = planEntry()
    const reordered = { geometrySha256: entry.geometrySha256, cameraCells: entry.cameraCells, anchors: entry.anchors, roomExtent: entry.roomExtent, drawing: entry.drawing, reviewedAt: entry.reviewedAt, reviewedBy: entry.reviewedBy, reviewStatus: entry.reviewStatus, locationKey: entry.locationKey }
    expect(computeLocationPlanGeometrySha256(reordered)).toBe(entry.geometrySha256)
    expect(computeLocationPlanGeometrySha256({ ...entry, roomExtent: { width: 10, depth: 15 } })).not.toBe(entry.geometrySha256)
  })

  test('rejects a plan for a location that is not in the catalog', async () => {
    const { locations } = await fixture()
    await writePlans(locations, record([planEntry({ locationKey: 'engine-room' })]))
    await expect(readLocationPlans()).rejects.toThrow('Location plan "engine-room" is not a catalog location')
  })

  test('rejects an anchor that is not a substring of the specification', async () => {
    const { locations } = await fixture()
    await writePlans(locations, record([planEntry({ anchors: [anchor({ key: 'grav lift' })] })]))
    await expect(readLocationPlans()).rejects.toThrow('Location plan "cargo-bay" anchor "grav lift" is not a substring of the "cargo-bay" specification')
  })

  test('grounds anchors case-insensitively after collapsing whitespace', async () => {
    const { locations } = await fixture()
    await writePlans(locations, record([planEntry({ anchors: [anchor({ key: 'Loading   Door' })] })]))
    expect((await readLocationPlans()).plans[0]!.anchors[0]!.key).toBe('Loading   Door')
  })

  test('rejects a geometrySha256 that does not match the geometry', async () => {
    const { locations } = await fixture()
    const entry = planEntry()
    await writePlans(locations, record([{ ...entry, geometrySha256: sha256Bytes('tampered') }]))
    await expect(readLocationPlans()).rejects.toThrow(`Location plan "cargo-bay" geometrySha256 does not match its geometry (expected ${entry.geometrySha256})`)
  })

  test('rejects a camera cell that sits inside a reviewed anchor footprint', async () => {
    const { locations } = await fixture()
    await writePlans(locations, record([planEntry({ cameraCells: [{ id: 'bench', position: { x: 4, y: 6 }, heightM: 1.6 }] })]))
    await expect(readLocationPlans()).rejects.toThrow('Location plan "cargo-bay" camera cell "bench" sits inside the "workbench" footprint')
  })

  test('rejects a duplicate location and an unknown field', async () => {
    const { locations } = await fixture()
    await writePlans(locations, record([planEntry(), planEntry()]))
    await expect(readLocationPlans()).rejects.toThrow('Location plan "cargo-bay" is listed more than once')
    await writePlans(locations, { schemaVersion: 1, plans: [{ ...planEntry(), notes: 'extra' }] })
    await expect(readLocationPlans()).rejects.toThrow(/Invalid location plans at .*location-plans\.json/)
  })

  test('rejects a missing drawing and a drawing whose bytes changed', async () => {
    const { locations } = await fixture()
    const drawing = Buffer.from('floor-plan-bytes')
    await writePlans(locations, record([planEntry({ drawing: { path: 'plans/cargo-bay--floor-plan.png', sha256: sha256Bytes(drawing) } })]))
    await expect(readLocationPlans()).rejects.toThrow('Location plan "cargo-bay" drawing plans/cargo-bay--floor-plan.png is missing under the locations root')
    await Bun.write(join(locations, 'plans', 'cargo-bay--floor-plan.png'), drawing)
    expect((await readLocationPlans()).plans[0]!.drawing?.path).toBe('plans/cargo-bay--floor-plan.png')
    await Bun.write(join(locations, 'plans', 'cargo-bay--floor-plan.png'), 'redrawn')
    await expect(readLocationPlans()).rejects.toThrow('Location plan "cargo-bay" drawing plans/cargo-bay--floor-plan.png does not match its registered sha256')
  })

  test('rejects a drawing path that escapes the locations root', async () => {
    const { locations } = await fixture()
    await writePlans(locations, record([planEntry({ drawing: { path: '../characters/style-guide.webp', sha256: sha256Bytes(image) } })]))
    await expect(readLocationPlans()).rejects.toThrow('escapes the locations root')
  })
})

describe('reviewed geometry facts for alternate location views', () => {
  test('supplies no camera facts for the establishing view', () => {
    expect(buildLocationViewCameraFacts(planEntry(), 'establishing')).toBeUndefined()
  })

  test('projects reviewed anchors symmetrically from the establishing and reverse cameras', () => {
    const facts = buildLocationViewCameraFacts(planEntry(), 'reverse')!
    expect(facts.cameraCell).toEqual({ id: 'door', position: { x: 0, y: 13 }, heightM: 1.6, synthetic: false })
    expect(facts.headingDeg).toBe(180)
    const workbench = facts.anchors.find(item => item.key === 'workbench')!
    expect(workbench.establishingProjection).toBe('workbench: screen-right, far, long edge receding, left face toward camera')
    expect(workbench.projection).toBe('workbench: screen-left, far, long edge receding, right face toward camera')
    const door = facts.anchors.find(item => item.key === 'loading door')!
    expect(door.inFrame).toBe(true)
    expect(door.establishingProjection).toContain('far')
    expect(door.projection).toContain('near')
    expect(facts.text).toContain('Behind or beside this camera and therefore out of frame: none.')
    expect(facts.text).toContain('never reproduce the establishing screen sides or the establishing camera axis')

    const behind = buildLocationViewCameraFacts(planEntry({ cameraCells: [{ id: 'far-corner', position: { x: 0, y: 13 }, heightM: 1.6 }], anchors: [anchor({ key: 'loading door', position: { x: 0, y: 13.5 } })] }), 'reverse')!
    expect(behind.anchors[0]!.inFrame).toBe(false)
    expect(behind.text).toContain('Behind or beside this camera and therefore out of frame: loading door.')
    expect(behind.text).toContain('none of the reviewed anchors fall inside the frame')
  })

  test('synthesizes a camera cell when no reviewed cell faces the requested way', () => {
    const facts = buildLocationViewCameraFacts(planEntry({ cameraCells: [] }), 'reverse')!
    expect(facts.cameraCell.synthetic).toBe(true)
    expect(facts.cameraCell.id).toBe('synthetic-reverse')
    expect(facts.text).toContain('synthesized from the reviewed room extent because no reviewed camera cell faces this way')
    const side = buildLocationViewCameraFacts(planEntry({ cameraCells: [] }), 'side')!
    expect(side.cameraCell.id).toBe('synthetic-side')
    expect(Math.round(side.headingDeg)).toBe(270)
    expect(side.text).toContain('perpendicular to the establishing axis')
  })

  test('feeds the reviewed camera facts to the view prompt and the judge, and warns about mixed lineage', async () => {
    const { locations } = await fixture()
    await writePlans(locations, record())
    await Bun.write(join(locations, 'cargo-bay--reference.png'), image)
    await Bun.write(join(locations, 'location-sketches.json'), JSON.stringify({
      schemaVersion: 2,
      sketches: [{
        locationKey: 'cargo-bay',
        specificationSha256: sha256Bytes(SPECIFICATION),
        views: [{ view: 'establishing', generationId: 'canonical', image: 'cargo-bay--reference.png', imageSha256: sha256Bytes(image), model: 'existing-canonical-art', createdAt: '2026-01-01T00:00:00.000Z' }],
      }],
    }))
    const prompts: string[] = []
    const judgedFacts: Array<string | undefined> = []
    const models: string[] = []
    const { events } = await captureLogEvents(async () => {
      await locationReferenceSketchCommand({ location: 'cargo-bay', view: 'reverse', qa: true, maxRepairs: 1, imageModels: ['gpt-image-2'] }, {
        requestImage: async (prompt, _references, model) => { prompts.push(prompt); models.push(model); return { mode: 'generate', result: { imageBase64: image.toString('base64') } } },
        writeImage: async path => { await Bun.write(path, image) },
        judgeView: async input => { judgedFacts.push(input.cameraFacts); return qa() },
        generationId: () => 'reverse-generation',
      })
    })
    expect(prompts).toHaveLength(1)
    expect(models).toEqual(['gpt-image-2'])
    expect(prompts[0]).toContain('Camera cell "door"')
    expect(prompts[0]).toContain('Reviewed geometry for the reverse view')
    expect(judgedFacts[0]).toContain('Camera cell "door"')
    const warning = events.find(event => typeof event.message === 'string' && event.message.startsWith('Lineage:'))
    expect(warning?.message).toBe('Lineage: establishing view for cargo-bay is existing-canonical-art; a reverse view generated from it is mixed lineage')
    expect(warning?.metadata).toMatchObject({ location: 'cargo-bay', view: 'reverse', lineage: 'mixed' })
    const manifest = JSON.parse(await Bun.file(getLocationSketchManifestPath()).text())
    expect(manifest.sketches[0].views.map((view: { view: string; lineage?: string }) => [view.view, view.lineage])).toEqual([['establishing', undefined], ['reverse', 'mixed']])
  })
})
