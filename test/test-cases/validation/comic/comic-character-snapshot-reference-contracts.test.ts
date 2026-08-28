import { afterEach,describe,expect,test } from 'bun:test'
import { rm,writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { configureOutputRoot } from '~/cli/commands/process-steps/output-root'
import { checksumFile,getCharacterSketchManifestPath } from '~/cli/commands/process-steps/step-8-comic/comic-commands/process-scenes/character-utils'
import { loadCharacterCatalog } from '~/cli/commands/process-steps/step-8-comic/comic-utils/character-reference-config'
import { compileCharacterReferences,createCharacterReferenceSnapshot,loadAndVerifyCharacterReferenceSnapshot } from '~/cli/commands/process-steps/step-8-comic/comic-utils/character-reference-snapshot'
import { trimOptionalContinuityReferences } from '~/cli/commands/process-steps/step-8-comic/comic-utils/reference-capabilities'
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

  test('snapshot copies each character once, orders sheet before source, and detects tampering', async () => {
    const charactersRoot = await makeCatalog()
    configureCharactersRoot(charactersRoot)
    const catalog = loadCharacterCatalog(charactersRoot)
    const outputRoot = await makeTempDir('autoshow-character-output-')
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
    expect(manifest.characters[0]?.assets.every(asset => asset.path.startsWith('assets/character-references/'))).toBe(true)
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
    expect(loadAndVerifyCharacterReferenceSnapshot(runDirectory, manifest.snapshotId)).toBeTruthy()
    await writeFile(join(runDirectory, manifest.characters[0]!.assets[0]!.path), 'tampered')
    expect(() => loadAndVerifyCharacterReferenceSnapshot(runDirectory, manifest.snapshotId)).toThrow(/modified or corrupted/)
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
      characterKey: key, generationId: 'single-reference', origin: 'generated', sourceImage: 'hero.webp', outlineSheet: 'hero.webp',
      sourceSha256: sha256, sheetSha256: sha256, model: null, createdAt: new Date().toISOString(),
    }] }))
    const runDirectory = await makeTempDir('autoshow-single-character-run-')
    temporaryRoots.push(runDirectory)
    const manifest = await createCharacterReferenceSnapshot(runDirectory, [key], catalog)
    expect(manifest.characters[0]?.assets.map(asset => asset.role)).toEqual(['sketch-sheet', 'source-image'])
    expect(new Set(manifest.characters[0]?.assets.map(asset => asset.path))).toHaveLength(1)
    const references = compileCharacterReferences(runDirectory, manifest, [key])
    expect(references).toEqual([join(runDirectory, manifest.characters[0]!.assets[0]!.path)])
    expect(references[0]).toEndWith('/hero/reference.webp')
    expect(await Bun.file(join(runDirectory, 'assets', 'character-references', manifest.snapshotId, 'identity-cards', '01-hero-identity-card.png')).exists()).toBe(false)
  })

  test('registry capabilities never trim required references and trim optional continuity deterministically', () => {
    expect(() => trimOptionalContinuityReferences('gpt-image-2', Array.from({ length: 17 }, (_, index) => `required-${index}`), [])).toThrow(/requires 17/)
    const result = trimOptionalContinuityReferences('gpt-image-2', ['sheet', 'source'], Array.from({ length: 20 }, (_, index) => `continuity-${index}`))
    expect(result.references.slice(0, 2)).toEqual(['sheet', 'source'])
    expect(result.references).toHaveLength(16)
    expect(result.trimmed).toHaveLength(6)
  })
})
