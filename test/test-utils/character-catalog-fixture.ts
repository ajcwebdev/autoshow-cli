import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { makeTempDir } from './temp-dirs'

const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')

export const tinyPngFixture = (): Buffer => Buffer.from(TINY_PNG)

export type CharacterCatalogFixtureOptions = {
  overrides?: Record<string, unknown>
  registerRoot?: ((root: string) => void) | undefined
  prefix?: string | undefined
}

export const makeCatalog = async (
  overrides: Record<string, unknown> = {},
  options: Omit<CharacterCatalogFixtureOptions, 'overrides'> = {}
): Promise<string> => {
  const root = await makeTempDir(options.prefix ?? 'autoshow-character-catalog-')
  options.registerRoot?.(root)
  await writeFile(join(root, 'hero.webp'), TINY_PNG)
  await writeFile(join(root, 'sidekick.png'), TINY_PNG)
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
