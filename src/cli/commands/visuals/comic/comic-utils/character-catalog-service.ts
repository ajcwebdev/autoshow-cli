import type { CharacterCatalogService, CharacterKey } from '~/types'
import { ValidationError } from '~/utils/error-handler'

import type { buildCharacterCatalogIndex } from './character-catalog-index'
import { CHARACTER_KEY_PATTERN, normalizeCharacterLookup } from './character-catalog-validation'

export const createCharacterCatalogService = (root: string, configPath: string, raw: string, { byKey, byLookup }: ReturnType<typeof buildCharacterCatalogIndex>): CharacterCatalogService => {
  const characters = Object.freeze(Array.from(byKey.values()))
  const characterKeys = Object.freeze(characters.map(character => character.key))
  const service: CharacterCatalogService = {
    schemaVersion: 3,
    root,
    configPath,
    hash: new Bun.CryptoHasher('sha256').update(raw).digest('hex'),
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
