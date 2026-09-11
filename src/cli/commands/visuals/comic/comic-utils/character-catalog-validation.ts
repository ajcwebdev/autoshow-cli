import type { CharacterCatalogEntry, CharacterKey } from '~/types'
import { ValidationError } from '~/utils/error-handler'

export const CHARACTER_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
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

export const fail = (configPath: string, detail: string): never => {
  throw ValidationError(
    `Invalid character catalog ${configPath}: ${detail}. Regenerate it using schemaVersion 3 before running comic commands.`,
    { stage: 'comic:character-reference' }
  )
}

export const freezeEntry = (entry: CharacterCatalogEntry): CharacterCatalogEntry => Object.freeze({
  ...entry,
  aliases: Object.freeze([...entry.aliases]) as unknown as string[],
  ...(entry.sceneTextRules
    ? { sceneTextRules: Object.freeze(entry.sceneTextRules.map(rule => Object.freeze({ ...rule }))) as unknown as CharacterCatalogEntry['sceneTextRules'] }
    : {}),
})
