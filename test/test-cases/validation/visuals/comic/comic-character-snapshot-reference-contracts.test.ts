import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import { configureOutputRoot } from '~/cli/commands/command-shared/output-root'
import { checksumFile, getCharacterSketchManifestPath } from '~/cli/commands/visuals/comic/comic-commands/process-scenes/character-utils'
import { loadCharacterCatalog, withCharacterCatalog } from '~/cli/commands/visuals/comic/comic-utils/character-reference-config'
import { compileCharacterReferences, createCharacterReferenceSnapshot, loadAndVerifyCharacterReferenceSnapshot } from '~/cli/commands/visuals/comic/comic-utils/character-reference-snapshot'
import { trimOptionalContinuityReferences } from '~/cli/commands/visuals/comic/comic-utils/reference-capabilities'
import { makeTempDir } from '../../../../test-utils/temp-dirs'
import { makeCatalog, tinyPngFixture } from '../../../../test-utils/character-catalog-fixture'
import { createLiveCharacterFixture } from '../../../../test-utils/live-character-reference-fixture'

const temporaryRoots: string[] = []
const fixture = async () => {
  const root = await makeTempDir('autoshow-live-character-')
  temporaryRoots.push(root)
  const current = await createLiveCharacterFixture(root)
  return { root, runDirectory: join(root, 'output', 'scene'), ...current }
}
afterEach(async () => {
  configureOutputRoot('./output')
  configureCharactersRoot('input/characters')
  await Promise.all(temporaryRoots.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('comic live canonical character references', () => {
  test('uses canonical source and sheet paths without writing snapshots or identity cards', async () => {
    const root = await makeTempDir('autoshow-live-distinct-character-')
    temporaryRoots.push(root)
    const { catalog } = await createLiveCharacterFixture(root, [{ key: 'hero', name: 'Hero', aliases: [], image: 'hero.png', outlineSheet: 'hero-sheet.png', description: 'Hero reference.' }])
    const runDirectory = join(root, 'output', 'scene')
    const key = catalog.requireKey('hero')
    const manifest = await createCharacterReferenceSnapshot(runDirectory, [key, key], catalog)
    expect(manifest.snapshotId).toBe('live')
    expect(manifest.characters).toHaveLength(1)
    expect(manifest.characters[0]?.assets.map(asset => asset.role)).toEqual(['sketch-sheet', 'source-image'])
    expect(manifest.characters[0]?.assets.map(asset => resolve(runDirectory, asset.path))).toEqual([catalog.get(key).outlineSheetPath, catalog.get(key).sourcePath])
    expect(compileCharacterReferences(runDirectory, manifest, [key])).toEqual([catalog.get(key).outlineSheetPath])
    expect(existsSync(runDirectory)).toBe(false)
  })

  test('follows replacement canonical paths and registered bytes despite legacy bundle IDs and manifests', async () => {
    const f = await fixture()
    const original = await createCharacterReferenceSnapshot(f.runDirectory, f.catalog.characterKeys, f.catalog)
    await mkdir(join(f.runDirectory, 'assets'), { recursive: true })
    await writeFile(join(f.runDirectory, 'assets', 'character-references.json'), '{invalid old snapshot')
    const catalogPath = join(f.charactersRoot, 'characters-reference.json')
    const authored = JSON.parse(await Bun.file(catalogPath).text())
    authored.characters[0].image = 'hero-latest.png'
    authored.characters[0].outlineSheet = 'hero-latest.png'
    const latestPath = join(f.charactersRoot, 'hero-latest.png')
    await writeFile(latestPath, Buffer.concat([tinyPngFixture(), Buffer.from('latest')]))
    await writeFile(catalogPath, JSON.stringify(authored))
    const sha256 = await checksumFile(latestPath)
    const registrationsPath = getCharacterSketchManifestPath(f.charactersRoot)
    const registrations = JSON.parse(await Bun.file(registrationsPath).text())
    Object.assign(registrations.sketches[0], { generationId: 'latest-generation', sourceImage: 'hero-latest.png', outlineSheet: 'hero-latest.png', sourceSha256: sha256, sheetSha256: sha256 })
    await writeFile(registrationsPath, JSON.stringify(registrations))
    const latest = loadAndVerifyCharacterReferenceSnapshot(f.runDirectory, 'historical-snapshot-id', ['hero'])
    expect(latest.characters[0]?.sourceSketchVersion).toBe('latest-generation')
    expect(latest.characters[0]?.assets.every(asset => asset.sha256 === sha256)).toBe(true)
    expect(compileCharacterReferences(f.runDirectory, original, ['hero'])).toEqual([latestPath])
    expect(await Bun.file(join(f.runDirectory, 'assets', 'character-references.json')).text()).toBe('{invalid old snapshot')
  })

  test('reads current descriptions within a previously loaded catalog context without changing registration', async () => {
    const f = await fixture()
    await withCharacterCatalog(async () => {
      const catalogPath = join(f.charactersRoot, 'characters-reference.json')
      const authored = JSON.parse(await Bun.file(catalogPath).text())
      authored.characters[0].description = 'Hero now wears a blue coat.'
      await writeFile(catalogPath, JSON.stringify(authored))
      expect(loadAndVerifyCharacterReferenceSnapshot(f.runDirectory, undefined, ['hero']).characters[0]?.description).toBe('Hero now wears a blue coat.')
      expect((await createCharacterReferenceSnapshot(f.runDirectory, f.catalog.characterKeys, f.catalog)).characters[0]?.description).toBe('Hero now wears a blue coat.')
    })
    expect(existsSync(f.runDirectory)).toBe(false)
  })

  test('rejects changed bytes until their canonical registration is updated', async () => {
    const f = await fixture()
    await writeFile(join(f.charactersRoot, 'hero.png'), 'tampered')
    expect(() => loadAndVerifyCharacterReferenceSnapshot(f.runDirectory, undefined, ['hero'])).toThrow(/stale or tampered/)
  })

  test('rejects missing canonical sheets and symlinks escaping the canonical root', async () => {
    const f = await fixture()
    const heroPath = join(f.charactersRoot, 'hero.png')
    await rm(heroPath)
    expect(() => loadAndVerifyCharacterReferenceSnapshot(f.runDirectory, undefined, ['hero'])).toThrow(/not found|missing/)
    const outside = join(f.root, 'outside.png')
    await writeFile(outside, tinyPngFixture())
    await symlink(outside, heroPath)
    expect(() => loadAndVerifyCharacterReferenceSnapshot(f.runDirectory, undefined, ['hero'])).toThrow(/escapes the characters root/)
  })

  test('resolves only the scene and explicit roster instead of unrelated unregistered characters', async () => {
    const root = await makeCatalog({}, { registerRoot: path => temporaryRoots.push(path) })
    configureCharactersRoot(root)
    const catalog = loadCharacterCatalog(root)
    const hero = catalog.get(catalog.requireKey('hero'))
    await writeFile(hero.outlineSheetPath, tinyPngFixture())
    await writeFile(getCharacterSketchManifestPath(root), JSON.stringify({ schemaVersion: 1, sketches: [{ characterKey: hero.key, generationId: 'hero-current', origin: 'generated', sourceImage: hero.image, outlineSheet: hero.outlineSheet, sourceSha256: await checksumFile(hero.sourcePath), sheetSha256: await checksumFile(hero.outlineSheetPath), model: null, createdAt: '2026-10-26T00:00:00.000Z' }] }))
    const runDirectory = join(root, 'scene')
    await mkdir(join(runDirectory, 'metadata'), { recursive: true })
    await writeFile(join(runDirectory, 'metadata', 'scene.json'), JSON.stringify({ panels: [{ characterKeys: ['hero'] }] }))
    await writeFile(join(runDirectory, 'metadata', 'blocking-plan.json'), JSON.stringify({ stageStates: [{ characters: [{ characterKey: 'hero' }], extras: [{ ensembleKey: 'anonymous-crew' }] }] }))
    expect(loadAndVerifyCharacterReferenceSnapshot(runDirectory).characters.map(character => character.key)).toEqual(['hero'])
  })

  test('registry capabilities never trim required references and trim optional continuity deterministically', () => {
    expect(() => trimOptionalContinuityReferences('gpt-image-2.5-flare', Array.from({ length: 17 }, (_, index) => `required-${index}`), [])).toThrow(/requires 17/)
    const result = trimOptionalContinuityReferences('gpt-image-2.5-flare', ['sheet', 'source'], Array.from({ length: 20 }, (_, index) => `continuity-${index}`))
    expect(result.references.slice(0, 2)).toEqual(['sheet', 'source'])
    expect(result.references).toHaveLength(16)
    expect(result.trimmed).toHaveLength(6)
  })
})
