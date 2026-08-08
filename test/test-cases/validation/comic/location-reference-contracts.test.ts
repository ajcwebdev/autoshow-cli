import { afterEach, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { locationReferenceSketchCommand, type LocationViewQaResult } from '~/cli/commands/process-steps/step-8-comic/comic-commands/reference-sketch/location-reference-command'
import { getLocationReferencePath, getLocationSketchManifestPath, readLocationReferenceCatalog, readLocationSketchManifest } from '~/cli/commands/process-steps/step-8-comic/comic-utils/location-reference'
import { estimateLocationReferencePrice } from '~/cli/commands/process-steps/step-8-comic/comic-utils/price-estimate'
import { l } from '~/utils/app-logger/app-logger'

const roots: string[] = []
const image = Buffer.from('mock-image')
const sha = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex')

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-location-reference-'))
  roots.push(root)
  const characters = join(root, 'input', 'characters')
  const locations = join(root, 'input', 'locations')
  await mkdir(characters, { recursive: true })
  await mkdir(locations, { recursive: true })
  await Bun.write(join(characters, 'style-guide.webp'), image)
  await Bun.write(join(locations, 'locations-reference.json'), JSON.stringify({ schemaVersion: 1, styleImage: 'input/characters/style-guide.webp', locations: [] }))
  await Bun.write(join(locations, 'location-sketches.json'), JSON.stringify({ schemaVersion: 2, sketches: [] }))
  const scripts = join(root, 'input', 'scripts', '02-script')
  await mkdir(scripts, { recursive: true })
  await Bun.write(join(scripts, '01-cargo.md'), '# Episode\n\n**INT. CARGO BAY – MORNING**\n\nCrates line fixed wall rails. A mechanic drops a temporary wrench.')
  await Bun.write(join(scripts, '02-cargo.md'), '# Episode\n\n**INT. CARGO BAY – NIGHT**\n\nThe fixed loading door faces the wall rails. Damage smolders beside the captain.')
  configureCharactersRoot(characters)
  return { root, locations }
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

describe('canonical location reference registration', () => {
  test('derives a missing location catalog style reference from the configured character catalog', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-location-default-style-'))
    roots.push(root)
    const characters = join(root, 'input', 'characters')
    await mkdir(characters, { recursive: true })
    await Bun.write(join(characters, 'artist.webp'), image)
    await Bun.write(join(characters, 'characters-reference.json'), JSON.stringify({ schemaVersion: 3, characters: [{ key: 'artist', name: 'Artist', aliases: [], image: 'artist.webp', outlineSheet: 'artist.webp', description: 'Style.' }], groupAliases: [] }))
    configureCharactersRoot(characters)
    expect(await readLocationReferenceCatalog()).toEqual({ schemaVersion: 1, styleImage: '../characters/artist.webp', locations: [] })
  })

  test('generates, QA-checks, registers, and cleans up exactly one establishing view', async () => {
    const { locations } = await fixture()
    let aggregateCalls = 0
    let imageCalls = 0
    await locationReferenceSketchCommand({ location: 'cargo-bay', qa: true, maxRepairs: 1 }, {
      aggregateSpecification: async ({ scripts }) => { aggregateCalls++; expect(scripts).toHaveLength(2); return { name: 'Cargo Bay', specification: 'Fixed wall rails opposite a loading door.' } },
      requestImage: async () => { imageCalls++; return { mode: 'generate', result: { imageBase64: image.toString('base64') } } },
      writeImage: async path => { await mkdir(dirname(path), { recursive: true }); await Bun.write(path, image) },
      judgeView: async input => { expect(input.view).toBe('establishing'); expect(input.existingViewPaths).toEqual([]); return qa() },
      generationId: () => 'establishing-generation',
    })
    expect(aggregateCalls).toBe(1)
    expect(imageCalls).toBe(1)
    const manifest = JSON.parse(await Bun.file(getLocationSketchManifestPath()).text())
    expect(manifest.schemaVersion).toBe(2)
    expect(manifest.sketches[0].views.map((view: { view: string }) => view.view)).toEqual(['establishing'])
    expect(manifest.sketches[0].views[0].image).toBe('cargo-bay--reference.png')
    expect(await Bun.file(join(locations, 'cargo-bay--reference.png')).exists()).toBe(true)
    expect(await Bun.file(join(locations, '.attempts', 'cargo-bay', 'establishing-generation')).exists()).toBe(false)
  })

  test('price preflight estimates one initial image and one permitted repair for one view', async () => {
    await fixture()
    const originalSinks = [...l.config.sinks]
    const messages: string[] = []
    l.config.sinks.length = 0
    l.config.sinks.push(event => messages.push(event.message))
    try { await estimateLocationReferencePrice({ location: 'cargo-bay', view: 'establishing', maxRepairs: 1 }) }
    finally { l.config.sinks.length = 0; l.config.sinks.push(...originalSinks) }
    const output = messages.join('\n')
    expect(output).toContain('Initial location-reference image calls: 1')
    expect(output).toContain('Initial judge calls (gpt-5.6-sol): 1')
    expect(output).toContain('Maximum additional image repairs or fresh camera retries: 1')
    expect(output).not.toContain('image calls: 3')
  })

  test('restarts camera failures fresh but edits ordinary repairable failures', async () => {
    await fixture()
    const references: string[][] = []
    const prompts: string[] = []
    let judgment = 0
    await locationReferenceSketchCommand({ location: 'cargo-bay', qa: true, maxRepairs: 2 }, {
      aggregateSpecification: async () => ({ name: 'Cargo Bay', specification: 'Fixed loading door.' }),
      requestImage: async (prompt, refs) => { prompts.push(prompt); references.push(refs); return { mode: 'generate', result: { imageBase64: image.toString('base64') } } },
      writeImage: async path => { await Bun.write(path, image) },
      judgeView: async () => {
        judgment++
        if (judgment === 1) return qa({ pass: false, requestedAngleMatch: false, failedChecks: ['requestedAngleMatch'], editInstructions: 'Use the requested three-quarter camera.', summary: 'Wrong angle.' })
        if (judgment === 2) return qa({ pass: false, houseStyleMatch: false, failedChecks: ['houseStyleMatch'], editInstructions: 'Restore the inked style.', summary: 'Wrong style.' })
        return qa()
      },
      generationId: () => 'retry-generation',
    })
    expect(references).toHaveLength(3)
    expect(references[1]).toEqual(references[0])
    expect(references[2]?.[0]).toContain('establishing-attempt-1.png')
    expect(prompts[1]).toContain('fresh composition')
    expect(prompts[2]).toContain('Edit the first image only')
  })

  test('preserves failed attempts and the prior registration when QA is exhausted', async () => {
    const { locations } = await fixture()
    await expect(locationReferenceSketchCommand({ location: 'cargo-bay', qa: true, maxRepairs: 1 }, {
      aggregateSpecification: async () => ({ name: 'Cargo Bay', specification: 'Fixed loading door.' }),
      requestImage: async () => ({ mode: 'generate', result: { imageBase64: image.toString('base64') } }),
      writeImage: async path => { await Bun.write(path, image) },
      judgeView: async () => qa({ pass: false, crossViewGeometryMatch: false, failedChecks: ['crossViewGeometryMatch'], editInstructions: 'Fix geometry.', summary: 'Fail.' }),
      generationId: () => 'failed-generation',
    })).rejects.toThrow('failed QA')
    expect(JSON.parse(await Bun.file(getLocationReferencePath()).text()).locations).toEqual([])
    expect(JSON.parse(await Bun.file(getLocationSketchManifestPath()).text()).sketches).toEqual([])
    expect(await Bun.file(join(locations, '.attempts', 'cargo-bay', 'failed-generation', 'establishing-attempt-1.png')).exists()).toBe(true)
    expect(await Bun.file(join(locations, '.attempts', 'cargo-bay', 'failed-generation', 'establishing-attempt-1-qa.json')).exists()).toBe(true)
  })

  test('requires establishing, adds reverse, treats it as a no-op, then revises only reverse', async () => {
    const { locations } = await fixture()
    const specification = 'Fixed loading door.'
    const establishing = join(locations, 'cargo-bay--reference.png')
    await Bun.write(establishing, image)
    await Bun.write(getLocationReferencePath(), JSON.stringify({ schemaVersion: 1, styleImage: 'input/characters/style-guide.webp', locations: [{ key: 'cargo-bay', name: 'Cargo Bay', specification, sourceScripts: [] }] }))
    await Bun.write(getLocationSketchManifestPath(), JSON.stringify({ schemaVersion: 2, sketches: [{ locationKey: 'cargo-bay', specificationSha256: sha(specification), views: [{ view: 'establishing', generationId: 'establishing-old', image: 'cargo-bay--reference.png', imageSha256: sha(image), model: 'fixture', createdAt: '2026-01-01T00:00:00.000Z' }] }] }))
    let calls = 0
    const dependencies = (generationId: string) => ({ requestImage: async () => { calls++; return { mode: 'generate' as const, result: { imageBase64: image.toString('base64') } } }, writeImage: async (path: string) => { await Bun.write(path, image) }, generationId: () => generationId })
    await expect(locationReferenceSketchCommand({ location: 'cargo-bay', view: 'side', qa: false }, dependencies('side'))).resolves.toBeUndefined()
    expect(calls).toBe(1)
    await locationReferenceSketchCommand({ location: 'cargo-bay', view: 'reverse', qa: false }, dependencies('reverse-new'))
    expect(calls).toBe(2)
    await locationReferenceSketchCommand({ location: 'cargo-bay', view: 'reverse', qa: false }, dependencies('reverse-noop'))
    expect(calls).toBe(2)
    await locationReferenceSketchCommand({ location: 'cargo-bay', view: 'reverse', revise: true, notes: 'Move farther back.', qa: false }, dependencies('reverse-revised'))
    expect(calls).toBe(3)
    const registration = (await readLocationSketchManifest()).sketches[0]!
    expect(registration.views.map(view => view.view)).toEqual(['establishing', 'reverse', 'side'])
    expect(registration.views.find(view => view.view === 'reverse')?.priorGenerationId).toBe('reverse-new')
  })

  test('rejects an alternate view before establishing and supports nested episode filenames', async () => {
    const { locations } = await fixture()
    await expect(locationReferenceSketchCommand({ location: 'cargo-bay', view: 'reverse', qa: false })).rejects.toThrow('before its establishing view')
    await Bun.write(getLocationReferencePath(), JSON.stringify({ schemaVersion: 1, styleImage: 'input/characters/style-guide.webp', locations: [{ key: 'cargo-bay', name: 'Cargo Bay', referenceDirectory: 'single-episode', referenceFilename: '02-cargo-bay--reference.png', specification: 'Fixed door.', sourceScripts: [] }] }))
    await locationReferenceSketchCommand({ location: 'cargo-bay', qa: false }, { requestImage: async () => ({ mode: 'generate', result: { imageBase64: image.toString('base64') } }), writeImage: async path => { await mkdir(dirname(path), { recursive: true }); await Bun.write(path, image) }, generationId: () => 'nested' })
    expect(await Bun.file(join(locations, 'single-episode', '02-cargo-bay--reference.png')).exists()).toBe(true)
  })

  test('rejects schema-version-1 sheet registrations', async () => {
    const { locations } = await fixture()
    const specification = 'Fixed loading door.'
    await Bun.write(join(locations, 'legacy--reference-sheet.png'), image)
    await Bun.write(getLocationSketchManifestPath(), JSON.stringify({ schemaVersion: 1, sketches: [{ locationKey: 'cargo-bay', generationId: 'legacy', specificationSha256: sha(specification), sheet: 'legacy--reference-sheet.png', sheetSha256: sha(image), model: 'fixture', createdAt: '2026-01-01T00:00:00.000Z' }] }))
    await expect(readLocationSketchManifest()).rejects.toThrow(/Invalid location sketch manifest/)
  })

  test('rolls back the targeted view and manifests when atomic promotion fails', async () => {
    const { locations } = await fixture()
    const specification = 'Fixed loading door.'
    const canonical = join(locations, 'cargo-bay--reference.png')
    const oldImage = Buffer.from('old-canonical')
    await Bun.write(canonical, oldImage)
    const catalog = { schemaVersion: 1, styleImage: 'input/characters/style-guide.webp', locations: [{ key: 'cargo-bay', name: 'Cargo Bay', specification, sourceScripts: [] }] }
    const manifest = { schemaVersion: 2, sketches: [{ locationKey: 'cargo-bay', specificationSha256: sha(specification), views: [{ view: 'establishing', generationId: 'old', image: 'cargo-bay--reference.png', imageSha256: sha(oldImage), model: 'fixture', createdAt: '2026-01-01T00:00:00.000Z' }] }] }
    await Bun.write(getLocationReferencePath(), JSON.stringify(catalog))
    await Bun.write(getLocationSketchManifestPath(), JSON.stringify(manifest))
    await expect(locationReferenceSketchCommand({ location: 'cargo-bay', revise: true, notes: 'Revise.', qa: false }, {
      requestImage: async () => ({ mode: 'generate', result: { imageBase64: image.toString('base64') } }),
      writeImage: async path => { await Bun.write(path, image) },
      promoteImage: async () => { throw new Error('simulated promotion failure') },
      generationId: () => 'rollback',
    })).rejects.toThrow('prior registration was restored')
    expect(Buffer.from(await Bun.file(canonical).arrayBuffer())).toEqual(oldImage)
    expect(JSON.parse(await Bun.file(getLocationSketchManifestPath()).text())).toEqual(manifest)
    expect(await Bun.file(join(locations, '.attempts', 'cargo-bay', 'rollback', 'establishing-attempt-0.png')).exists()).toBe(true)
  })

  test('revises a canonical view when the configured characters root is relative to the working directory', async () => {
    const { locations } = await fixture()
    configureCharactersRoot(relative(process.cwd(), dirname(locations) + '/characters'))
    const specification = 'Fixed loading door.'
    const canonical = join(locations, 'cargo-bay--reference.png')
    const oldImage = Buffer.from('old-canonical')
    await Bun.write(canonical, oldImage)
    await Bun.write(getLocationReferencePath(), JSON.stringify({ schemaVersion: 1, styleImage: 'input/characters/style-guide.webp', locations: [{ key: 'cargo-bay', name: 'Cargo Bay', specification, sourceScripts: [] }] }))
    await Bun.write(getLocationSketchManifestPath(), JSON.stringify({ schemaVersion: 2, sketches: [{ locationKey: 'cargo-bay', specificationSha256: sha(specification), views: [{ view: 'establishing', generationId: 'old', image: 'cargo-bay--reference.png', imageSha256: sha(oldImage), model: 'fixture', createdAt: '2026-01-01T00:00:00.000Z' }] }] }))
    await expect(locationReferenceSketchCommand({ location: 'cargo-bay', revise: true, notes: 'Revise.', qa: false }, {
      requestImage: async () => ({ mode: 'generate', result: { imageBase64: image.toString('base64') } }),
      writeImage: async path => { await Bun.write(path, image) },
      generationId: () => 'relative-root',
    })).resolves.toBeUndefined()
    expect(Buffer.from(await Bun.file(canonical).arrayBuffer())).toEqual(image)
    expect((await readLocationSketchManifest()).sketches[0]?.views[0]?.priorGenerationId).toBe('old')
  })

  test('rejects location asset directories that escape the locations root', async () => {
    await fixture()
    await Bun.write(getLocationReferencePath(), JSON.stringify({ schemaVersion: 1, styleImage: 'input/characters/style-guide.webp', locations: [{ key: 'cargo-bay', name: 'Cargo Bay', referenceDirectory: '../outside', specification: 'Fixed loading door.', sourceScripts: [] }] }))
    await expect(readLocationReferenceCatalog()).rejects.toThrow('escapes the locations root')
  })
})
