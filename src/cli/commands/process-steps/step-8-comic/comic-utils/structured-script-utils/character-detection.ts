import type { CharacterKey, CharacterMention } from '~/types'
import { loadCharacterCatalog, normalizeCharacterLookup } from '../character-reference-config'

export const uniqueCharacters = <T extends string>(characterKeys: T[]): T[] => {
  const seen = new Set<T>()
  return characterKeys.filter(key => !seen.has(key) && Boolean(seen.add(key)))
}

export const getCharactersFromMentions = (mentions: CharacterMention[]): CharacterKey[] =>
  uniqueCharacters(mentions.flatMap(mention => [...mention.characterKeys]))

const normalizeSpeakerLabelForMatching = normalizeCharacterLookup

export const detectSpeakerLabelCharacters = (label: string): CharacterKey[] => {
  const catalog = loadCharacterCatalog()
  const direct = catalog.resolve(label)
  if (direct) return [...direct]
  const parts = normalizeSpeakerLabelForMatching(label).split(/\s*(?:,|&|\bAND\b)\s*/i).filter(Boolean)
  if (parts.length < 2) return []
  const keys: CharacterKey[] = []
  for (const part of parts) {
    const resolved = catalog.resolve(part)
    if (!resolved) return []
    keys.push(...resolved)
  }
  return uniqueCharacters(keys)
}

export const isUncataloguedSpokenSpeakerLabel = (label: string): boolean =>
  /^(?:RADIO|INTERCOM|COMPUTER|ANNOUNCER|NARRATOR|VOICE|P\.?A\.?)$/i.test(normalizeCharacterLookup(label))
