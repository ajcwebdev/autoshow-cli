import { isAbsolute, join, resolve } from 'node:path'

const DEFAULT_CHARACTERS_ROOT = 'input/characters'

let charactersRoot = DEFAULT_CHARACTERS_ROOT

export const configureCharactersRoot = (dir: string): void => {
  const trimmed = dir.trim()
  if (trimmed.length > 0) {
    charactersRoot = trimmed
  }
}

export const getCharactersRoot = (): string => charactersRoot

export const getCharactersRootAbsolute = (projectRoot = process.cwd()): string => {
  const charactersRoot = getCharactersRoot()
  return isAbsolute(charactersRoot) ? charactersRoot : resolve(projectRoot, charactersRoot)
}

export const joinCharactersRoot = (...segments: string[]): string =>
  join(getCharactersRoot(), ...segments)
