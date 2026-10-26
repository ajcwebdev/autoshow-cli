import { afterEach, describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import { checksumFile, getCharacterSketchManifestPath } from '~/cli/commands/visuals/comic/comic-commands/process-scenes/character-utils'
import { buildComicPageQaPrompt } from '~/cli/commands/visuals/comic/comic-commands/generate-images/comic-page-qa'
import { loadCharacterCatalog } from '~/cli/commands/visuals/comic/comic-utils/character-reference-config'
import { createCharacterReferenceSnapshot, loadAndVerifyCharacterReferenceSnapshot } from '~/cli/commands/visuals/comic/comic-utils/character-reference-snapshot'
import { resolveGroupedReferenceImages, resolveReferenceImages } from '~/cli/commands/visuals/comic/comic-utils/panel-prompt-utils'
import { makeCatalog } from '../../../../test-utils/character-catalog-fixture'
import { setupPageContractFixtures } from './comic-page-contract-fixtures'

const { temporaryDirectories, createSceneFixture, panelBundle } = setupPageContractFixtures()
afterEach(() => configureCharactersRoot('input/characters'))

const oldCue = 'Hero wears olive; Sidekick wears khaki.'
const newCue = 'Hero wears soot-black; Sidekick wears slate-blue.'
const catalogCharacters = (cue?: string) => [
  {
    key: 'hero', name: 'Hero', aliases: ['HERO'], image: 'hero.webp', outlineSheet: 'hero.webp', description: 'Hero in olive.',
    ...(cue !== undefined ? { distinguishFrom: [{ characterKey: 'sidekick', cue }] } : {}),
  },
  { key: 'sidekick', name: 'Sidekick', aliases: ['SIDEKICK'], image: 'sidekick.png', outlineSheet: 'sidekick.png', description: 'Sidekick in khaki.' },
]

const prepareSnapshot = async (cue?: string) => {
  const charactersRoot = await makeCatalog({ characters: catalogCharacters(cue), groupAliases: [] }, {
    registerRoot: root => { temporaryDirectories.push(root) },
  })
  configureCharactersRoot(charactersRoot)
  const catalog = loadCharacterCatalog(charactersRoot)
  const sketches = await Promise.all(catalog.characterKeys.map(async key => {
    const character = catalog.get(key)
    const sha256 = await checksumFile(character.sourcePath)
    return {
      characterKey: key, generationId: `original-${key}`, origin: 'generated',
      sourceImage: character.image, outlineSheet: character.outlineSheet,
      sourceSha256: sha256, sheetSha256: sha256, model: 'gpt-image-2.5-sunburst', createdAt: new Date().toISOString(),
    }
  }))
  await writeFile(getCharacterSketchManifestPath(charactersRoot), JSON.stringify({ schemaVersion: 1, sketches }))
  const { runDirectory } = await createSceneFixture(`snapshot-cues-${crypto.randomUUID()}`)
  const manifest = await createCharacterReferenceSnapshot(runDirectory, catalog.characterKeys, catalog)
  const bundle = panelBundle(1)
  bundle.snapshotId = manifest.snapshotId
  bundle.panels[0]!.characterKeys = ['hero', 'sidekick']
  const panelDirectory = join(runDirectory, 'metadata', 'panel-prompts', 'panel-01')
  const manifestPath = join(runDirectory, 'assets', 'character-references.json')
  const updateLiveCues = async () => {
    await writeFile(join(charactersRoot, 'characters-reference.json'), JSON.stringify({ schemaVersion: 3, characters: catalogCharacters(newCue), groupAliases: [] }))
    expect(loadCharacterCatalog(charactersRoot).get(catalog.requireKey('hero')).distinguishFrom?.[0]?.cue).toBe(newCue)
  }
  return { charactersRoot, runDirectory, panelDirectory, manifestPath, manifest, bundle, updateLiveCues }
}

describe('comic QA character cues use immutable scene snapshots', () => {
  test('preserves historical cues through individual and grouped reference resolution after a live redesign', async () => {
    const fixture = await prepareSnapshot(oldCue)
    const originalBytes = await Bun.file(fixture.manifestPath).text()
    await fixture.updateLiveCues()

    const individual = resolveReferenceImages(fixture.panelDirectory, [], fixture.bundle, 'gpt-image-2.5-sunburst')
    const grouped = resolveGroupedReferenceImages([
      { panelDirectory: fixture.panelDirectory, panelEntries: [], bundleData: fixture.bundle },
    ], 'gpt-image-2.5-sunburst')
    for (const references of [individual, grouped]) {
      const prompt = buildComicPageQaPrompt(fixture.bundle, references.characterReferences)
      expect(prompt).toContain(`hero versus sidekick: ${oldCue}`)
      expect(prompt).not.toContain(newCue)
    }
    expect(await Bun.file(fixture.manifestPath).text()).toBe(originalBytes)

    const currentCatalog = loadCharacterCatalog(fixture.charactersRoot)
    const fresh = await createCharacterReferenceSnapshot(fixture.runDirectory, currentCatalog.characterKeys, currentCatalog)
    expect(fresh.snapshotId).not.toBe(fixture.manifest.snapshotId)
    expect(fresh.characters[0]?.distinguishFrom?.[0]?.cue).toBe(newCue)
  })

  test('keeps legacy schema-v2 snapshots readable without borrowing live cues', async () => {
    const fixture = await prepareSnapshot(oldCue)
    for (const character of fixture.manifest.characters) delete character.distinguishFrom
    await writeFile(fixture.manifestPath, JSON.stringify(fixture.manifest))
    await fixture.updateLiveCues()

    expect(loadAndVerifyCharacterReferenceSnapshot(fixture.runDirectory).characters[0]?.distinguishFrom).toBeUndefined()
    const references = resolveReferenceImages(fixture.panelDirectory, [], fixture.bundle, 'gpt-image-2.5-sunburst')
    const prompt = buildComicPageQaPrompt(fixture.bundle, references.characterReferences)
    expect(prompt).toContain('hero: Hero in olive.')
    expect(prompt).not.toContain('Lookalike cues for characters that share this panel')
    expect(prompt).not.toContain(newCue)
  })

  test('records an explicit empty cue list when the snapshot predates newly authored cues', async () => {
    const fixture = await prepareSnapshot()
    expect(fixture.manifest.characters.every(character => Array.isArray(character.distinguishFrom) && character.distinguishFrom.length === 0)).toBe(true)
    await fixture.updateLiveCues()
    const references = resolveReferenceImages(fixture.panelDirectory, [], fixture.bundle, 'gpt-image-2.5-sunburst')
    const prompt = buildComicPageQaPrompt(fixture.bundle, references.characterReferences)
    expect(prompt).not.toContain(newCue)
    expect(prompt).not.toContain('Lookalike cues for characters that share this panel')
  })

  test('rejects malformed snapshotted distinction cues before QA', async () => {
    const fixture = await prepareSnapshot(oldCue)
    const invalid = JSON.parse(await Bun.file(fixture.manifestPath).text())
    invalid.characters[0].distinguishFrom[0].cue = 123
    await writeFile(fixture.manifestPath, JSON.stringify(invalid))
    expect(() => resolveReferenceImages(fixture.panelDirectory, [], fixture.bundle, 'gpt-image-2.5-sunburst')).toThrow('Invalid character reference manifest')
  })
})
