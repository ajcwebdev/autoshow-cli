import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as v from 'valibot'
import { configureOutputRoot } from '~/cli/commands/process-steps/output-root'
import { configureCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { loadCharacterCatalog } from '~/cli/commands/process-steps/step-8-comic/comic-utils/character-reference-config'
import { createCharacterReferenceSnapshot, loadAndVerifyCharacterReferenceSnapshot, compileCharacterReferences } from '~/cli/commands/process-steps/step-8-comic/comic-utils/character-reference-snapshot'
import { checksumFile, getCharacterSketchManifestPath, requireCurrentCharacterSketch } from '~/cli/commands/process-steps/step-8-comic/comic-commands/process-scenes/character-utils'
import { buildSceneJsonSchema, buildStructuredScriptJsonSchema, PanelBundleDataSchema, ScenePromptDataSchema, StructuredScriptDataSchema, validateSceneCharacters } from '~/cli/commands/process-steps/step-8-comic/schemas/schemas'
import { parseCharacterSketchArgs } from '~/cli/commands/process-steps/step-8-comic/comic-utils/cli-args'
import { getReferenceImageCapabilities, trimOptionalContinuityReferences } from '~/cli/commands/process-steps/step-8-comic/comic-utils/reference-capabilities'
import { characterSketchCommand } from '~/cli/commands/process-steps/step-8-comic/comic-commands/character-sketch/character-sketch-command'

const temporaryRoots: string[] = []
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
afterEach(async () => {
  configureOutputRoot('./output')
  configureCharactersRoot('input/characters')
  await Promise.all(temporaryRoots.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

const makeCatalog = async (overrides: Record<string, unknown> = {}) => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-character-catalog-'))
  temporaryRoots.push(root)
  await writeFile(join(root, 'hero.webp'), tinyPng)
  await writeFile(join(root, 'sidekick.png'), tinyPng)
  const catalog = {
    schemaVersion: 3,
    characters: [
      { key: 'hero', name: 'Captain Hero', aliases: ['HERO', 'CAPT. HERO'], image: 'hero.webp', outlineSheet: 'hero--outline-sheet.png', description: 'Hero reference.' },
      { key: 'sidekick', name: 'Side Kick', aliases: ['SIDEKICK'], image: 'sidekick.png', outlineSheet: 'sidekick--outline-sheet.png', description: 'Sidekick reference.' },
    ],
    groupAliases: [{ alias: 'TEAM', characterKeys: ['hero', 'sidekick'] }],
    ...overrides,
  }
  await writeFile(join(root, 'characters-reference.json'), JSON.stringify(catalog))
  return root
}

describe('comic character handling flat-reference contracts', () => {
  test('catalog keys, aliases, possessives, V.O. suffixes, groups, and source paths are data-driven', async () => {
    const catalog = loadCharacterCatalog(await makeCatalog())
    expect(catalog.characterKeys).toEqual(['hero', 'sidekick'])
    expect(catalog.requireKey('hero')).toBe('hero')
    expect(catalog.resolve(" captain   hero's (V.O.) ")).toEqual(['hero'])
    expect(catalog.resolve('TEAM')).toEqual(['hero', 'sidekick'])
    expect(catalog.detect('TEAM enters; CAPT. HERO speaks.')).toEqual(['hero', 'sidekick'])
    expect(catalog.get(catalog.requireKey('hero')).sourcePath).toEndWith('/hero.webp')
    expect(catalog.get(catalog.requireKey('hero')).outlineSheetPath).toEndWith('/hero--outline-sheet.png')
  })

  test('catalog rejects legacy versions, unsafe paths, duplicate keys/images, missing sources, and bad groups', async () => {
    const cases: Array<{ override: Record<string, unknown>; message: RegExp }> = [
      { override: { schemaVersion: 2 }, message: /schemaVersion 3|Invalid type/ },
      { override: { characters: [{ key: 'Bad Key', name: 'Bad', aliases: [], image: 'hero.webp', outlineSheet: 'bad.png', description: 'x' }] }, message: /lowercase kebab-case/ },
      { override: { characters: [{ key: 'hero', name: 'Hero', aliases: [], image: '../hero.webp', outlineSheet: 'hero.png', description: 'x' }] }, message: /escapes the characters root/ },
      { override: { characters: [{ key: 'hero', name: 'Hero', aliases: [], image: 'hero.webp', outlineSheet: '../hero.png', description: 'x' }] }, message: /outlineSheet escapes/ },
      { override: { characters: [{ key: 'hero', name: 'One', aliases: [], image: 'hero.webp', outlineSheet: 'one.png', description: 'x' }, { key: 'hero', name: 'Two', aliases: [], image: 'sidekick.png', outlineSheet: 'two.png', description: 'x' }] }, message: /duplicate character key/ },
      { override: { characters: [{ key: 'hero', name: 'One', aliases: [], image: 'hero.webp', outlineSheet: 'one.png', description: 'x' }, { key: 'other', name: 'Two', aliases: [], image: 'hero.webp', outlineSheet: 'two.png', description: 'x' }] }, message: /duplicate source image/ },
      { override: { characters: [{ key: 'hero', name: 'One', aliases: [], image: 'hero.webp', outlineSheet: 'same.png', description: 'x' }, { key: 'other', name: 'Two', aliases: [], image: 'sidekick.png', outlineSheet: 'same.png', description: 'x' }] }, message: /duplicate outline sheet/ },
      { override: { characters: [{ key: 'hero', name: 'Hero', aliases: [], image: 'hero.webp', outlineSheet: 'hero.gif', description: 'x' }] }, message: /Expected a PNG/ },
      { override: { characters: [{ key: 'hero', name: 'Hero', aliases: [], image: 'missing.webp', outlineSheet: 'hero.png', description: 'x' }] }, message: /was not found/ },
      { override: { groupAliases: [{ alias: 'TEAM', characterKeys: ['missing'] }] }, message: /unknown key/ },
    ]
    for (const item of cases) {
      const root = await makeCatalog(item.override)
      expect(() => loadCharacterCatalog(root)).toThrow(item.message)
    }
  })

  test('catalog permits declared outline sheets that have not been generated yet', async () => {
    const catalog = loadCharacterCatalog(await makeCatalog())
    expect(catalog.characters.map(character => character.outlineSheetPath)).toHaveLength(2)
  })

  test('catalog permits one canonical image to serve as both source and outline sheet', async () => {
    const root = await makeCatalog({
      characters: [
        { key: 'hero', name: 'Captain Hero', aliases: ['HERO'], image: 'hero.webp', outlineSheet: 'hero.webp', description: 'Hero reference.' },
      ],
      groupAliases: [],
    })
    const catalog = loadCharacterCatalog(root)
    const hero = catalog.get(catalog.requireKey('hero'))
    expect(hero.sourcePath).toBe(hero.outlineSheetPath)
  })

  test('panel-prompt preflight aggregates every unregistered visible character', async () => {
    const charactersRoot = await mkdtemp(join(tmpdir(), 'autoshow-missing-character-catalog-'))
    temporaryRoots.push(charactersRoot)
    const keys = ['podcast-host', 'buoy-4-and-6', 'wilhelm-speaking-villagers', 'guards']
    for (const [index, key] of keys.entries()) await writeFile(join(charactersRoot, `${index}.webp`), key)
    await writeFile(join(charactersRoot, 'characters-reference.json'), JSON.stringify({
      schemaVersion: 3,
      characters: keys.map((key, index) => ({ key, name: key, aliases: [], image: `${index}.webp`, outlineSheet: `${index}--outline-sheet.png`, description: `${key} reference` })),
      groupAliases: [],
    }))
    configureCharactersRoot(charactersRoot)
    const catalog = loadCharacterCatalog(charactersRoot)
    const runDirectory = await mkdtemp(join(tmpdir(), 'autoshow-missing-character-run-'))
    temporaryRoots.push(runDirectory)
    await expect(createCharacterReferenceSnapshot(runDirectory, keys.map(key => catalog.requireKey(key)), catalog))
      .rejects.toThrow(/podcast-host[\s\S]*buoy-4-and-6[\s\S]*wilhelm-speaking-villagers[\s\S]*guards/)
  })

  test('strict scene schemas reject display names and enforce speaker visibility invariants', async () => {
    const catalog = loadCharacterCatalog(await makeCatalog())
    const valid = v.parse(ScenePromptDataSchema, {
      schemaVersion: 4, title: 'Test', location: 'Bridge', panels: [{
        number: 1, description: 'Hero speaks.', shotPlan: 'Medium shot; Hero stands screen left and looks right.', characterKeys: ['hero'], sourceSegmentIds: ['beat-0001'],
        locationKey: 'bridge',
        speech: [{ speaker: { kind: 'character', characterKey: 'hero', offscreen: false }, line: 'Hello.' }],
      }],
    })
    expect(() => validateSceneCharacters(valid, catalog)).not.toThrow()
    expect(() => validateSceneCharacters({ ...valid, panels: [{ ...valid.panels[0]!, characterKeys: ['Captain Hero'] }] }, catalog)).toThrow(/Use a catalog key|Unknown character key/)
    expect(() => validateSceneCharacters({ ...valid, panels: [{ ...valid.panels[0]!, characterKeys: [] }] }, catalog)).toThrow(/on-screen speaker/)
    expect(() => validateSceneCharacters({ ...valid, panels: [{ ...valid.panels[0]!, speech: [{ speaker: { kind: 'character', characterKey: 'hero', offscreen: true }, line: 'Hello.' }] }] }, catalog)).toThrow(/offscreen speaker/)
    expect(() => validateSceneCharacters({ ...valid, panels: [{ ...valid.panels[0]!, sourceSegmentIds: ['beat-0001', 'beat-0001'] }] }, catalog)).toThrow(/Duplicate source segment ID/)
  })

  test('catalog scene-text rules deterministically reject canonical character depiction conflicts', async () => {
    const root = await makeCatalog({
      characters: [{
        key: 'hero', name: 'Hologram Hero', aliases: ['HERO'], image: 'hero.webp', outlineSheet: 'hero.webp',
        description: 'A free-standing hologram above a projector base; never shown on a monitor.',
        sceneTextRules: [
          { kind: 'required', pattern: '\\bhologram\\b', description: 'Hero must be identified as a hologram.' },
          { kind: 'required', pattern: '\\bprojector(?:\\s+base)?\\b', description: 'Hero must include a projector base.' },
          { kind: 'forbidden', pattern: '\\bhero\\b.{0,80}\\bon\\b.{0,40}\\bmonitor\\b', description: 'Hero must not appear on a monitor.' },
        ],
      }],
      groupAliases: [],
    })
    const catalog = loadCharacterCatalog(root)
    const scene = (description: string, shotPlan: string) => v.parse(ScenePromptDataSchema, {
      schemaVersion: 4, title: 'Test', location: 'Bridge', panels: [{
        number: 1, description, shotPlan, characterKeys: ['hero'], speech: [], sourceSegmentIds: ['beat-0001'], locationKey: 'bridge',
      }],
    })

    expect(() => validateSceneCharacters(
      scene('Hero is a hologram.', 'The free-standing hologram shines above a small projector base.'),
      catalog,
    )).not.toThrow()
    expect(() => validateSceneCharacters(
      scene('Hero is a hologram.', 'The hologram shines above a projector base. Exclude any monitor showing Hero.'),
      catalog,
    )).not.toThrow()
    expect(() => validateSceneCharacters(
      scene('Hero appears on a monitor.', 'Medium shot of the monitor.'),
      catalog,
    )).toThrow(/must satisfy canonical rule: Hero must be identified as a hologram/)
    expect(() => validateSceneCharacters(
      scene('Hero is a hologram on a monitor.', 'The monitor sits beside a projector base.'),
      catalog,
    )).toThrow(/must not violate canonical rule: Hero must not appear on a monitor/)
  })

  test('catalog rejects invalid canonical scene-text regular expressions', async () => {
    const root = await makeCatalog({
      characters: [{
        key: 'hero', name: 'Hero', aliases: [], image: 'hero.webp', outlineSheet: 'hero.webp', description: 'Hero.',
        sceneTextRules: [{ kind: 'required', pattern: '[', description: 'Invalid regex.' }],
      }],
      groupAliases: [],
    })
    expect(() => loadCharacterCatalog(root)).toThrow(/invalid regular expression/)
  })

  test('scene validation accepts panels with more than five visible characters', async () => {
    const charactersRoot = await mkdtemp(join(tmpdir(), 'autoshow-large-cast-catalog-'))
    temporaryRoots.push(charactersRoot)
    const keys = Array.from({ length: 8 }, (_, index) => `character-${index + 1}`)
    for (const [index] of keys.entries()) await writeFile(join(charactersRoot, `${index}.png`), tinyPng)
    await writeFile(join(charactersRoot, 'characters-reference.json'), JSON.stringify({
      schemaVersion: 3,
      characters: keys.map((key, index) => ({
        key,
        name: `Character ${index + 1}`,
        aliases: [],
        image: `${index}.png`,
        outlineSheet: `${index}.png`,
        description: `${key} reference`,
      })),
      groupAliases: [],
    }))
    const catalog = loadCharacterCatalog(charactersRoot)
    const scene = v.parse(ScenePromptDataSchema, {
      schemaVersion: 4,
      title: 'Large ensemble',
      location: 'Cargo Bay',
      panels: [{
        number: 1,
        description: 'Eight crew members attend the meeting.',
        shotPlan: 'Wide ensemble shot with all eight crew members visible and individually staged.',
        characterKeys: keys,
        speech: [],
        sourceSegmentIds: ['beat-0001'],
        locationKey: 'cargo-bay',
      }],
    })
    expect(() => validateSceneCharacters(scene, catalog)).not.toThrow()
  })

  test('generated model schemas use the OpenAI Structured Outputs subset', () => {
    const schemas = [
      buildStructuredScriptJsonSchema(['hero', 'sidekick']).schema,
      buildSceneJsonSchema(['hero', 'sidekick']).schema,
    ]
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(visit)
        return
      }
      if (!value || typeof value !== 'object') return
      const record = value as Record<string, unknown>
      expect(record).not.toHaveProperty('const')
      expect(record).not.toHaveProperty('oneOf')
      expect(record).not.toHaveProperty('uniqueItems')
      Object.values(record).forEach(visit)
    }
    schemas.forEach(visit)

    expect(buildSceneJsonSchema(['hero']).schema.properties.schemaVersion).toEqual({ type: 'integer', enum: [4] })
  })

  test('unversioned structured, scene, and panel artifacts are rejected', () => {
    expect(() => v.parse(StructuredScriptDataSchema, {})).toThrow()
    expect(() => v.parse(ScenePromptDataSchema, { title: 'legacy', location: '', panels: [] })).toThrow()
    expect(() => v.parse(PanelBundleDataSchema, { title: 'legacy', location: '', panels: [] })).toThrow()
  })

  test('character-sketch parsing removes --image and enforces one model', () => {
    expect(() => parseCharacterSketchArgs(['--image', 'hero.webp'])).toThrow(/--image was removed/)
    expect(() => parseCharacterSketchArgs(['--character', 'hero', '--image-model', 'gpt-image-2,grok-imagine-image'])).toThrow(/exactly one/)
    expect(() => parseCharacterSketchArgs(['--character', 'hero', '--force'])).toThrow(/Unknown argument/)
    expect(parseCharacterSketchArgs(['--character', 'hero', '--revise', '--notes', 'Fix eyes']).character).toBe('hero')
  })

  test('snapshot copies each character once, orders sheet before source, and detects tampering', async () => {
    const charactersRoot = await makeCatalog()
    configureCharactersRoot(charactersRoot)
    const catalog = loadCharacterCatalog(charactersRoot)
    const outputRoot = await mkdtemp(join(tmpdir(), 'autoshow-character-output-'))
    temporaryRoots.push(outputRoot)
    const key = catalog.requireKey('hero')
    const sheet = catalog.get(key).outlineSheetPath
    await writeFile(sheet, tinyPng)
    await writeFile(getCharacterSketchManifestPath(charactersRoot), JSON.stringify({ schemaVersion: 1, sketches: [{
      characterKey: key, generationId: 'test-generation', origin: 'generated', sourceImage: 'hero.webp', outlineSheet: 'hero--outline-sheet.png',
      sourceSha256: await checksumFile(catalog.get(key).sourcePath), sheetSha256: await checksumFile(sheet), model: 'gpt-image-2', createdAt: new Date().toISOString(),
    }] }))
    const runDirectory = join(outputRoot, 'run')
    const manifest = await createCharacterReferenceSnapshot(runDirectory, [key, key], catalog)
    expect(manifest.characters).toHaveLength(1)
    expect(manifest.characters[0]?.assets.map(asset => asset.role)).toEqual(['sketch-sheet', 'source-image'])
    const references = compileCharacterReferences(runDirectory, manifest, [key])
    expect(references).toHaveLength(1)
    expect(references[0]).toEndWith('/identity-cards/01-hero-identity-card.png')
    const cardBytes = Buffer.from(await Bun.file(references[0]!).arrayBuffer())
    expect(cardBytes.readUInt32BE(16)).toBe(1536)
    expect(cardBytes.readUInt32BE(20)).toBe(1024)
    expect(await Bun.file(`${references[0]}.json`).exists()).toBe(true)
    expect(compileCharacterReferences(runDirectory, manifest, [key])).toEqual(references)
    await expect(loadAndVerifyCharacterReferenceSnapshot(runDirectory, manifest.snapshotId)).resolves.toBeTruthy()
    await writeFile(join(runDirectory, manifest.characters[0]!.assets[0]!.path), 'tampered')
    await expect(loadAndVerifyCharacterReferenceSnapshot(runDirectory, manifest.snapshotId)).rejects.toThrow(/modified or corrupted/)
  })

  test('single-image characters snapshot one file and use it directly without an identity-card derivative', async () => {
    const charactersRoot = await makeCatalog({
      characters: [
        { key: 'hero', name: 'Captain Hero', aliases: ['HERO'], image: 'hero.webp', outlineSheet: 'hero.webp', description: 'Hero reference.' },
      ],
      groupAliases: [],
    })
    configureCharactersRoot(charactersRoot)
    const catalog = loadCharacterCatalog(charactersRoot)
    const key = catalog.requireKey('hero')
    const sha256 = await checksumFile(catalog.get(key).sourcePath)
    await writeFile(getCharacterSketchManifestPath(charactersRoot), JSON.stringify({ schemaVersion: 1, sketches: [{
      characterKey: key, generationId: 'single-reference', origin: 'legacy-import', sourceImage: 'hero.webp', outlineSheet: 'hero.webp',
      sourceSha256: sha256, sheetSha256: sha256, model: null, createdAt: new Date().toISOString(),
    }] }))
    const runDirectory = await mkdtemp(join(tmpdir(), 'autoshow-single-character-run-'))
    temporaryRoots.push(runDirectory)
    const manifest = await createCharacterReferenceSnapshot(runDirectory, [key], catalog)
    expect(manifest.characters[0]?.assets.map(asset => asset.role)).toEqual(['sketch-sheet', 'source-image'])
    expect(new Set(manifest.characters[0]?.assets.map(asset => asset.path))).toHaveLength(1)
    const references = compileCharacterReferences(runDirectory, manifest, [key])
    expect(references).toEqual([join(runDirectory, manifest.characters[0]!.assets[0]!.path)])
    expect(references[0]).toEndWith('/hero/reference.webp')
    expect(await Bun.file(join(runDirectory, 'character-references', manifest.snapshotId, 'identity-cards', '01-hero-identity-card.png')).exists()).toBe(false)
  })

  test('registry capabilities never trim required references and trim optional continuity deterministically', () => {
    expect(getReferenceImageCapabilities('recraftv4_1')).toEqual({ supported: false, maxInputs: 0 })
    expect(() => trimOptionalContinuityReferences('gpt-image-2', Array.from({ length: 17 }, (_, index) => `required-${index}`), [])).toThrow(/requires 17/)
    const result = trimOptionalContinuityReferences('gpt-image-2', ['sheet', 'source'], Array.from({ length: 20 }, (_, index) => `continuity-${index}`))
    expect(result.references.slice(0, 2)).toEqual(['sheet', 'source'])
    expect(result.references).toHaveLength(16)
    expect(result.trimmed).toHaveLength(6)
  })

  test('mocked generation uses temporary views, replaces by default, and preserves the registered sheet on failure', async () => {
    const charactersRoot = await makeCatalog()
    configureCharactersRoot(charactersRoot)
    const requestedReferences: string[][] = []
    const writeImage = async (path: string) => { await writeFile(path, 'generated-view') }
    const composeSheet = async (selection: { outputPath: string }) => {
      await writeFile(selection.outputPath, 'composed-sheet')
      return { width: 3, height: 1 }
    }
    await characterSketchCommand({ character: 'hero', imageModels: ['gpt-image-2'], concurrency: 1 }, {
      createGenerationId: () => 'successful-generation',
      requestImage: async (_prompt, references) => { requestedReferences.push(references); return { mode: 'edit', result: { imageBase64: 'ignored' } } },
      writeImage,
      composeSheet,
    })
    const manifestPath = getCharacterSketchManifestPath(charactersRoot)
    expect(JSON.parse(await Bun.file(manifestPath).text()).sketches[0].generationId).toBe('successful-generation')
    expect(requestedReferences.every(references => references.length === 1 && references[0]?.endsWith('/hero.webp'))).toBe(true)
    expect(await Bun.file(join(charactersRoot, 'hero--outline-sheet.png')).text()).toBe('composed-sheet')
    expect((await Array.fromAsync(new Bun.Glob('front.png').scan({ cwd: charactersRoot })))).toEqual([])

    let calls = 0
    await expect(characterSketchCommand({ character: 'hero', imageModels: ['gpt-image-2'], concurrency: 1 }, {
      createGenerationId: () => 'failed-generation',
      requestImage: async () => {
        calls++
        if (calls === 2) throw new Error('mock provider failure')
        return { mode: 'edit', result: { imageBase64: 'ignored' } }
      },
      writeImage,
      composeSheet,
    })).rejects.toThrow(/registered outline sheet was not changed/)
    expect(JSON.parse(await Bun.file(manifestPath).text()).sketches[0].generationId).toBe('successful-generation')
    expect(await Bun.file(join(charactersRoot, 'hero--outline-sheet.png')).text()).toBe('composed-sheet')
  })

  test('single-image character generation replaces and registers the one canonical reference atomically', async () => {
    const charactersRoot = await makeCatalog({
      characters: [
        { key: 'hero', name: 'Captain Hero', aliases: ['HERO'], image: 'hero.webp', outlineSheet: 'hero.webp', description: 'Hero reference.' },
      ],
      groupAliases: [],
    })
    configureCharactersRoot(charactersRoot)
    const referenceCalls: string[][] = []
    await characterSketchCommand({ character: 'hero', imageModels: ['gpt-image-2'], concurrency: 1 }, {
      createGenerationId: () => 'single-image-generation',
      requestImage: async (_prompt, references) => {
        referenceCalls.push(references)
        return { mode: 'edit', result: { imageBase64: 'ignored' } }
      },
      writeImage: async path => { await writeFile(path, 'view') },
      composeSheet: async selection => { await writeFile(selection.outputPath, 'new-canonical-reference'); return { width: 3, height: 1 } },
    })
    const canonicalPath = join(charactersRoot, 'hero.webp')
    expect(referenceCalls).toHaveLength(3)
    expect(referenceCalls.every(references => references.length === 1 && references[0] === canonicalPath)).toBe(true)
    expect(await Bun.file(canonicalPath).text()).toBe('new-canonical-reference')
    const registration = JSON.parse(await Bun.file(getCharacterSketchManifestPath(charactersRoot)).text()).sketches[0]
    const canonicalSha256 = await checksumFile(canonicalPath)
    expect(registration).toMatchObject({
      generationId: 'single-image-generation',
      sourceImage: 'hero.webp',
      outlineSheet: 'hero.webp',
      sourceSha256: canonicalSha256,
      sheetSha256: canonicalSha256,
    })
    await expect(requireCurrentCharacterSketch(loadCharacterCatalog(charactersRoot).requireKey('hero'))).resolves.toBeTruthy()
  })

  test('revision validates provenance and sends canonical source before the current flat sheet', async () => {
    const charactersRoot = await makeCatalog()
    configureCharactersRoot(charactersRoot)
    const sheetPath = join(charactersRoot, 'hero--outline-sheet.png')
    await writeFile(sheetPath, 'current-sheet')
    await writeFile(getCharacterSketchManifestPath(charactersRoot), JSON.stringify({ schemaVersion: 1, sketches: [{
      characterKey: 'hero', generationId: 'prior', origin: 'generated', sourceImage: 'hero.webp', outlineSheet: 'hero--outline-sheet.png',
      sourceSha256: await checksumFile(join(charactersRoot, 'hero.webp')), sheetSha256: await checksumFile(sheetPath), model: 'gpt-image-2', createdAt: new Date().toISOString(),
    }] }))
    const referenceCalls: string[][] = []
    await characterSketchCommand({ character: 'hero', revise: true, notes: 'Fix eyes', imageModels: ['gpt-image-2'], concurrency: 1 }, {
      createGenerationId: () => 'revision',
      requestImage: async (_prompt, references) => { referenceCalls.push(references); return { mode: 'edit', result: { imageBase64: 'ignored' } } },
      writeImage: async path => { await writeFile(path, 'view') },
      composeSheet: async selection => { await writeFile(selection.outputPath, 'revised-sheet'); return { width: 3, height: 1 } },
    })
    expect(referenceCalls).toHaveLength(3)
    expect(referenceCalls.every(references => references[0] === join(charactersRoot, 'hero.webp') && references[1] === sheetPath)).toBe(true)
    const registration = JSON.parse(await Bun.file(getCharacterSketchManifestPath(charactersRoot)).text()).sketches[0]
    expect(registration).toMatchObject({ generationId: 'revision', origin: 'revision', priorGenerationId: 'prior' })
    await writeFile(sheetPath, 'tampered')
    await expect(requireCurrentCharacterSketch(loadCharacterCatalog(charactersRoot).requireKey('hero'))).rejects.toThrow(/stale or tampered/)
  })
})
