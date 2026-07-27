import { loadCharacterCatalog } from '../character-reference-config'

export const TRANSITION_PATTERNS = [
  /^CUT TO\b/i,
  /^CUT TO BLACK\b/i,
  /^FADE TO\b/i,
  /^FADE OUT\b/i,
  /^SMASH CUT TO\b/i,
  /^DISSOLVE TO\b/i,
  /^TITLE CARD\b/i,
  /^END\b/i,
]

export const getCharacterAliasGuidance = (): string =>
  loadCharacterCatalog().characters
    .flatMap(character => [character.name, ...character.aliases].map(alias => `${alias} -> ${character.key}`))
    .join(', ')
