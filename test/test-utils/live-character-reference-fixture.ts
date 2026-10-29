import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CharacterReferenceConfig } from '~/types'
import { configureCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import { loadCharacterCatalog } from '~/cli/commands/visuals/comic/comic-utils/character-reference-config'
import { tinyPngFixture } from './character-catalog-fixture'

/** Canonical-only references for mocked comic generation; no scene asset snapshots. */
export const createLiveCharacterFixture = async (
  projectDirectory: string,
  characters: CharacterReferenceConfig['characters'] = [{ key: 'hero', name: 'Hero', aliases: ['HERO'], image: 'hero.png', outlineSheet: 'hero.png', description: 'Test hero' }],
) => {
  const charactersRoot = join(projectDirectory, 'input', 'characters')
  await mkdir(charactersRoot, { recursive: true })
  const bytes = tinyPngFixture()
  const sha256 = new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
  for (const character of characters) {
    for (const relativePath of new Set([character.image, character.outlineSheet])) {
      const path = join(charactersRoot, relativePath)
      await mkdir(join(path, '..'), { recursive: true })
      await writeFile(path, bytes)
    }
  }
  await writeFile(join(charactersRoot, 'characters-reference.json'), JSON.stringify({ schemaVersion: 3, characters, groupAliases: [] }))
  await writeFile(join(charactersRoot, 'character-sketches.json'), JSON.stringify({
    schemaVersion: 1,
    sketches: characters.map(character => ({ characterKey: character.key, generationId: `canonical-${character.key}`, origin: 'generated', sourceImage: character.image, outlineSheet: character.outlineSheet, sourceSha256: sha256, sheetSha256: sha256, model: 'gpt-image-2.5-sunburst', createdAt: '2026-10-26T00:00:00.000Z' })),
  }))
  configureCharactersRoot(charactersRoot)
  return { charactersRoot, catalog: loadCharacterCatalog(charactersRoot) }
}
