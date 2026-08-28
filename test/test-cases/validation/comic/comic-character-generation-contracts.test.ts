import { afterEach,describe,expect,test } from 'bun:test'
import { rm,writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { configureOutputRoot } from '~/cli/commands/process-steps/output-root'
import { characterSketchCommand } from '~/cli/commands/process-steps/step-8-comic/comic-commands/character-sketch/character-sketch-command'
import { checksumFile,getCharacterSketchManifestPath,requireCurrentCharacterSketch } from '~/cli/commands/process-steps/step-8-comic/comic-commands/process-scenes/character-utils'
import { loadCharacterCatalog } from '~/cli/commands/process-steps/step-8-comic/comic-utils/character-reference-config'
import {
coerceAndValidateReferenceSketch
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/cli-args'
import { referenceSketchCommandDefinition } from '~/cli/commands/process-steps/step-8-comic/comic-utils/subcommand-help'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import { makeTempDir } from '../../../test-utils/temp-dirs'

const parseReferenceSketchArgs = (args: string[]) =>
  coerceAndValidateReferenceSketch(parseCommandInvocation([referenceSketchCommandDefinition.name, ...args], referenceSketchCommandDefinition, GLOBAL_FLAG_DEFINITIONS))

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

  test('reference-sketch character parsing rejects --image and enforces one model', () => {
    expect(() => parseReferenceSketchArgs(['--character', 'hero', '--image', 'hero.webp'])).toThrow(/Unexpected flag: --image/)
    expect(() => parseReferenceSketchArgs(['--character', 'hero', '--image-model', 'gpt-image-2,grok-imagine-image-quality'])).toThrow(/exactly one/)
    expect(() => parseReferenceSketchArgs(['--character', 'hero', '--force'])).toThrow(/Unexpected flag: --force|Unknown argument/)
    expect(parseReferenceSketchArgs(['--character', 'hero', '--revise', '--notes', 'Fix eyes']).character).toBe('hero')
  })

  test('mocked generation uses temporary views, replaces by default, and preserves the registered sheet on failure', async () => {
    const charactersRoot = await makeCatalog()
    configureCharactersRoot(charactersRoot)
    const requestedReferences: string[][] = []
    const writeImage = async (path: string) => { await writeFile(path, 'generated-view') }
    const composeSheet = async (selection: { outputPath: string }) => {
      await writeFile(selection.outputPath, 'composed-sheet')
      return { width: 3, height: 1 }
    }
    await characterSketchCommand({ character: 'hero', imageModels: ['gpt-image-2'], concurrency: 1 }, {
      createGenerationId: () => 'successful-generation',
      requestImage: async (_prompt, references) => { requestedReferences.push(references); return { mode: 'edit', result: { imageBase64: 'ignored' } } },
      writeImage,
      composeSheet,
    })
    const manifestPath = getCharacterSketchManifestPath(charactersRoot)
    expect(JSON.parse(await Bun.file(manifestPath).text()).sketches[0].generationId).toBe('successful-generation')
    expect(requestedReferences.every(references => references.length === 1 && references[0]?.endsWith('/hero.webp'))).toBe(true)
    expect(await Bun.file(join(charactersRoot, 'hero--outline-sheet.png')).text()).toBe('composed-sheet')
    expect((await Array.fromAsync(new Bun.Glob('front.png').scan({ cwd: charactersRoot })))).toEqual([])

    let calls = 0
    await expect(characterSketchCommand({ character: 'hero', imageModels: ['gpt-image-2'], concurrency: 1 }, {
      createGenerationId: () => 'failed-generation',
      requestImage: async () => {
        calls++
        if (calls === 2) throw new Error('mock provider failure')
        return { mode: 'edit', result: { imageBase64: 'ignored' } }
      },
      writeImage,
      composeSheet,
    })).rejects.toThrow(/registered outline sheet was not changed/)
    expect(JSON.parse(await Bun.file(manifestPath).text()).sketches[0].generationId).toBe('successful-generation')
    expect(await Bun.file(join(charactersRoot, 'hero--outline-sheet.png')).text()).toBe('composed-sheet')
  })

  test('single-image character generation replaces and registers the one canonical reference atomically', async () => {
    const charactersRoot = await makeCatalog({
      characters: [
        { key: 'hero', name: 'Captain Hero', aliases: ['HERO'], image: 'hero.webp', outlineSheet: 'hero.webp', description: 'Hero reference.' },
      ],
      groupAliases: [],
    })
    configureCharactersRoot(charactersRoot)
    const referenceCalls: string[][] = []
    await characterSketchCommand({ character: 'hero', imageModels: ['gpt-image-2'], concurrency: 1 }, {
      createGenerationId: () => 'single-image-generation',
      requestImage: async (_prompt, references) => {
        referenceCalls.push(references)
        return { mode: 'edit', result: { imageBase64: 'ignored' } }
      },
      writeImage: async path => { await writeFile(path, 'view') },
      composeSheet: async selection => { await writeFile(selection.outputPath, 'new-canonical-reference'); return { width: 3, height: 1 } },
    })
    const canonicalPath = join(charactersRoot, 'hero.webp')
    expect(referenceCalls).toHaveLength(3)
    expect(referenceCalls.every(references => references.length === 1 && references[0] === canonicalPath)).toBe(true)
    expect(await Bun.file(canonicalPath).text()).toBe('new-canonical-reference')
    const registration = JSON.parse(await Bun.file(getCharacterSketchManifestPath(charactersRoot)).text()).sketches[0]
    const canonicalSha256 = await checksumFile(canonicalPath)
    expect(registration).toMatchObject({
      generationId: 'single-image-generation',
      sourceImage: 'hero.webp',
      outlineSheet: 'hero.webp',
      sourceSha256: canonicalSha256,
      sheetSha256: canonicalSha256,
    })
    await expect(requireCurrentCharacterSketch(loadCharacterCatalog(charactersRoot).requireKey('hero'))).resolves.toBeTruthy()
  })

  test('bootstrap generation uses the style reference without copying its subject contract', async () => {
    const charactersRoot = await makeCatalog({
      characters: [
        {
          key: 'new-alien', name: 'New Alien', aliases: ['NEW ALIEN'], image: 'new-alien.png', outlineSheet: 'new-alien.png',
          generationReference: 'hero.webp', generationInstructions: 'Render full-color cel-shaded character art.', description: 'A new four-armed alien.',
        },
      ],
      groupAliases: [],
    })
    configureCharactersRoot(charactersRoot)
    const prompts: string[] = []
    const references: string[][] = []
    await characterSketchCommand({ character: 'new-alien', imageModels: ['gpt-image-2'], concurrency: 1 }, {
      createGenerationId: () => 'bootstrap-generation',
      requestImage: async (prompt, refs) => {
        prompts.push(prompt)
        references.push(refs)
        return { mode: 'edit', result: { imageBase64: 'ignored' } }
      },
      writeImage: async path => { await writeFile(path, 'view') },
      composeSheet: async selection => { await writeFile(selection.outputPath, 'new-canonical-reference'); return { width: 3, height: 1 } },
    })
    const canonicalPath = join(charactersRoot, 'new-alien.png')
    expect(references.every(items => items.length === 1 && items[0] === join(charactersRoot, 'hero.webp'))).toBe(true)
    expect(prompts.every(prompt => prompt.includes('visual-style reference') && prompt.includes('full-color cel-shaded') && !prompt.includes('black-and-white outline art only'))).toBe(true)
    expect(await Bun.file(canonicalPath).text()).toBe('new-canonical-reference')
    const registration = JSON.parse(await Bun.file(getCharacterSketchManifestPath(charactersRoot)).text()).sketches[0]
    expect(registration.sourceSha256).toBe(await checksumFile(canonicalPath))
  })
})
