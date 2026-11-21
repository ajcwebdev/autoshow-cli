import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import { generateComicPages } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-comic-pages'
import { generatePanelImages } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-panel-images'
import { locationReferenceSketchCommand } from '~/cli/commands/visuals/comic/comic-commands/reference-sketch/location-reference-command'
import { buildFinalPanelImageEstimate } from '~/cli/commands/visuals/comic/comic-utils/comic-price-final-image-estimates'
import { getLocationReferencePath, getLocationSketchManifestPath } from '~/cli/commands/visuals/comic/comic-utils/location-reference'
import { estimateCharacterSketchPrice, estimateLocationReferencePrice } from '~/cli/commands/visuals/comic/comic-utils/price-estimate'
import type { LogSinkEvent } from '~/types'
import { sha256Bytes } from '~/utils/value-helpers'
import { captureLogEvents } from '../../../../test-utils/console-capture'
import { makeCatalog, tinyPngFixture } from '../../../../test-utils/character-catalog-fixture'
import { makeTempDir } from '../../../../test-utils/temp-dirs'
import { setupPageContractFixtures } from './comic-page-contract-fixtures'

const roots: string[] = []
const png = tinyPngFixture()
const SPECIFICATION = 'Fixed loading door.'
const RETIRED_PRICE_FIELDS = /judge|repair|qa|comparison|passes/i
const { tinyPng, createSceneFixture } = setupPageContractFixtures()

const locationFixture = async (options: { catalogued: boolean; views?: Array<'establishing' | 'reverse'> }) => {
  const root = await makeTempDir('autoshow-reference-pricing-')
  roots.push(root)
  const characters = join(root, 'input', 'characters')
  const locations = join(root, 'input', 'locations')
  await mkdir(characters, { recursive: true })
  await mkdir(locations, { recursive: true })
  await Bun.write(join(characters, 'style-guide.webp'), png)
  const scripts = join(root, 'input', 'scripts', '02-script')
  await mkdir(scripts, { recursive: true })
  await Bun.write(join(scripts, '01-cargo.md'), '# Episode\n\n**INT. CARGO BAY – MORNING**\n\nCrates line fixed wall rails.')
  configureCharactersRoot(characters)
  const views = options.views ?? []
  for (const view of views) await Bun.write(join(locations, view === 'establishing' ? 'cargo-bay--reference.png' : `cargo-bay--reference-${view}.png`), Buffer.from(`${view}-bytes`))
  await Bun.write(getLocationReferencePath(), JSON.stringify({ schemaVersion: 1, styleImage: 'input/characters/style-guide.webp', locations: options.catalogued ? [{ key: 'cargo-bay', name: 'Cargo Bay', specification: SPECIFICATION, sourceScripts: [] }] : [] }))
  await Bun.write(getLocationSketchManifestPath(), JSON.stringify({ schemaVersion: 2, sketches: views.length === 0 ? [] : [{ locationKey: 'cargo-bay', specificationSha256: sha256Bytes(SPECIFICATION), views: views.map(view => ({ view, generationId: `${view}-old`, image: view === 'establishing' ? 'cargo-bay--reference.png' : `cargo-bay--reference-${view}.png`, imageSha256: sha256Bytes(Buffer.from(`${view}-bytes`)), model: 'gpt-image-2.6-flare', createdAt: '2026-01-01T00:00:00.000Z' })) }] }))
  return { root, locations }
}

const locationPreflight = (events: LogSinkEvent[]) => events.find(event => event.message === 'Comic - Price Estimate: reference-sketch --location')
const imageTables = (events: LogSinkEvent[]) => events.filter(event => event.message.startsWith('Comic Image Price Estimate:'))
const retiredKeys = (events: LogSinkEvent[]): string[] => events.flatMap(event => Object.keys(event.metadata ?? {})).filter(key => RETIRED_PRICE_FIELDS.test(key))

const hashTree = async (root: string): Promise<Record<string, string>> => {
  const rows: Record<string, string> = {}
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue
    const path = join(root, entry.name)
    if (entry.isDirectory()) for (const [child, hash] of Object.entries(await hashTree(path))) rows[`${entry.name}/${child}`] = hash
    else rows[entry.name] = new Bun.CryptoHasher('sha256').update(await Bun.file(path).arrayBuffer()).digest('hex')
  }
  return rows
}

afterEach(async () => {
  configureCharactersRoot('input/characters')
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('location reference price preflight', () => {
  test('a registered view is reused at zero image calls and $0 without writing files', async () => {
    const { locations } = await locationFixture({ catalogued: true, views: ['establishing', 'reverse'] })
    const before = await hashTree(locations)
    for (const view of ['establishing', 'reverse'] as const) {
      const { events } = await captureLogEvents(async () => { await estimateLocationReferencePrice({ location: 'cargo-bay', view }) })
      const reused = events.find(event => event.message.includes('existing validated view, no provider calls'))
      expect(reused?.metadata).toMatchObject({ location: 'cargo-bay', view, imageCalls: 0, aggregationCalls: 0, totalCost: 0 })
      expect(imageTables(events)).toEqual([])
      expect(retiredKeys(events)).toEqual([])
    }
    expect(await hashTree(locations)).toEqual(before)
  })

  test('a fresh view for a catalogued location prices exactly one image call and no drafting', async () => {
    await locationFixture({ catalogued: true, views: ['establishing'] })
    const { events } = await captureLogEvents(async () => { await estimateLocationReferencePrice({ location: 'cargo-bay', view: 'reverse', imageModels: ['gpt-image-2.6-flare'] }) })
    expect(events.every(event => event.category === 'pricing')).toBe(true)
    expect(locationPreflight(events)?.metadata).toMatchObject({ location: 'cargo-bay', view: 'reverse', revise: false, model: 'gpt-image-2.6-flare', imageCalls: 1, aggregationCalls: 0, aggregationCost: 0 })
    expect(imageTables(events).map(event => event.metadata?.['totalOutputs'])).toEqual([1])
    expect(retiredKeys(events)).toEqual([])
  })

  test('an explicit revision prices exactly one image call', async () => {
    await locationFixture({ catalogued: true, views: ['establishing'] })
    const { events } = await captureLogEvents(async () => { await estimateLocationReferencePrice({ location: 'cargo-bay', revise: true, notes: 'Move back.' }) })
    expect(locationPreflight(events)?.metadata).toMatchObject({ view: 'establishing', revise: true, imageCalls: 1, aggregationCalls: 0 })
    expect(imageTables(events).map(event => event.metadata?.['totalOutputs'])).toEqual([1])
    expect(retiredKeys(events)).toEqual([])
  })

  test('an uncatalogued location adds one specification drafting call, matching the mocked dispatch ledger', async () => {
    const { locations } = await locationFixture({ catalogued: false })
    const before = await hashTree(locations)
    const { events } = await captureLogEvents(async () => { await estimateLocationReferencePrice({ location: 'cargo-bay' }) })
    const metadata = locationPreflight(events)?.metadata
    expect(metadata).toMatchObject({ view: 'establishing', imageCalls: 1, aggregationCalls: 1 })
    expect(metadata?.['aggregationInputUnits']).toBeGreaterThan(0)
    expect(imageTables(events).map(event => event.metadata?.['totalOutputs'])).toEqual([1])
    expect(retiredKeys(events)).toEqual([])
    expect(await hashTree(locations)).toEqual(before)

    const dispatched = { image: 0, aggregate: 0 }
    await locationReferenceSketchCommand({ location: 'cargo-bay' }, {
      aggregateSpecification: async () => { dispatched.aggregate++; return { name: 'Cargo Bay', specification: SPECIFICATION } },
      requestImage: async () => { dispatched.image++; return { mode: 'generate', result: { imageBase64: png.toString('base64') } } },
      writeImage: async (path, base64) => { await Bun.write(path, Buffer.from(base64, 'base64')) },
      generationId: () => 'ledger',
    })
    expect(dispatched).toEqual({ image: metadata?.['imageCalls'] as number, aggregate: metadata?.['aggregationCalls'] as number })
  })

  test('rejects more than one --provider and an alternate view before establishing, before any pricing output', async () => {
    await locationFixture({ catalogued: true })
    const { events } = await captureLogEvents(async () => {
      await expect(estimateLocationReferencePrice({ location: 'cargo-bay', imageModels: ['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst'] })).rejects.toThrow('exactly one --provider')
      await expect(estimateLocationReferencePrice({ location: 'cargo-bay', view: 'side' })).rejects.toThrow('before the establishing view')
      await expect(estimateLocationReferencePrice({ location: 'cargo-bay', revise: true })).rejects.toThrow('Cannot revise unregistered')
    })
    expect(locationPreflight(events)).toBeUndefined()
    expect(imageTables(events)).toEqual([])
  })
})

describe('character turnaround price preflight', () => {
  test('prices one call per turnaround view plus local sheet composition', async () => {
    const charactersRoot = await makeCatalog({}, { registerRoot: root => { roots.push(root) } })
    configureCharactersRoot(charactersRoot)
    const { events } = await captureLogEvents(async () => { await estimateCharacterSketchPrice({ character: 'hero', imageModels: ['gpt-image-2.6-flare'] }) })
    expect(events.find(event => event.message === 'Comic - Price Estimate: reference-sketch --character')?.metadata).toMatchObject({ character: 'hero', model: 'gpt-image-2.6-flare', referencesPerView: 1, views: ['front', 'three-quarter', 'profile'] })
    expect(events.some(event => event.metadata?.['localComposition'] === true)).toBe(true)
    expect(imageTables(events).map(event => event.metadata?.['totalOutputs'])).toEqual([3])
    expect(retiredKeys(events)).toEqual([])
    await expect(estimateCharacterSketchPrice({ character: 'hero', imageModels: ['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst'] })).rejects.toThrow('exactly one --provider')
  })
})

describe('final image price preflight for existing outputs', () => {
  for (const grouped of [true, false]) test(`${grouped ? 'page' : 'panel'} pricing reuses an existing image at zero outputs after canon changes, without writes`, async () => {
    const sceneSlug = `reference-price-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const options = { model: 'gpt-image-2.6-flare', size: '1536x1024' as const, quality: 'high' as const, force: false, runId: 'pricing-proof', concurrency: 1, panels: grouped ? [1, 2] : [1], panelsPerImage: grouped ? 2 : 1 }
    let imageCalls = 0
    const dependencies = {
      requestImage: async () => { imageCalls++; return { mode: 'generate' as const, result: { imageBase64: tinyPng.toString('base64') } } },
      writeImage: async (path: string) => { await mkdir(dirname(path), { recursive: true }); await Bun.write(path, tinyPng) },
    }
    if (grouped) await generateComicPages(sceneSlug, options, dependencies)
    else await generatePanelImages(sceneSlug, options, dependencies)
    expect(imageCalls).toBe(1)
    const priceOptions = { sceneSlug, scriptPath: 'script.md', imageModel: options.model, panels: options.panels, panelsPerImage: options.panelsPerImage, recoveryRunId: options.runId }
    const before = await hashTree(runDirectory)
    const current = await buildFinalPanelImageEstimate(priceOptions)
    if (current.status !== 'ready') throw new Error('Expected current price inventory')
    expect(current.modeEstimate.totalOutputs).toBe(0)
    expect(current.pricing.primary.outputs).toBe(0)
    expect(Object.keys(current.pricing).filter(key => RETIRED_PRICE_FIELDS.test(key))).toEqual([])
    expect(await hashTree(runDirectory)).toEqual(before)

    const catalogPath = join(runDirectory, 'input', 'characters', 'characters-reference.json')
    const catalog = JSON.parse(await Bun.file(catalogPath).text())
    catalog.characters[0].description = 'Latest canonical orange uniform.'
    await Bun.write(catalogPath, JSON.stringify(catalog))
    const changedBefore = await hashTree(runDirectory)
    const changed = await buildFinalPanelImageEstimate(priceOptions)
    if (changed.status !== 'ready') throw new Error('Expected changed-reference price inventory')
    expect(changed.modeEstimate.totalOutputs).toBe(0)
    expect(changed.pricing.primary.outputs).toBe(0)
    expect(await hashTree(runDirectory)).toEqual(changedBefore)
  })
})
