import { createHash } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import * as v from 'valibot'
import type { CharacterCatalogEntry, CharacterCatalogService, CharacterKey, CharacterReferenceConfig } from '~/types'
import { CharacterReferenceSchema } from '../schemas/schemas'
import { getCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { InfraError, ValidationError } from '~/utils/error-handler'

export const CHARACTER_REFERENCE_FILENAME = 'characters-reference.json'
export const CHARACTER_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SUPPORTED_SOURCE_EXTENSIONS = /\.(?:png|webp|jpe?g)$/i
const catalogContext = new AsyncLocalStorage<CharacterCatalogService>()

export const normalizeCharacterLookup = (value: string): string => value
  .normalize('NFKC')
  .trim()
  .replace(/\s*(?:\((?:V\.?O\.?|O\.?S\.?|CONT(?:'D|INUED)?|ON COMMS?)\)|V\.?O\.?|O\.?S\.?)\s*$/i, '')
  .replace(/[’']S\s*$/i, '')
  .replace(/\s+/g, ' ')
  .toLocaleUpperCase('en-US')

export const asCharacterKey = (value: string): CharacterKey => {
  if (!CHARACTER_KEY_PATTERN.test(value)) {
    throw ValidationError(
      `Invalid character key "${value}". Character keys must use lowercase kebab-case.`,
      { stage: 'comic:character-reference' }
    )
  }
  return value as CharacterKey
}

export const resolveCharacterReferenceConfigPath = (charactersRoot = getCharactersRoot()): string =>
  join(charactersRoot, CHARACTER_REFERENCE_FILENAME)

const fail = (configPath: string, detail: string): never => {
  throw ValidationError(
    `Invalid character catalog ${configPath}: ${detail}. Regenerate it using schemaVersion 3 before running comic commands.`,
    { stage: 'comic:character-reference' }
  )
}

const freezeEntry = (entry: CharacterCatalogEntry): CharacterCatalogEntry => Object.freeze({
  ...entry,
  aliases: Object.freeze([...entry.aliases]) as unknown as string[],
  ...(entry.sceneTextRules
    ? { sceneTextRules: Object.freeze(entry.sceneTextRules.map(rule => Object.freeze({ ...rule }))) as unknown as CharacterCatalogEntry['sceneTextRules'] }
    : {}),
})

export const loadCharacterCatalog = (charactersRoot = getCharactersRoot()): CharacterCatalogService => {
  const root = resolve(charactersRoot)
  const active = catalogContext.getStore()
  if (active?.root === root) return active
  const configPath = resolveCharacterReferenceConfigPath(root)
  if (!existsSync(configPath)) {
    throw InfraError(
      `Character catalog not found at ${configPath}. Create characters-reference.json with schemaVersion 3; the bundled legacy catalog is no longer used.`,
      { stage: 'comic:character-reference' }
    )
  }

  let config: CharacterReferenceConfig
  let raw: string
  try {
    raw = readFileSync(configPath, 'utf8')
    config = v.parse(CharacterReferenceSchema, JSON.parse(raw))
  } catch (error) {
    if (v.isValiError(error) || error instanceof SyntaxError) {
      fail(configPath, error.message)
    }
    throw error
  }

  const byKey = new Map<CharacterKey, CharacterCatalogEntry>()
  const byLookup = new Map<string, readonly CharacterKey[]>()
  const sourcePaths = new Set<string>()
  const outlineSheetPaths = new Set<string>()
  const assetPaths = new Set<string>()

  const resolveCatalogAsset = (key: CharacterKey, field: 'image' | 'outlineSheet', authoredPath: string): string => {
    if (isAbsolute(authoredPath)) fail(configPath, `character "${key}" ${field} must be relative`)
    if (!SUPPORTED_SOURCE_EXTENSIONS.test(authoredPath)) {
      fail(configPath, `character "${key}" ${field} must be PNG, WebP, JPG, or JPEG`)
    }
    const absolutePath = resolve(root, authoredPath)
    const relativePath = relative(root, absolutePath)
    if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
      fail(configPath, `character "${key}" ${field} escapes the characters root`)
    }
    return absolutePath
  }

  const addLookup = (label: string, keys: readonly CharacterKey[]): void => {
    const normalized = normalizeCharacterLookup(label)
    if (!normalized) fail(configPath, 'character aliases and names cannot be blank')
    const existing = byLookup.get(normalized)
    if (existing && existing.join('|') !== keys.join('|')) {
      fail(configPath, `ambiguous alias or display name "${label}"`)
    }
    byLookup.set(normalized, Object.freeze([...keys]))
  }

  for (const authored of config.characters) {
    const key = asCharacterKey(authored.key)
    if (byKey.has(key)) fail(configPath, `duplicate character key "${key}"`)
    if (!authored.name.trim()) fail(configPath, `character "${key}" has an empty display name`)
    if (!authored.description.trim()) fail(configPath, `character "${key}" has an empty description`)
    for (const [index, rule] of (authored.sceneTextRules ?? []).entries()) {
      if (!rule.pattern.trim() || !rule.description.trim()) fail(configPath, `character "${key}" sceneTextRules[${index}] must have a non-empty pattern and description`)
      try {
        new RegExp(rule.pattern, 'iu')
      } catch (error) {
        fail(configPath, `character "${key}" sceneTextRules[${index}] has an invalid regular expression: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    const sourcePath = resolveCatalogAsset(key, 'image', authored.image)
    const outlineSheetPath = resolveCatalogAsset(key, 'outlineSheet', authored.outlineSheet)
    const normalizedSourcePath = sourcePath.replace(/\\/g, '/')
    if (sourcePaths.has(normalizedSourcePath)) fail(configPath, `duplicate source image path "${authored.image}"`)
    const normalizedOutlineSheetPath = outlineSheetPath.replace(/\\/g, '/')
    if (outlineSheetPaths.has(normalizedOutlineSheetPath)) fail(configPath, `duplicate outline sheet path "${authored.outlineSheet}"`)
    // A character may intentionally use one canonical image for both fields.
    // Paths must still be exclusive to that character so references cannot be
    // silently shared or mislabeled across catalog entries.
    if (assetPaths.has(normalizedSourcePath) || assetPaths.has(normalizedOutlineSheetPath)) {
      fail(configPath, 'character asset paths must be unique across source images and outline sheets')
    }
    if (!existsSync(sourcePath) || !statSync(sourcePath).isFile()) {
      fail(configPath, `source image for "${key}" was not found at ${sourcePath}`)
    }
    sourcePaths.add(normalizedSourcePath)
    outlineSheetPaths.add(normalizedOutlineSheetPath)
    assetPaths.add(normalizedSourcePath)
    assetPaths.add(normalizedOutlineSheetPath)
    const entry = freezeEntry({ ...authored, key, sourcePath, outlineSheetPath })
    byKey.set(key, entry)
    addLookup(key, [key])
    addLookup(authored.name, [key])
    for (const alias of authored.aliases) addLookup(alias, [key])
  }

  for (const group of config.groupAliases) {
    if (group.characterKeys.length === 0) fail(configPath, `group alias "${group.alias}" has no targets`)
    const keys = group.characterKeys.map(rawKey => {
      const key = asCharacterKey(rawKey)
      if (!byKey.has(key)) fail(configPath, `group alias "${group.alias}" targets unknown key "${key}"`)
      return key
    })
    if (new Set(keys).size !== keys.length) fail(configPath, `group alias "${group.alias}" has duplicate targets`)
    addLookup(group.alias, keys)
  }

  const characters = Object.freeze(Array.from(byKey.values()))
  const characterKeys = Object.freeze(characters.map(character => character.key))
  const service: CharacterCatalogService = {
    schemaVersion: 3,
    root,
    configPath,
    hash: createHash('sha256').update(raw).digest('hex'),
    characters,
    characterKeys,
    get(key) {
      const character = byKey.get(key)
      if (!character) {
        throw ValidationError(
          `Unknown character key "${key}". Expected one of: ${characterKeys.join(', ')}`,
          { stage: 'comic:character-reference' }
        )
      }
      return character
    },
    resolve(value) {
      return byLookup.get(normalizeCharacterLookup(value))
    },
    requireKey(value) {
      if (!CHARACTER_KEY_PATTERN.test(value) || !byKey.has(value as CharacterKey)) {
        throw ValidationError(
          `Unknown character key "${value}". Use a catalog key, not a display name. Expected one of: ${characterKeys.join(', ')}`,
          { stage: 'comic:character-reference' }
        )
      }
      return value as CharacterKey
    },
    detectMentions(text) {
      const found: Array<{ index: number; end: number; keys: readonly CharacterKey[]; raw: string }> = []
      for (const [lookup, keys] of byLookup) {
        const escaped = lookup.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
        const regex = new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped})(?=$|[^\\p{L}\\p{N}])`, 'giu')
        let match = regex.exec(text)
        while (match) {
          const index = match.index + match[1]!.length
          found.push({ index, end: index + match[2]!.length, keys, raw: match[2]! })
          match = regex.exec(text)
        }
      }
      found.sort((left, right) => left.index - right.index || right.raw.length - left.raw.length)
      const occupied: Array<{ index: number; end: number }> = []
      const mentions: Array<{ raw: string; characterKeys: CharacterKey[] }> = []
      for (const match of found) {
        if (occupied.some(range => match.index < range.end && match.end > range.index)) continue
        occupied.push({ index: match.index, end: match.end })
        mentions.push({ raw: match.raw, characterKeys: [...match.keys] })
      }
      return mentions
    },
    detect(text) {
      const seen = new Set<CharacterKey>()
      return service.detectMentions(text).flatMap(mention => mention.characterKeys).filter(key => !seen.has(key) && Boolean(seen.add(key)))
    },
  }
  return Object.freeze(service)
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
