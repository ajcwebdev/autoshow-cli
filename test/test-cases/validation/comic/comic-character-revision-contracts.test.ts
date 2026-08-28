import { afterEach,describe,expect,test } from 'bun:test'
import { rm,writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { configureOutputRoot } from '~/cli/commands/process-steps/output-root'
import { characterSketchCommand } from '~/cli/commands/process-steps/step-8-comic/comic-commands/character-sketch/character-sketch-command'
import { checksumFile,getCharacterSketchManifestPath,requireCurrentCharacterSketch } from '~/cli/commands/process-steps/step-8-comic/comic-commands/process-scenes/character-utils'
import { loadCharacterCatalog } from '~/cli/commands/process-steps/step-8-comic/comic-utils/character-reference-config'
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
