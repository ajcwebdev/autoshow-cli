const DEFAULT_CHARACTERS_ROOT = 'input/characters'

let charactersRoot = DEFAULT_CHARACTERS_ROOT

export const configureCharactersRoot = (dir: string): void => {
  const trimmed = dir.trim()
  if (trimmed.length > 0) {
    charactersRoot = trimmed
  }
}

export const getCharactersRoot = (): string => charactersRoot
