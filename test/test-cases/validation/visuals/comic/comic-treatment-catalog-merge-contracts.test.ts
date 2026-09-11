import { describe, expect, test } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CharacterReferenceConfig, LocationReferenceCatalog } from '~/types'
import { buildCharacterCatalogIndex } from '~/cli/commands/visuals/comic/comic-utils/character-catalog-index'
import { resolveLocationCatalogEntry } from '~/cli/commands/visuals/comic/comic-utils/location-reference'
import { mergeTreatmentCharacterCatalog, mergeTreatmentLocationCatalog } from '~/cli/commands/visuals/comic/comic-commands/draft-treatment/treatment-catalog-merge'
import { buildTreatmentFixtureDraft, makeTreatmentProjectRoot, tinyPng } from './comic-treatment-contract-fixtures'

const draft = buildTreatmentFixtureDraft()

const existingCharacters: CharacterReferenceConfig = {
  schemaVersion: 3,
  characters: [{
    key: 'ada',
    name: 'ADA',
    aliases: ['Ada', 'the ranger'],
    image: 'ada--outline-sheet.png',
    outlineSheet: 'ada--outline-sheet.png',
    description: 'Hand-edited description that must survive byte for byte.',
    generationReference: 'sentient-agenda--style-seed.png',
    generationInstructions: 'Existing style.',
    wardrobe: { colorTokens: ['cyan jumpsuit'], never: ['helmet'] },
  }],
  groupAliases: [{ alias: 'CREW', characterKeys: ['ada'] }],
}

const mergeCharacters = (existing: CharacterReferenceConfig, policy: 'skip-existing' | 'fail' = 'skip-existing', candidates = draft.characters) =>
  mergeTreatmentCharacterCatalog({ existing, candidates, styleSeed: 'lantern-ridge--style-seed.png', styleInstructions: draft.styleInstructions, policy })

describe('comic treatment catalog merge contracts', () => {
  test('character merge bootstraps image-less entries, drops ambiguous aliases, and stays idempotent', () => {
    const first = mergeCharacters(existingCharacters)
    expect(first.charactersAdded).toEqual(['ranger-ruth', 'milo'])
    expect(first.charactersSkipped).toEqual([])
    expect(first.next.characters[0]).toEqual(existingCharacters.characters[0])
    expect(first.next.groupAliases).toEqual(existingCharacters.groupAliases)
    const ruth = first.next.characters.find(character => character.key === 'ranger-ruth')
    expect(ruth).toMatchObject({
      name: 'RANGER RUTH',
      aliases: ['Ruth Alder', 'Ruth'],
      image: 'ranger-ruth--outline-sheet.png',
      outlineSheet: 'ranger-ruth--outline-sheet.png',
      generationReference: 'lantern-ridge--style-seed.png',
      generationInstructions: draft.styleInstructions,
      wardrobe: { colorTokens: ['green ranger jacket', 'brown boots'], never: ['helmet'] },
    })
    expect(first.next.characters.find(character => character.key === 'milo')?.wardrobe).toEqual({ colorTokens: ['blue hoodie'], never: [] })
    expect(first.droppedAliases).toEqual([
      { key: 'ranger-ruth', alias: 'the ranger', reason: 'collides with "ada"' },
      { key: 'milo', alias: 'the ranger', reason: 'collides with "ada"' },
    ])
    const second = mergeCharacters(first.next)
    expect(second.charactersAdded).toEqual([])
    expect(second.charactersSkipped).toEqual(['ranger-ruth', 'milo'])
    expect(JSON.stringify(second.next)).toBe(JSON.stringify(first.next))
  })

  test('an alias shared by two new characters is dropped from both and reported', () => {
    const merged = mergeCharacters({ schemaVersion: 3, characters: [], groupAliases: [] })
    expect(merged.next.characters.map(character => character.aliases)).toEqual([['Ruth Alder', 'Ruth'], ['Milo Alder']])
    expect(merged.droppedAliases.map(item => `${item.key}:${item.alias}`)).toEqual(['ranger-ruth:the ranger', 'milo:the ranger'])
  })

  test('the fail policy aborts on existing keys and alias collisions without writing', () => {
    expect(() => mergeCharacters(existingCharacters, 'fail')).toThrow('alias "the ranger" collides with "ada"')
    const ada = buildTreatmentFixtureDraft().characters[0]!
    expect(() => mergeCharacters(existingCharacters, 'fail', [{ ...ada, key: 'ada', aliases: [] }])).toThrow('Character "ada" already exists')
    expect(() => mergeCharacters(existingCharacters, 'skip-existing', [{ ...ada, key: 'ruth', name: 'ADA', aliases: [] }])).toThrow('label "ADA" collides with "ada"')
  })

  test('location merge stores the canonical slugline as the first alias, prefixes the style, and sorts by key', async () => {
    const project = await makeTreatmentProjectRoot()
    const created = mergeTreatmentLocationCatalog({
      existing: undefined,
      candidates: draft.locations,
      scriptPath: 'input/scripts/02-script/01-lantern-ridge.md',
      styleInstructions: draft.styleInstructions,
      styleSeed: 'lantern-ridge--style-seed.png',
      locationsRoot: project.locationsRoot,
      policy: 'skip-existing',
    })
    expect(created.styleImage).toEqual({ action: 'created', value: '../characters/lantern-ridge--style-seed.png' })
    expect(created.next.styleImage).toBe('../characters/lantern-ridge--style-seed.png')
    expect(created.locationsAdded).toEqual(['ridge-firepit', 'old-silver-mine'])
    expect(created.next.locations.map(location => location.key)).toEqual(['old-silver-mine', 'ridge-firepit'])
    const firepit = created.next.locations.find(location => location.key === 'ridge-firepit')!
    expect(firepit.aliases).toEqual(['EXT. RIDGE FIREPIT - NIGHT', 'the firepit'])
    expect(firepit.specification.startsWith(draft.styleInstructions)).toBe(true)
    expect(firepit.sourceScripts).toEqual(['input/scripts/02-script/01-lantern-ridge.md'])
    expect(resolveLocationCatalogEntry('EXT. RIDGE FIREPIT - NIGHT', created.next).key).toBe('ridge-firepit')
    expect(resolveLocationCatalogEntry('EXT. OLD SILVER MINE - DAY', created.next).key).toBe('old-silver-mine')

    const missingStyle: LocationReferenceCatalog = { schemaVersion: 1, styleImage: '../characters/missing--style-seed.png', locations: [created.next.locations[0]!] }
    const set = mergeTreatmentLocationCatalog({ existing: missingStyle, candidates: draft.locations, scriptPath: 'x.md', styleInstructions: 's', styleSeed: 'lantern-ridge--style-seed.png', locationsRoot: project.locationsRoot, policy: 'skip-existing' })
    expect(set.styleImage.action).toBe('set')
    expect(set.locationsSkipped).toEqual(['old-silver-mine'])
    expect(set.locationsAdded).toEqual(['ridge-firepit'])
    expect(set.next.locations[0]).toEqual(created.next.locations[0])

    const kept: LocationReferenceCatalog = { schemaVersion: 1, styleImage: '../characters/lantern-ridge--style-seed.png', locations: [] }
    expect(mergeTreatmentLocationCatalog({ existing: kept, candidates: [], scriptPath: 'x.md', styleInstructions: 's', styleSeed: 'other.png', locationsRoot: project.locationsRoot, policy: 'skip-existing' }).styleImage).toEqual({ action: 'kept', value: '../characters/lantern-ridge--style-seed.png' })
    expect(() => mergeTreatmentLocationCatalog({ existing: missingStyle, candidates: draft.locations, scriptPath: 'x.md', styleInstructions: 's', styleSeed: 'seed.png', locationsRoot: project.locationsRoot, policy: 'fail' })).toThrow('Location "old-silver-mine" already exists')
  })

  test('the catalog index accepts image-less entries only when asset verification is disabled', async () => {
    const root = (await makeTreatmentProjectRoot({ styleSeed: false })).charactersRoot
    await mkdir(root, { recursive: true })
    const config = mergeCharacters({ schemaVersion: 3, characters: [], groupAliases: [] }).next
    const configPath = join(root, 'characters-reference.json')
    expect(() => buildCharacterCatalogIndex(root, configPath, config)).toThrow('generation reference for "ranger-ruth" was not found')
    const index = buildCharacterCatalogIndex(root, configPath, config, { verifyAssets: false })
    expect([...index.byKey.keys()]).toEqual(['ranger-ruth', 'milo'])
    expect(index.byLookup.get('RUTH ALDER')).toEqual(['ranger-ruth'])
    await writeFile(join(root, 'lantern-ridge--style-seed.png'), tinyPng)
    expect(() => buildCharacterCatalogIndex(root, configPath, config)).not.toThrow()
  })
})
