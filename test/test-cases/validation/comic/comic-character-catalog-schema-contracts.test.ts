import { afterEach,describe,expect,test } from 'bun:test'
import { rm,writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import * as v from 'valibot'
import { configureCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { configureOutputRoot } from '~/cli/commands/process-steps/output-root'
import { getCharacterSketchManifestPath,readCharacterSketchManifest } from '~/cli/commands/process-steps/step-8-comic/comic-commands/process-scenes/character-utils'
import { loadCharacterCatalog } from '~/cli/commands/process-steps/step-8-comic/comic-utils/character-reference-config'
import { buildSceneJsonSchema,buildStructuredScriptJsonSchema,PanelBundleDataSchema,ScenePromptDataSchema,StructuredScriptDataSchema } from '~/cli/commands/process-steps/step-8-comic/schemas/schemas'
import { makeTempDir } from '../../../test-utils/temp-dirs'

const temporaryRoots: string[] = []
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
afterEach(async () => {
  configureOutputRoot('./output')
  configureCharactersRoot('input/characters')
  await Promise.all(temporaryRoots.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

const makeCatalog = async (overrides: Record<string, unknown> = {}) => {
  const root = await makeTempDir('autoshow-character-catalog-')
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

  test('catalog permits a missing one-file canonical asset when a style-only generation reference exists', async () => {
    const root = await makeCatalog({
      characters: [
        {
          key: 'new-alien', name: 'New Alien', aliases: ['NEW ALIEN'], image: 'new-alien.png', outlineSheet: 'new-alien.png',
          generationReference: 'hero.webp', generationInstructions: 'Render full-color cel-shaded character art.', description: 'A new four-armed alien.',
        },
      ],
      groupAliases: [],
    })
    const catalog = loadCharacterCatalog(root)
    const alien = catalog.get(catalog.requireKey('new-alien'))
    expect(alien.generationReferencePath).toBe(join(root, 'hero.webp'))
    expect(Bun.file(alien.sourcePath).size).toBe(0)
  })

  test('character sketch manifests accept only generated and revision origins', async () => {
    const root = await makeCatalog()
    const sketch = (origin: string) => ({
      characterKey: 'hero', generationId: 'hero-1', origin, sourceImage: 'hero.webp', outlineSheet: 'hero--outline-sheet.png',
      sourceSha256: 'a'.repeat(64), sheetSha256: 'b'.repeat(64), model: null, createdAt: '2026-01-01T00:00:00.000Z',
    })
    await writeFile(getCharacterSketchManifestPath(root), JSON.stringify({ schemaVersion: 1, sketches: [sketch('generated')] }))
    expect((await readCharacterSketchManifest(root)).sketches[0]?.origin).toBe('generated')

    await writeFile(getCharacterSketchManifestPath(root), JSON.stringify({ schemaVersion: 1, sketches: [sketch('legacy-import')] }))
    await expect(readCharacterSketchManifest(root)).rejects.toThrow()
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
})
