import { afterEach,describe,expect,test } from 'bun:test'
import { rm,writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import * as v from 'valibot'
import { configureCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { configureOutputRoot } from '~/cli/commands/process-steps/output-root'
import { loadCharacterCatalog } from '~/cli/commands/process-steps/step-8-comic/comic-utils/character-reference-config'
import { createCharacterReferenceSnapshot } from '~/cli/commands/process-steps/step-8-comic/comic-utils/character-reference-snapshot'
import { ScenePromptDataSchema,validateSceneCharacters } from '~/cli/commands/process-steps/step-8-comic/schemas/schemas'
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

  test('panel-prompt preflight aggregates every unregistered visible character', async () => {
    const charactersRoot = await makeTempDir('autoshow-missing-character-catalog-')
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
    const runDirectory = await makeTempDir('autoshow-missing-character-run-')
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
          { kind: 'forbidden', pattern: '\\bmonitor\\b.{0,40}\\b(?:shows?|contains?)\\b.{0,40}\\bhero\\b', description: 'A monitor must not show Hero.' },
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
      scene('Hero is a hologram.', 'The hologram shines above a projector base. The planet is visible behind him, but no monitor shows Hero.'),
      catalog,
    )).not.toThrow()
    expect(() => validateSceneCharacters(
      scene('Hero is a hologram.', 'The hologram shines above a projector base; Hero is not displayed on or inside any monitor.'),
      catalog,
    )).not.toThrow()
    expect(() => validateSceneCharacters(
      scene('Hero is a hologram.', 'The hologram shines above a projector base. Hero must never appear on or inside any monitor.'),
      catalog,
    )).not.toThrow()
    expect(() => validateSceneCharacters(
      scene('A monitor shows telemetry. Hero is a free-standing hologram.', 'Hero shines above a projector base. The monitor remains physically separate.'),
      catalog,
    )).not.toThrow()
    expect(() => validateSceneCharacters(
      scene('Hero is a hologram.', 'Hero shines above a projector base. The monitor displays telemetry only, never Hero.'),
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

  test('scene validation accepts panels with more than five visible characters', async () => {
    const charactersRoot = await makeTempDir('autoshow-large-cast-catalog-')
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
})
