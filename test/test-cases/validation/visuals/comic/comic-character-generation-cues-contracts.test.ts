import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import { buildComicPagePrompt, buildComicPagePromptData } from '~/cli/commands/visuals/comic/comic-commands/generate-images/comic-page-utils'
import { withCharacterCatalog } from '~/cli/commands/visuals/comic/comic-utils/character-reference-config'
import { createCharacterReferenceSnapshot, loadAndVerifyCharacterReferenceSnapshot } from '~/cli/commands/visuals/comic/comic-utils/character-reference-snapshot'
import { resolveGroupedReferenceImages, resolveReferenceImages } from '~/cli/commands/visuals/comic/comic-utils/panel-prompt-utils'
import { createLiveCharacterFixture } from '../../../../test-utils/live-character-reference-fixture'
import { setupPageContractFixtures } from './comic-page-contract-fixtures'

const { createSceneFixture, panelBundle } = setupPageContractFixtures()
afterEach(() => configureCharactersRoot('input/characters'))

const catalogCharacters = (description = 'Hero in olive.') => [
  { key: 'hero', name: 'Hero', aliases: ['HERO'], image: 'hero.webp', outlineSheet: 'hero.webp', description },
  { key: 'sidekick', name: 'Sidekick', aliases: ['SIDEKICK'], image: 'sidekick.png', outlineSheet: 'sidekick.png', description: 'Sidekick in khaki.' },
]

const prepareReferences = async () => {
  const { runDirectory } = await createSceneFixture(`live-cues-${crypto.randomUUID()}`)
  const { charactersRoot, catalog } = await createLiveCharacterFixture(runDirectory, catalogCharacters())
  const manifest = await createCharacterReferenceSnapshot(runDirectory, catalog.characterKeys, catalog)
  const bundle = panelBundle(1)
  bundle.snapshotId = 'historical-snapshot-id'
  bundle.panels[0]!.characterKeys = ['hero', 'sidekick']
  const panelDirectory = join(runDirectory, 'metadata', 'panel-prompts', 'panel-01')
  const manifestPath = join(runDirectory, 'assets', 'character-references.json')
  const updateLiveDescription = async () => {
    await writeFile(join(charactersRoot, 'characters-reference.json'), JSON.stringify({ schemaVersion: 3, characters: catalogCharacters('Hero in soot-black.'), groupAliases: [] }))
  }
  return { charactersRoot, runDirectory, panelDirectory, manifestPath, manifest, bundle, updateLiveDescription }
}

const heroDescription = (references: ReturnType<typeof resolveReferenceImages>) =>
  references.characterReferences?.find(reference => reference.key === 'hero')?.description

describe('comic generation uses the latest canonical character descriptions and wardrobe', () => {
  test('applies a live redesign to individual and grouped generation prompts without rebuilding bundles', async () => {
    const fixture = await prepareReferences()
    await fixture.updateLiveDescription()
    const individual = resolveReferenceImages(fixture.panelDirectory, [], fixture.bundle, 'gpt-image-2.6-sunburst')
    const grouped = resolveGroupedReferenceImages([
      { panelDirectory: fixture.panelDirectory, panelEntries: [], bundleData: fixture.bundle },
    ], 'gpt-image-2.6-sunburst')
    for (const references of [individual, grouped]) {
      expect(heroDescription(references)).toBe('Hero in soot-black.')
      expect(references.characterReferences?.every(reference => !('distinguishFrom' in reference))).toBe(true)
      const prompt = buildComicPagePrompt(buildComicPagePromptData([fixture.bundle]), references.characterReferences)
      expect(prompt).toContain('characterKey=hero; catalog appearance=Hero in soot-black.')
      expect(prompt).not.toContain('Hero in olive.')
    }
    expect(existsSync(fixture.manifestPath)).toBe(false)
    expect(fixture.manifest.characters[0]?.description).toBe('Hero in olive.')
    expect(fixture.manifest.characters[0]).not.toHaveProperty('distinguishFrom')
  })

  test('ignores stale malformed scene snapshot metadata in favor of canonical descriptions', async () => {
    const fixture = await prepareReferences()
    await mkdir(join(fixture.runDirectory, 'assets'), { recursive: true })
    await writeFile(fixture.manifestPath, '{malformed obsolete manifest')
    await fixture.updateLiveDescription()
    expect(loadAndVerifyCharacterReferenceSnapshot(fixture.runDirectory, undefined, ['hero', 'sidekick']).characters[0]?.description).toBe('Hero in soot-black.')
    expect(heroDescription(resolveReferenceImages(fixture.panelDirectory, [], fixture.bundle, 'gpt-image-2.6-sunburst'))).toBe('Hero in soot-black.')
  })

  test('refreshes wardrobe colors and prohibitions in the generation prompt without overriding named costume exceptions', async () => {
    const fixture = await prepareReferences()
    const path = join(fixture.charactersRoot, 'characters-reference.json')
    const value = JSON.parse(await Bun.file(path).text())
    value.characters[0].wardrobe = { colorTokens: ['olive'], never: ['purple cape'] }
    await writeFile(path, JSON.stringify(value))
    await withCharacterCatalog(async () => {
      value.characters[0].wardrobe = { colorTokens: ['soot-black'], never: ['bomber jacket'], deviationStates: [{ state: 'ceremonial', description: 'White robe for the reviewed ceremony.' }] }
      await writeFile(path, JSON.stringify(value))
      const refs = resolveReferenceImages(fixture.panelDirectory, [], fixture.bundle, 'gpt-image-2.6-sunburst')
      const prompt = buildComicPagePrompt(fixture.bundle, refs.characterReferences)
      expect(prompt).toContain('"colorTokens":["soot-black"]')
      expect(prompt).toContain('"never":["bomber jacket"]')
      expect(prompt).toContain('"state":"ceremonial"')
      expect(prompt).toContain('only when the reviewed panel explicitly declares that allowed state')
      expect(prompt).toContain('takes precedence over older generic costume or color text')
      expect(prompt).not.toContain('purple cape')
    })
  })

  test('rejects a malformed current catalog description before generation', async () => {
    const fixture = await prepareReferences()
    const path = join(fixture.charactersRoot, 'characters-reference.json')
    const invalid = JSON.parse(await Bun.file(path).text())
    invalid.characters[0].description = 123
    await writeFile(path, JSON.stringify(invalid))
    expect(() => resolveReferenceImages(fixture.panelDirectory, [], fixture.bundle, 'gpt-image-2.6-sunburst')).toThrow(/Invalid character catalog/)
  })
})
