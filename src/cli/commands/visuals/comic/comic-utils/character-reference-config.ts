import { AsyncLocalStorage } from 'node:async_hooks'
import { join, resolve } from 'node:path'
import { getCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import type { CharacterCatalogService, CharacterKey } from '~/types'

import { buildCharacterCatalogIndex } from './character-catalog-index'
import { readCharacterCatalogConfig } from './character-catalog-reader'
import { createCharacterCatalogService } from './character-catalog-service'
export { normalizeCharacterLookup } from './character-catalog-validation'

const CHARACTER_REFERENCE_FILENAME = 'characters-reference.json'
const catalogContext = new AsyncLocalStorage<CharacterCatalogService>()

const resolveCharacterReferenceConfigPath = (charactersRoot = getCharactersRoot()): string =>
  join(charactersRoot, CHARACTER_REFERENCE_FILENAME)

export const loadCharacterCatalog = (charactersRoot = getCharactersRoot()): CharacterCatalogService => {
  const root = resolve(charactersRoot)
  const active = catalogContext.getStore()
  if (active?.root === root) return active
  const configPath = resolveCharacterReferenceConfigPath(root)
  const { config, raw } = readCharacterCatalogConfig(configPath)
  const index = buildCharacterCatalogIndex(root, configPath, config)
  return createCharacterCatalogService(root, configPath, raw, index)
}

export const withCharacterCatalog = async <T>(run: (catalog: CharacterCatalogService) => Promise<T>): Promise<T> => {
  const catalog = loadCharacterCatalog()
  return await catalogContext.run(catalog, () => run(catalog))
}

export const getCharacterKeys = (): CharacterKey[] => [...loadCharacterCatalog().characterKeys]
export const getCharacterReferenceAliases = (): Record<string, string> => {
  const catalog = loadCharacterCatalog()
  const aliases: Record<string, string> = {}
  for (const character of catalog.characters) {
    for (const alias of [character.name, ...character.aliases]) aliases[alias] = character.key
  }
  return aliases
}
