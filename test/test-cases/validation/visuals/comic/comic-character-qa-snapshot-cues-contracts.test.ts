import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import { buildComicPageQaPrompt } from '~/cli/commands/visuals/comic/comic-commands/generate-images/comic-page-qa'
import { buildComicPagePrompt } from '~/cli/commands/visuals/comic/comic-commands/generate-images/comic-page-utils'
import { withCharacterCatalog } from '~/cli/commands/visuals/comic/comic-utils/character-reference-config'
import { createCharacterReferenceSnapshot, loadAndVerifyCharacterReferenceSnapshot } from '~/cli/commands/visuals/comic/comic-utils/character-reference-snapshot'
import { resolveGroupedReferenceImages, resolveReferenceImages } from '~/cli/commands/visuals/comic/comic-utils/panel-prompt-utils'
import { createLiveCharacterFixture } from '../../../../test-utils/live-character-reference-fixture'
import { setupPageContractFixtures } from './comic-page-contract-fixtures'

const { createSceneFixture, panelBundle } = setupPageContractFixtures()
afterEach(() => configureCharactersRoot('input/characters'))

const oldCue = 'Hero wears olive; Sidekick wears khaki.'
const newCue = 'Hero wears soot-black; Sidekick wears slate-blue.'
const catalogCharacters = (cue?: string, description = 'Hero in olive.') => [
  {
    key: 'hero', name: 'Hero', aliases: ['HERO'], image: 'hero.webp', outlineSheet: 'hero.webp', description,
    ...(cue !== undefined ? { distinguishFrom: [{ characterKey: 'sidekick', cue }] } : {}),
  },
  { key: 'sidekick', name: 'Sidekick', aliases: ['SIDEKICK'], image: 'sidekick.png', outlineSheet: 'sidekick.png', description: 'Sidekick in khaki.' },
]

const prepareReferences = async (cue?: string) => {
  const { runDirectory } = await createSceneFixture(`live-cues-${crypto.randomUUID()}`)
  const { charactersRoot, catalog } = await createLiveCharacterFixture(runDirectory, catalogCharacters(cue))
  const manifest = await createCharacterReferenceSnapshot(runDirectory, catalog.characterKeys, catalog)
  const bundle = panelBundle(1)
  bundle.snapshotId = 'historical-snapshot-id'
  bundle.panels[0]!.characterKeys = ['hero', 'sidekick']
  const panelDirectory = join(runDirectory, 'metadata', 'panel-prompts', 'panel-01')
  const manifestPath = join(runDirectory, 'assets', 'character-references.json')
  const updateLiveCues = async () => {
    await writeFile(join(charactersRoot, 'characters-reference.json'), JSON.stringify({ schemaVersion: 3, characters: catalogCharacters(newCue, 'Hero in soot-black.'), groupAliases: [] }))
  }
  return { charactersRoot, runDirectory, panelDirectory, manifestPath, manifest, bundle, updateLiveCues }
}

describe('comic QA uses latest canonical character descriptions and distinction cues', () => {
  test('applies live redesign cues to individual and grouped resolution without rebuilding bundles', async () => {
    const fixture = await prepareReferences(oldCue)
    await fixture.updateLiveCues()
    const individual = resolveReferenceImages(fixture.panelDirectory, [], fixture.bundle, 'gpt-image-2.5-sunburst')
    const grouped = resolveGroupedReferenceImages([
      { panelDirectory: fixture.panelDirectory, panelEntries: [], bundleData: fixture.bundle },
    ], 'gpt-image-2.5-sunburst')
    for (const references of [individual, grouped]) {
      const prompt = buildComicPageQaPrompt(fixture.bundle, references.characterReferences)
      expect(prompt).toContain(`hero versus sidekick: ${newCue}`)
      expect(prompt).toContain('hero: Hero in soot-black.')
      expect(prompt).not.toContain(oldCue)
    }
    expect(existsSync(fixture.manifestPath)).toBe(false)
    expect(fixture.manifest.characters[0]?.distinguishFrom?.[0]?.cue).toBe(oldCue)
  })

  test('ignores stale malformed scene snapshot metadata in favor of canonical cues', async () => {
    const fixture = await prepareReferences(oldCue)
    await mkdir(join(fixture.runDirectory, 'assets'), { recursive: true })
    await writeFile(fixture.manifestPath, '{malformed obsolete manifest')
    await fixture.updateLiveCues()
    expect(loadAndVerifyCharacterReferenceSnapshot(fixture.runDirectory, undefined, ['hero', 'sidekick']).characters[0]?.distinguishFrom?.[0]?.cue).toBe(newCue)
    const references = resolveReferenceImages(fixture.panelDirectory, [], fixture.bundle, 'gpt-image-2.5-sunburst')
    expect(buildComicPageQaPrompt(fixture.bundle, references.characterReferences)).toContain(newCue)
  })

  test('picks up newly authored cues when a prior resolution had none', async () => {
    const fixture = await prepareReferences()
    expect(fixture.manifest.characters.every(character => character.distinguishFrom?.length === 0)).toBe(true)
    await fixture.updateLiveCues()
    const references = resolveReferenceImages(fixture.panelDirectory, [], fixture.bundle, 'gpt-image-2.5-sunburst')
    expect(buildComicPageQaPrompt(fixture.bundle, references.characterReferences)).toContain(newCue)
  })

  test('refreshes wardrobe colors and prohibitions in generation and QA without overriding named costume exceptions', async () => {
    const fixture = await prepareReferences(oldCue)
    const path = join(fixture.charactersRoot, 'characters-reference.json')
    const value = JSON.parse(await Bun.file(path).text())
    value.characters[0].wardrobe = { colorTokens: ['olive'], never: ['purple cape'] }
    await writeFile(path, JSON.stringify(value))
    await withCharacterCatalog(async () => {
      value.characters[0].wardrobe = { colorTokens: ['soot-black'], never: ['bomber jacket'], deviationStates: [{ state: 'ceremonial', description: 'White robe for the reviewed ceremony.' }] }
      await writeFile(path, JSON.stringify(value))
      const refs = resolveReferenceImages(fixture.panelDirectory, [], fixture.bundle, 'gpt-image-2.5-sunburst')
      for (const prompt of [buildComicPagePrompt(fixture.bundle, refs.characterReferences), buildComicPageQaPrompt(fixture.bundle, refs.characterReferences)]) {
        expect(prompt).toContain('"colorTokens":["soot-black"]')
        expect(prompt).toContain('"never":["bomber jacket"]')
        expect(prompt).toContain('"state":"ceremonial"')
        expect(prompt).toContain('only when the reviewed panel explicitly declares that allowed state')
        expect(prompt).toContain('takes precedence over older generic costume or color text')
        expect(prompt).not.toContain('purple cape')
      }
    })
  })

  test('rejects malformed current distinction cues before QA', async () => {
    const fixture = await prepareReferences(oldCue)
    const path = join(fixture.charactersRoot, 'characters-reference.json')
    const invalid = JSON.parse(await Bun.file(path).text())
    invalid.characters[0].distinguishFrom[0].cue = 123
    await writeFile(path, JSON.stringify(invalid))
    expect(() => resolveReferenceImages(fixture.panelDirectory, [], fixture.bundle, 'gpt-image-2.5-sunburst')).toThrow(/Invalid character catalog/)
  })
})
