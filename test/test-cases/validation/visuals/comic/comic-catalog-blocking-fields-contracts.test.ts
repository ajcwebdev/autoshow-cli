import { describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadCharacterCatalog } from '~/cli/commands/visuals/comic/comic-utils/character-reference-config'
import { makeTempDir } from '../../../../test-utils/temp-dirs'
import { setupBlockingContractFixtures } from './comic-blocking-contract-fixtures'
import { BLOCKING_FIXTURE_TINY_PNG } from './fixtures/blocking/blocking-plan-fixture'
const { temporaryDirectories } = setupBlockingContractFixtures()


describe('character catalog blocking fields', () => {
  const makeCatalog = async (characters: unknown[]) => {
    const root = await makeTempDir('autoshow-blocking-catalog-')
    temporaryDirectories.push(root)
    await writeFile(join(root, 'hero.png'), BLOCKING_FIXTURE_TINY_PNG)
    await writeFile(join(root, 'sidekick.png'), BLOCKING_FIXTURE_TINY_PNG)
    await writeFile(join(root, 'characters-reference.json'), JSON.stringify({ schemaVersion: 3, characters, groupAliases: [] }))
    return root
  }
  const hero = (extra: Record<string, unknown> = {}) => ({ key: 'hero', name: 'Hero', aliases: ['HERO'], image: 'hero.png', outlineSheet: 'hero.png', description: 'Hero.', ...extra })
  const sidekick = (extra: Record<string, unknown> = {}) => ({ key: 'sidekick', name: 'Sidekick', aliases: ['SIDEKICK'], image: 'sidekick.png', outlineSheet: 'sidekick.png', description: 'Sidekick.', ...extra })

  test('accepts variantOf, distinguishFrom, and wardrobe fields that reference catalog keys', async () => {
    const root = await makeCatalog([
      hero({ distinguishFrom: [{ characterKey: 'sidekick', cue: 'Hero is taller.' }], wardrobe: { colorTokens: ['jacket: red'], never: ['yellow jumpsuit'], deviationStates: [{ state: 'vacation', variantKey: 'sidekick', description: 'Hawaiian shirt.' }] } }),
      sidekick({ variantOf: 'hero', wardrobe: { colorTokens: ['hoodie: navy'] } }),
    ])
    const catalog = loadCharacterCatalog(root)
    expect(catalog.get(catalog.requireKey('hero')).distinguishFrom).toEqual([{ characterKey: 'sidekick', cue: 'Hero is taller.' }])
    expect(catalog.get(catalog.requireKey('hero')).wardrobe?.never).toEqual(['yellow jumpsuit'])
    expect(catalog.get(catalog.requireKey('sidekick')).variantOf).toBe('hero')
  })

  test('rejects variantOf and distinguishFrom references to missing keys and still rejects unknown keys', async () => {
    const load = async (characters: unknown[]) => loadCharacterCatalog(await makeCatalog(characters))
    await expect(load([hero({ variantOf: 'paddy' }), sidekick()])).rejects.toThrow('Character "hero" variantOf "paddy" is not a catalog key')
    await expect(load([hero({ distinguishFrom: [{ characterKey: 'ghost', cue: 'x' }] }), sidekick()])).rejects.toThrow('Character "hero" distinguishFrom "ghost" is not a catalog key')
    await expect(load([hero({ variantOf: 'hero' }), sidekick()])).rejects.toThrow('cannot name itself')
    await expect(load([hero({ unknownField: true }), sidekick()])).rejects.toThrow(/Invalid key|unknown key/i)
    await expect(load([hero({ wardrobe: { colorTokens: ['jacket: red'], extra: 1 } }), sidekick()])).rejects.toThrow(/Invalid key|unknown key/i)
  })
})
