import type { CliFlagsDefinition } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { commandCreatesRunDirectory } from './run-directory-support'

const CHARACTERS_ROOT_COMMANDS = new Set(['voice', 'comic'])
const COOKIE_FLAGS = new Set(['cookies', 'cookies-from-browser'])

const ALLOW_OVER_BUDGET_COMMANDS = new Set([
  'metadata',
  'download',
  'extract',
  'write',
  'resume',
  'tts',
  'image',
  'video',
  'music',
  'comic draft-scenes',
  'comic generate-images',
  'comic generate-audio',
  'comic generate-slideshow',
  'comic reference-sketch'
])

const commandNameOrFamilyIs = (commandName: string, allowed: ReadonlySet<string>): boolean =>
  allowed.has(commandName) || allowed.has(commandName.split(' ')[0]!)

export const cookieFlagNameFromSpelling = (spelling: string): string | undefined => {
  const name = spelling.startsWith('--') ? spelling.slice(2) : spelling
  return COOKIE_FLAGS.has(name) ? name : undefined
}

export const commandAcceptsGlobalFlag = (commandName: string, flagName: string): boolean => {
  if (flagName === 'output-dir') return commandCreatesRunDirectory(commandName)
  if (flagName === 'characters-root') return commandNameOrFamilyIs(commandName, CHARACTERS_ROOT_COMMANDS)
  if (flagName === 'allow-over-budget') return ALLOW_OVER_BUDGET_COMMANDS.has(commandName)
  return true
}

export const globalFlagsForCommand = (flags: CliFlagsDefinition, commandName: string): CliFlagsDefinition =>
  Object.fromEntries(
    Object.entries(flags).filter(([name]) => commandAcceptsGlobalFlag(commandName, name))
  ) as CliFlagsDefinition

export const unsupportedGlobalFlagError = (commandName: string, flagName: string): Error => {
  if (flagName === 'output-dir') {
    return UsageError(
      `--output-dir is not supported by "${commandName}" because it does not create a run directory.`,
      { hints: ['Use --output-root to change the base output directory.'] }
    )
  }
  if (flagName === 'characters-root') {
    return UsageError(
      `--characters-root is not supported by "${commandName}".`,
      { hints: ['Use bun autoshow voice or bun autoshow comic.'] }
    )
  }
  if (flagName === 'allow-over-budget') {
    return UsageError(
      `--allow-over-budget is not supported by "${commandName}".`,
      { hints: ['Use --allow-over-budget with pipeline and generation commands that check costs.'] }
    )
  }
  return UsageError(`--${flagName} is not supported by "${commandName}".`)
}

export const unsupportedCookieFlagError = (commandName: string, flagName: string): Error =>
  UsageError(
    `--${flagName} is not supported by "${commandName}".`,
    { hints: ['Use bun autoshow config --cookies <file> or bun autoshow config --cookies-from-browser <browser>.'] }
  )
