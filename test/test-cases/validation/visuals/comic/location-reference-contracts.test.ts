import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'
import { configureCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import * as imageReferenceCapabilities from '~/cli/commands/setup-and-utilities/models/image-reference-capabilities'
import { locationReferenceSketchCommand } from '~/cli/commands/visuals/comic/comic-commands/reference-sketch/location-reference-command'
import {
  LOCATION_PROMOTION_TRANSACTION_BOUNDARIES,
  promoteLocationRegistrationTransaction,
} from '~/cli/commands/visuals/comic/comic-commands/reference-sketch/location-reference-transaction'
import { getLocationReferencePath, getLocationSketchManifestPath, readLocationReferenceCatalog, readLocationSketchManifest } from '~/cli/commands/visuals/comic/comic-utils/location-reference'
import { captureLogEvents } from '../../../../test-utils/console-capture'
import { tinyPngFixture } from '../../../../test-utils/character-catalog-fixture'
import type { LocationReferenceCommandDependencies, LocationView } from '~/types'
import { sha256Bytes } from '~/utils/value-helpers'
import { encodeTestPngRows } from './comic-panel-selection-fixtures'
import { makeTempDir } from '../../../../test-utils/temp-dirs'

const roots: string[] = []
const styleBytes = Buffer.from('style-reference')
const png = Buffer.from(tinyPngFixture().toString('base64'), 'base64')
const SPECIFICATION = 'Fixed loading door.'
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>

const fixture = async () => {
  const root = await makeTempDir('autoshow-location-reference-')
  roots.push(root)
  const characters = join(root, 'input', 'characters')
  const locations = join(root, 'input', 'locations')
  await mkdir(characters, { recursive: true })
  await mkdir(locations, { recursive: true })
  await Bun.write(join(characters, 'style-guide.webp'), styleBytes)
  await Bun.write(join(locations, 'locations-reference.json'), JSON.stringify({ schemaVersion: 1, styleImage: 'input/characters/style-guide.webp', locations: [] }))
  await Bun.write(join(locations, 'location-sketches.json'), JSON.stringify({ schemaVersion: 2, sketches: [] }))
  const scripts = join(root, 'input', 'scripts', '02-script')
  await mkdir(scripts, { recursive: true })
  await Bun.write(join(scripts, '01-cargo.md'), '# Episode\n\n**INT. CARGO BAY – MORNING**\n\nCrates line fixed wall rails. A mechanic drops a temporary wrench.')
  await Bun.write(join(scripts, '02-cargo.md'), '# Episode\n\n**INT. CARGO BAY – NIGHT**\n\nThe fixed loading door faces the wall rails. Damage smolders beside the captain.')
  configureCharactersRoot(characters)
  return { root, locations }
}

type SeedView = { view: LocationView; bytes: Buffer; model: string; generationId?: string; lineage?: 'clean' | 'mixed' }

const viewFilename = (view: LocationView): string => view === 'establishing' ? 'cargo-bay--reference.png' : `cargo-bay--reference-${view}.png`

/** Registers a catalogued cargo-bay location with the given canonical views and returns the exact seeded bytes. */
const seedRegistered = async (locations: string, views: SeedView[]) => {
  const catalog = { schemaVersion: 1, styleImage: 'input/characters/style-guide.webp', locations: [{ key: 'cargo-bay', name: 'Cargo Bay', specification: SPECIFICATION, sourceScripts: [] }] }
  for (const item of views) await Bun.write(join(locations, viewFilename(item.view)), item.bytes)
  const manifest = { schemaVersion: 2, sketches: [{ locationKey: 'cargo-bay', specificationSha256: sha256Bytes(SPECIFICATION), views: views.map(item => ({
    view: item.view,
    generationId: item.generationId ?? `${item.view}-old`,
    image: viewFilename(item.view),
    imageSha256: sha256Bytes(item.bytes),
    model: item.model,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...(item.lineage ? { lineage: item.lineage } : {}),
  })) }] }
  const catalogBytes = `${JSON.stringify(catalog)}\n`
  const manifestBytes = `${JSON.stringify(manifest)}\n`
  await Bun.write(getLocationReferencePath(), catalogBytes)
  await Bun.write(getLocationSketchManifestPath(), manifestBytes)
  return { catalogBytes, manifestBytes }
}

/** Fake provider ledger: counts image requests and aggregation calls; writes the returned bytes verbatim. */
const ledger = (generationId: string, bytes: Buffer = png) => {
  const calls = { image: 0, aggregate: 0, prompts: [] as string[], references: [] as string[][], models: [] as string[] }
  const dependencies: LocationReferenceCommandDependencies = {
    aggregateSpecification: async () => { calls.aggregate++; return { name: 'Cargo Bay', specification: SPECIFICATION } },
    requestImage: async (prompt, references, model) => {
      calls.image++
      calls.prompts.push(prompt)
      calls.references.push(references)
      calls.models.push(model)
      return { mode: 'generate', result: { imageBase64: bytes.toString('base64') } }
    },
    writeImage: async (path, base64) => { await mkdir(dirname(path), { recursive: true }); await Bun.write(path, Buffer.from(base64, 'base64')) },
    generationId: () => generationId,
  }
  return { calls, dependencies }
}

const listFiles = async (root: string): Promise<string[]> => (await readdir(root, { recursive: true })).map(String).sort()

beforeEach(() => {
  // Any judge, vision, or other network dispatch would surface here; the fake providers never call fetch.
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async () => { throw new Error('unexpected network dispatch in location reference test') }) as unknown as typeof fetch)
})

afterEach(async () => {
  fetchSpy.mockRestore()
  configureCharactersRoot('input/characters')
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('canonical location reference registration', () => {
  test('keeps validate, prepare, generate, and promote phases explicit with rollback outside generation and no judge path', () => {
    const commandPath = resolve(process.cwd(), 'src/cli/commands/visuals/comic/comic-commands/reference-sketch/location-reference-command.ts')
    const transactionPath = resolve(process.cwd(), 'src/cli/commands/visuals/comic/comic-commands/reference-sketch/location-reference-transaction.ts')
    const declarations = (path: string): Map<string, ts.Expression> => {
      const sourceFile = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
      const found = new Map<string, ts.Expression>()
      const visit = (node: ts.Node): void => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) found.set(node.name.text, node.initializer)
        ts.forEachChild(node, visit)
      }
      visit(sourceFile)
      return found
    }
    const commandDeclarations = declarations(commandPath)
    const coordinator = commandDeclarations.get('locationReferenceSketchCommand')!
    const coordinatorText = coordinator.getText()
    const phaseCalls = [
      'resolveLocationReferenceRequest(',
      'loadLocationReferenceContext(',
      'runLocationViewGeneration(',
      'promoteLocationRegistrationTransaction(',
    ].map(call => coordinatorText.indexOf(call))
    expect(phaseCalls.every(index => index >= 0)).toBe(true)
    expect(phaseCalls).toEqual([...phaseCalls].sort((left, right) => left - right))
    expect(commandDeclarations.get('runLocationViewGeneration')?.getText()).not.toContain('rollback')
    let coordinatorTryCount = 0
    const countTryStatements = (node: ts.Node): void => {
      if (ts.isTryStatement(node)) coordinatorTryCount++
      ts.forEachChild(node, countTryStatements)
    }
    countTryStatements(coordinator)
    expect(coordinatorTryCount).toBe(0)
    expect(declarations(transactionPath).get('promoteLocationRegistrationTransaction')?.getText()).toContain('rollbackLocationRegistrationTransaction')
    expect(readFileSync(commandPath, 'utf8').match(/judge|\bqa\b|maxRepairs|visionProvider|failedChecks/gi) ?? []).toEqual([])
  })

  test('derives a missing location catalog style reference from the configured character catalog', async () => {
    const root = await makeTempDir('autoshow-location-default-style-')
    roots.push(root)
    const characters = join(root, 'input', 'characters')
    await mkdir(characters, { recursive: true })
    await Bun.write(join(characters, 'artist.webp'), styleBytes)
    await Bun.write(join(characters, 'characters-reference.json'), JSON.stringify({ schemaVersion: 3, characters: [{ key: 'artist', name: 'Artist', aliases: [], image: 'artist.webp', outlineSheet: 'artist.webp', description: 'Style.' }], groupAliases: [] }))
    configureCharactersRoot(characters)
    expect(await readLocationReferenceCatalog()).toEqual({ schemaVersion: 1, styleImage: '../characters/artist.webp', locations: [] })
  })

  test('fresh establishing view: one aggregation call, exactly one image request, zero network/judge calls; decoded PNG registered with the selected model', async () => {
    const { locations } = await fixture()
    const { calls, dependencies } = ledger('establishing-generation')
    dependencies.aggregateSpecification = async ({ scripts }) => { calls.aggregate++; expect(scripts).toHaveLength(2); return { name: 'Cargo Bay', specification: 'Fixed wall rails opposite a loading door.' } }
    await locationReferenceSketchCommand({ location: 'cargo-bay', imageModels: ['gpt-image-2.6-flare'] }, dependencies)
    expect(calls.aggregate).toBe(1)
    expect(calls.image).toBe(1)
    expect(fetchSpy).toHaveBeenCalledTimes(0)
    expect(calls.models).toEqual(['gpt-image-2.6-flare'])
    expect(calls.references[0]).toEqual([join(dirname(locations), 'characters', 'style-guide.webp')])
    const manifest = JSON.parse(await Bun.file(getLocationSketchManifestPath()).text())
    expect(manifest.schemaVersion).toBe(2)
    expect(manifest.sketches[0].views).toHaveLength(1)
    expect(manifest.sketches[0].views[0]).toMatchObject({ view: 'establishing', image: 'cargo-bay--reference.png', model: 'gpt-image-2.6-flare', generationId: 'establishing-generation', lineage: 'clean', imageSha256: sha256Bytes(png) })
    expect(manifest.sketches[0].views[0].priorGenerationId).toBeUndefined()
    expect(Buffer.from(await Bun.file(join(locations, 'cargo-bay--reference.png')).arrayBuffer())).toEqual(png)
    expect((await readLocationReferenceCatalog()).locations).toEqual([{
      key: 'cargo-bay',
      name: 'Cargo Bay',
      specification: 'Fixed wall rails opposite a loading door.',
      sourceScripts: ['scripts/02-script/01-cargo.md', 'scripts/02-script/02-cargo.md'],
    }])
    expect(await Bun.file(join(locations, '.attempts', 'cargo-bay', 'establishing-generation')).exists()).toBe(false)
    expect((await listFiles(locations)).filter(path => /qa|judge|attempt-\d/i.test(path))).toEqual([])
  })

  test('explicit --revise --notes: exactly one image request with the notes and prior view as reference, zero network/judge calls, lineage and model recorded', async () => {
    const { locations } = await fixture()
    const oldImage = Buffer.from('old-canonical')
    await seedRegistered(locations, [{ view: 'establishing', bytes: oldImage, model: 'gpt-image-2.6-flare', generationId: 'old' }])
    const { calls, dependencies } = ledger('revised')
    await locationReferenceSketchCommand({ location: 'cargo-bay', revise: true, notes: 'Move the camera farther back.', imageModels: ['gpt-image-2.6-flare'] }, dependencies)
    expect(calls.image).toBe(1)
    expect(calls.aggregate).toBe(0)
    expect(fetchSpy).toHaveBeenCalledTimes(0)
    expect(calls.prompts[0]).toContain('Revision notes: Move the camera farther back.')
    expect(calls.references[0]?.[0]).toBe(join(locations, 'cargo-bay--reference.png'))
    const view = (await readLocationSketchManifest()).sketches[0]!.views[0]!
    expect(view).toMatchObject({ view: 'establishing', generationId: 'revised', priorGenerationId: 'old', model: 'gpt-image-2.6-flare', lineage: 'clean', imageSha256: sha256Bytes(png) })
    expect(Buffer.from(await Bun.file(join(locations, 'cargo-bay--reference.png')).arrayBuffer())).toEqual(png)
  })

  test('a registered view is reused with zero image, aggregation, or network calls and no file changes', async () => {
    const { locations } = await fixture()
    const seeded = await seedRegistered(locations, [{ view: 'establishing', bytes: Buffer.from('establishing'), model: 'fixture' }, { view: 'reverse', bytes: Buffer.from('reverse'), model: 'fixture' }])
    const before = await listFiles(locations)
    for (const view of ['establishing', 'reverse'] as const) {
      const { calls, dependencies } = ledger(`noop-${view}`)
      await locationReferenceSketchCommand({ location: 'cargo-bay', view }, dependencies)
      expect(calls.image).toBe(0)
      expect(calls.aggregate).toBe(0)
    }
    expect(fetchSpy).toHaveBeenCalledTimes(0)
    expect(await listFiles(locations)).toEqual(before)
    expect(await Bun.file(getLocationReferencePath()).text()).toBe(seeded.catalogBytes)
    expect(await Bun.file(getLocationSketchManifestPath()).text()).toBe(seeded.manifestBytes)
  })

  test('requires establishing, adds side and reverse, treats reverse as a no-op, then revises only reverse', async () => {
    const { locations } = await fixture()
    await seedRegistered(locations, [{ view: 'establishing', bytes: Buffer.from('establishing'), model: 'fixture', generationId: 'establishing-old' }])
    let calls = 0
    const dependencies = (generationId: string): LocationReferenceCommandDependencies => ({ requestImage: async () => { calls++; return { mode: 'generate', result: { imageBase64: png.toString('base64') } } }, writeImage: async (path: string) => { await Bun.write(path, png) }, generationId: () => generationId })
    await expect(locationReferenceSketchCommand({ location: 'cargo-bay', view: 'side' }, dependencies('side'))).resolves.toBeUndefined()
    expect(calls).toBe(1)
    await locationReferenceSketchCommand({ location: 'cargo-bay', view: 'reverse' }, dependencies('reverse-new'))
    expect(calls).toBe(2)
    await locationReferenceSketchCommand({ location: 'cargo-bay', view: 'reverse' }, dependencies('reverse-noop'))
    expect(calls).toBe(2)
    await locationReferenceSketchCommand({ location: 'cargo-bay', view: 'reverse', revise: true, notes: 'Move farther back.' }, dependencies('reverse-revised'))
    expect(calls).toBe(3)
    const registration = (await readLocationSketchManifest()).sketches[0]!
    expect(registration.views.map(view => view.view)).toEqual(['establishing', 'reverse', 'side'])
    expect(registration.views.find(view => view.view === 'reverse')?.priorGenerationId).toBe('reverse-new')
    expect(registration.views.find(view => view.view === 'establishing')?.generationId).toBe('establishing-old')
  })

  test('rejects reverse and side views before establishing without any image request', async () => {
    await fixture()
    for (const view of ['reverse', 'side'] as const) {
      const { calls, dependencies } = ledger(`early-${view}`)
      await expect(locationReferenceSketchCommand({ location: 'cargo-bay', view }, dependencies)).rejects.toThrow('before its establishing view')
      expect(calls.image).toBe(0)
      expect(calls.aggregate).toBe(0)
    }
    expect(JSON.parse(await Bun.file(getLocationSketchManifestPath()).text()).sketches).toEqual([])
  })

  test('records clean lineage for a reverse view generated by the same model as its establishing view', async () => {
    const { locations } = await fixture()
    await seedRegistered(locations, [{ view: 'establishing', bytes: Buffer.from('establishing'), model: 'gpt-image-2.6-flare', lineage: 'clean' }])
    const { calls, dependencies } = ledger('reverse-clean')
    const { events } = await captureLogEvents(async () => {
      await locationReferenceSketchCommand({ location: 'cargo-bay', view: 'reverse', imageModels: ['gpt-image-2.6-flare'] }, dependencies)
    })
    expect(calls.image).toBe(1)
    expect(calls.references[0]?.[0]).toBe(join(locations, 'cargo-bay--reference.png'))
    expect(events.some(event => event.message.startsWith('Lineage:'))).toBe(false)
    const views = (await readLocationSketchManifest()).sketches[0]!.views
    expect(views.map(view => [view.view, view.model, view.lineage])).toEqual([['establishing', 'gpt-image-2.6-flare', 'clean'], ['reverse', 'gpt-image-2.6-flare', 'clean']])
  })

  test('records mixed lineage when the selected model differs from an input view or inherits a mixed view', async () => {
    const { locations } = await fixture()
    await seedRegistered(locations, [{ view: 'establishing', bytes: Buffer.from('establishing'), model: 'gpt-image-2.6-flare' }])
    const reverse = ledger('reverse-mixed')
    await locationReferenceSketchCommand({ location: 'cargo-bay', view: 'reverse', imageModels: ['gpt-image-2.6-sunburst'] }, reverse.dependencies)
    expect(reverse.calls.models).toEqual(['gpt-image-2.6-sunburst'])
    const side = ledger('side-from-mixed')
    await locationReferenceSketchCommand({ location: 'cargo-bay', view: 'side', imageModels: ['gpt-image-2.6-sunburst'] }, side.dependencies)
    expect(side.calls.references[0]?.slice(0, 2)).toEqual([join(locations, 'cargo-bay--reference.png'), join(locations, 'cargo-bay--reference-reverse.png')])
    const views = (await readLocationSketchManifest()).sketches[0]!.views
    expect(views.map(view => [view.view, view.model, view.lineage])).toEqual([['establishing', 'gpt-image-2.6-flare', undefined], ['reverse', 'gpt-image-2.6-sunburst', 'mixed'], ['side', 'gpt-image-2.6-sunburst', 'mixed']])
  })

  test('warns about mixed lineage from existing canonical art, persists reverse lineage, and passes the selected generation model', async () => {
    const { locations } = await fixture()
    await seedRegistered(locations, [{ view: 'establishing', bytes: Buffer.from('canonical-art'), model: 'existing-canonical-art', generationId: 'canonical' }])
    const { calls, dependencies } = ledger('reverse-generation')
    const { events } = await captureLogEvents(async () => {
      await locationReferenceSketchCommand({ location: 'cargo-bay', view: 'reverse', imageModels: ['gpt-image-2.6-flare'] }, dependencies)
    })
    expect(calls.image).toBe(1)
    expect(calls.models).toEqual(['gpt-image-2.6-flare'])
    expect(fetchSpy).toHaveBeenCalledTimes(0)
    const warnings = events.filter(event => event.message.startsWith('Lineage:'))
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.message).toBe('Lineage: establishing view for cargo-bay is existing-canonical-art; a reverse view generated from it is mixed lineage')
    expect(warnings[0]?.level).toBe('warn')
    expect(warnings[0]?.metadata).toMatchObject({ location: 'cargo-bay', view: 'reverse', lineage: 'mixed' })
    const manifest = JSON.parse(await Bun.file(getLocationSketchManifestPath()).text())
    expect(manifest.sketches[0].views.map((view: { view: string; lineage?: string; model: string }) => [view.view, view.lineage, view.model])).toEqual([['establishing', undefined, 'existing-canonical-art'], ['reverse', 'mixed', 'gpt-image-2.6-flare']])
  })

  for (const [label, bytes] of [['non-image bytes', Buffer.from('mock-image')], ['truncated PNG', png.subarray(0, 40)], ['invalid scanline filter', encodeTestPngRows([5, ...Array<number>(13).fill(0)], false)], ['PNG missing only its IEND chunk', png.subarray(0, png.length - 12)]] as const) {
    test(`rejects ${label} before publication (decoded integrity) and keeps prior bytes and metadata intact`, async () => {
      const { locations } = await fixture()
      const oldImage = Buffer.from('old-canonical')
      const seeded = await seedRegistered(locations, [{ view: 'establishing', bytes: oldImage, model: 'fixture', generationId: 'old' }])
      const { calls, dependencies } = ledger('malformed', Buffer.from(bytes))
      await expect(locationReferenceSketchCommand({ location: 'cargo-bay', revise: true, notes: 'Revise.' }, dependencies)).rejects.toThrow('could not be decoded')
      expect(calls.image).toBe(1)
      expect(Buffer.from(await Bun.file(join(locations, 'cargo-bay--reference.png')).arrayBuffer())).toEqual(oldImage)
      expect(await Bun.file(getLocationReferencePath()).text()).toBe(seeded.catalogBytes)
      expect(await Bun.file(getLocationSketchManifestPath()).text()).toBe(seeded.manifestBytes)
      const staged = join(locations, '.attempts', 'cargo-bay', 'malformed', 'establishing.png')
      expect(Buffer.from(await Bun.file(staged).arrayBuffer())).toEqual(Buffer.from(bytes))
    })
  }

  test('warns once about an existing location-plans.json, naming its path, without rejecting the run or touching the file or drawings', async () => {
    const { locations } = await fixture()
    await seedRegistered(locations, [{ view: 'establishing', bytes: Buffer.from('establishing'), model: 'fixture' }])
    const plansPath = join(locations, 'location-plans.json')
    const plansBytes = JSON.stringify({ schemaVersion: 1, plans: [{ locationKey: 'cargo-bay', reviewStatus: 'reviewed' }] })
    const drawingPath = join(locations, 'plans', 'cargo-bay--floor-plan.png')
    await Bun.write(plansPath, plansBytes)
    await Bun.write(drawingPath, png)
    const { calls, dependencies } = ledger('with-plans')
    const { events } = await captureLogEvents(async () => {
      await locationReferenceSketchCommand({ location: 'cargo-bay', view: 'reverse' }, dependencies)
      await locationReferenceSketchCommand({ location: 'cargo-bay', view: 'reverse' }, ledger('with-plans-noop').dependencies)
    })
    expect(calls.image).toBe(1)
    const warnings = events.filter(event => event.message.includes('location-plans.json'))
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.level).toBe('warn')
    expect(warnings[0]?.message).toContain('is no longer read')
    expect(warnings[0]?.message).toContain(join('input', 'locations', 'location-plans.json'))
    expect(await Bun.file(plansPath).text()).toBe(plansBytes)
    expect(Buffer.from(await Bun.file(drawingPath).arrayBuffer())).toEqual(png)
    expect((await readLocationSketchManifest()).sketches[0]!.views.map(view => view.view)).toEqual(['establishing', 'reverse'])
  })

  test('supports nested episode filenames for a catalogued establishing view', async () => {
    const { locations } = await fixture()
    await Bun.write(getLocationReferencePath(), JSON.stringify({ schemaVersion: 1, styleImage: 'input/characters/style-guide.webp', locations: [{ key: 'cargo-bay', name: 'Cargo Bay', referenceDirectory: 'single-episode', referenceFilename: '02-cargo-bay--reference.png', specification: 'Fixed door.', sourceScripts: [] }] }))
    const { calls, dependencies } = ledger('nested')
    await locationReferenceSketchCommand({ location: 'cargo-bay' }, dependencies)
    expect(calls.image).toBe(1)
    expect(calls.aggregate).toBe(0)
    expect(Buffer.from(await Bun.file(join(locations, 'single-episode', '02-cargo-bay--reference.png')).arrayBuffer())).toEqual(png)
  })

  test('rejects a view before generation when its canonical references exceed the model limit', async () => {
    const { locations } = await fixture()
    await seedRegistered(locations, [{ view: 'establishing', bytes: Buffer.from('establishing'), model: 'fixture' }])
    const { calls, dependencies } = ledger('limit')
    // No active image model accepts a single reference, so the registry lookup is narrowed for this guard.
    const capabilities = spyOn(imageReferenceCapabilities, 'getImageReferenceCapabilities').mockReturnValue({ supported: true, maxInputs: 1 })
    try {
      await expect(locationReferenceSketchCommand({ location: 'cargo-bay', view: 'reverse', imageModels: ['grok-imagine-image-2.0'] }, dependencies)).rejects.toThrow('requires 2 reference images, but grok-imagine-image-2.0 supports 1')
    } finally { capabilities.mockRestore() }
    expect(calls.image).toBe(0)
  })

  test('rejects more than one image provider before any dispatch', async () => {
    await fixture()
    const { calls, dependencies } = ledger('two-models')
    await expect(locationReferenceSketchCommand({ location: 'cargo-bay', imageModels: ['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst'] }, dependencies)).rejects.toThrow('exactly one --provider')
    expect(calls.image).toBe(0)
    expect(calls.aggregate).toBe(0)
  })

  test('rejects schema-version-1 sheet registrations', async () => {
    const { locations } = await fixture()
    await Bun.write(join(locations, 'legacy--reference-sheet.png'), styleBytes)
    await Bun.write(getLocationSketchManifestPath(), JSON.stringify({ schemaVersion: 1, sketches: [{ locationKey: 'cargo-bay', generationId: 'legacy', specificationSha256: sha256Bytes(SPECIFICATION), sheet: 'legacy--reference-sheet.png', sheetSha256: sha256Bytes(styleBytes), model: 'fixture', createdAt: '2026-01-01T00:00:00.000Z' }] }))
    await expect(readLocationSketchManifest()).rejects.toThrow(/Invalid location sketch manifest/)
  })

  test('rolls back the targeted view and manifests when atomic promotion fails, preserving the staged view', async () => {
    const { locations } = await fixture()
    const oldImage = Buffer.from('old-canonical')
    const seeded = await seedRegistered(locations, [{ view: 'establishing', bytes: oldImage, model: 'fixture', generationId: 'old' }])
    const { calls, dependencies } = ledger('rollback')
    dependencies.promoteImage = async () => { throw new Error('simulated promotion failure') }
    await expect(locationReferenceSketchCommand({ location: 'cargo-bay', revise: true, notes: 'Revise.' }, dependencies)).rejects.toThrow('prior registration was restored')
    expect(calls.image).toBe(1)
    expect(Buffer.from(await Bun.file(join(locations, 'cargo-bay--reference.png')).arrayBuffer())).toEqual(oldImage)
    expect(await Bun.file(getLocationReferencePath()).text()).toBe(seeded.catalogBytes)
    expect(await Bun.file(getLocationSketchManifestPath()).text()).toBe(seeded.manifestBytes)
    expect(Buffer.from(await Bun.file(join(locations, '.attempts', 'cargo-bay', 'rollback', 'establishing.png')).arrayBuffer())).toEqual(png)
  })

  test('restores exact image, catalog, and manifest bytes after every promotion transaction boundary fault', async () => {
    for (const faultBoundary of LOCATION_PROMOTION_TRANSACTION_BOUNDARIES) {
      const { locations } = await fixture()
      const canonical = join(locations, 'cargo-bay--reference.png')
      const attemptsRoot = join(locations, '.attempts', 'cargo-bay', `fault-${faultBoundary}`)
      const stagedImagePath = join(attemptsRoot, 'establishing.png')
      const oldImage = Buffer.from(`old-canonical-${faultBoundary}`)
      const catalog = { schemaVersion: 1 as const, styleImage: 'input/characters/style-guide.webp', locations: [{ key: 'cargo-bay', name: 'Cargo Bay', specification: SPECIFICATION, sourceScripts: [] }] }
      const manifest = { schemaVersion: 2 as const, sketches: [{ locationKey: 'cargo-bay', specificationSha256: sha256Bytes(SPECIFICATION), views: [{ view: 'establishing' as const, generationId: 'old', image: 'cargo-bay--reference.png', imageSha256: sha256Bytes(oldImage), model: 'fixture', createdAt: '2026-01-01T00:00:00.000Z' }] }] }
      const catalogBytes = `${JSON.stringify(catalog)}\n`
      const manifestBytes = `${JSON.stringify(manifest)}\n`
      await mkdir(attemptsRoot, { recursive: true })
      await Bun.write(canonical, oldImage)
      await Bun.write(stagedImagePath, png)
      await Bun.write(getLocationReferencePath(), catalogBytes)
      await Bun.write(getLocationSketchManifestPath(), manifestBytes)

      await expect(promoteLocationRegistrationTransaction({
        key: 'cargo-bay',
        view: 'establishing',
        model: 'fixture',
        entry: catalog.locations[0]!,
        catalog,
        manifest,
        prior: manifest.sketches[0]!,
        priorTarget: manifest.sketches[0]!.views[0]!,
        generationId: `fault-${faultBoundary}`,
        attemptsRoot,
        stagedImagePath,
        lineage: 'clean',
        injectFault: boundary => {
          if (boundary === faultBoundary) throw new Error(`fault:${faultBoundary}`)
        },
      })).rejects.toThrow('prior registration was restored')

      expect(Buffer.from(await Bun.file(canonical).arrayBuffer())).toEqual(oldImage)
      expect(await Bun.file(getLocationReferencePath()).text()).toBe(catalogBytes)
      expect(await Bun.file(getLocationSketchManifestPath()).text()).toBe(manifestBytes)
      expect(Buffer.from(await Bun.file(stagedImagePath).arrayBuffer())).toEqual(png)
      expect((await Array.fromAsync(new Bun.Glob('**/*.{backup,tmp}-*').scan({ cwd: locations, onlyFiles: true }))).sort()).toEqual([])
    }
  })

  test('revises a canonical view when the configured characters root is relative to the working directory', async () => {
    const { locations } = await fixture()
    configureCharactersRoot(relative(process.cwd(), dirname(locations) + '/characters'))
    const oldImage = Buffer.from('old-canonical')
    await seedRegistered(locations, [{ view: 'establishing', bytes: oldImage, model: 'fixture', generationId: 'old' }])
    const { dependencies } = ledger('relative-root')
    await expect(locationReferenceSketchCommand({ location: 'cargo-bay', revise: true, notes: 'Revise.' }, dependencies)).resolves.toBeUndefined()
    expect(Buffer.from(await Bun.file(join(locations, 'cargo-bay--reference.png')).arrayBuffer())).toEqual(png)
    expect((await readLocationSketchManifest()).sketches[0]?.views[0]?.priorGenerationId).toBe('old')
  })

  test('rejects location asset directories that escape the locations root', async () => {
    await fixture()
    await Bun.write(getLocationReferencePath(), JSON.stringify({ schemaVersion: 1, styleImage: 'input/characters/style-guide.webp', locations: [{ key: 'cargo-bay', name: 'Cargo Bay', referenceDirectory: '../outside', specification: SPECIFICATION, sourceScripts: [] }] }))
    await expect(readLocationReferenceCatalog()).rejects.toThrow('escapes the locations root')
  })
})
