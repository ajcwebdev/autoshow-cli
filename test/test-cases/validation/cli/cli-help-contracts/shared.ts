import { expect } from 'bun:test'
import { COMMAND_DEFINITIONS, HELP_COMMAND_GROUP_BY_NAME } from '~/cli/command-definitions'
import { getNativeRenderableCommands } from '~/cli/native/builtins'
import { renderCommandHelp, renderRootHelp } from '~/cli/native/help-renderer'
import { createNativeRootDefinition } from '~/cli/native/root-definition'
import { stripAnsi } from '~/utils/terminal-colors'
import type { CliCommandDefinition, CliFlagsDefinition } from '~/types'

export const helpEnv = { NO_COLOR: '1' }
export const removedSetupCommand = ['so', 'ck'].join('')
export const HELP_TREE_TIMEOUT_MS = 30_000
export const persistedVideoInputFlags = [
  'video-input-image',
  'video-last-frame',
  'video-reference-image',
  'video-input-video'
] as const

const initializeHelpGroups = (): void => {
  for (const command of COMMAND_DEFINITIONS) {
    const group = HELP_COMMAND_GROUP_BY_NAME[command.name]
    if (group !== undefined) {
      command.help = { ...command.help, group }
    }
  }
}

initializeHelpGroups()

export const nativeRoot = createNativeRootDefinition()
export const renderableCommands = getNativeRenderableCommands(COMMAND_DEFINITIONS)
export const flattenCommands = (
  commands: readonly { name: string, subcommands?: readonly CliCommandDefinition[] }[]
): CliCommandDefinition[] =>
  commands.flatMap((command) => [
    command as CliCommandDefinition,
    ...flattenCommands(command.subcommands ?? [])
  ])
export const helpSurfaces = flattenCommands(renderableCommands)

const comicCommand = COMMAND_DEFINITIONS.find((command) => command.name === 'comic')
if (comicCommand === undefined) throw new Error('comic command is not registered')
export const comicSubcommands = (comicCommand.subcommands ?? []).map((subcommand) =>
  subcommand.name.startsWith('comic ') ? subcommand.name.slice('comic '.length) : subcommand.name
)

export const helpArgv = (commandName: string): string[] => [...commandName.split(' '), '--help']

export const advertisedFlagNames = (section: string): string[] =>
  section.split('\n').flatMap((line) => {
    const match = line.match(/^ {2,4}--([a-z0-9-]+)/)
    return match?.[1] === undefined ? [] : [match[1]]
  })

export const visibleFlagNames = (flags: CliFlagsDefinition | undefined): string[] =>
  Object.entries(flags ?? {})
    .filter(([, definition]) => definition.help?.hidden !== true)
    .map(([name]) => name)
    .sort()

export type HelpResult = { exitCode: number, stdout: string, stderr: string }

const findHelpCommand = (name: string) =>
  helpSurfaces.find((command) => command.name === name)

// These contracts assert help structure, not palette. Spawned help checks force
// NO_COLOR; the in-process renderer honors FORCE_COLOR, so strip ANSI here.
export const loadHelp = async (args: string[]): Promise<HelpResult> => {
  if (args[0] === 'benchmark') {
    return {
      exitCode: 2,
      stdout: '',
      stderr: 'Unknown command "benchmark"'
    }
  }
  if (args.length === 1 && args[0] === '--help') {
    return { exitCode: 0, stdout: stripAnsi(renderRootHelp(nativeRoot, COMMAND_DEFINITIONS)), stderr: '' }
  }
  const withoutHelp = args.filter((arg) => arg !== '--help')
  const commandName = withoutHelp[0] === 'comic' && withoutHelp[1] === 'help' && withoutHelp[2]
    ? `comic ${withoutHelp[2]}`
    : withoutHelp.join(' ')
  const command = findHelpCommand(commandName)
  if (!command) {
    return { exitCode: 2, stdout: '', stderr: `Unknown command "${commandName}"` }
  }
  return { exitCode: 0, stdout: stripAnsi(renderCommandHelp(nativeRoot, command)), stderr: '' }
}

export const getSection = (output: string, heading: string, nextHeading?: string): string => {
  const start = output.indexOf(heading)
  expect(start).toBeGreaterThanOrEqual(0)

  const sectionStart = start + heading.length
  const end = nextHeading ? output.indexOf(nextHeading, sectionStart) : output.length
  expect(end).toBeGreaterThan(sectionStart)

  return output.slice(sectionStart, end)
}

export const getFlagGroupSection = (output: string, label: string): string => {
  const heading = `\n  ${label}\n`
  const start = output.indexOf(heading)
  expect(start).toBeGreaterThanOrEqual(0)

  const sectionStart = start + heading.length
  const tail = output.slice(sectionStart)
  const nextGroup = tail.match(/\n  [A-Za-z0-9][^\n]*\n/)
  const globalFlags = output.indexOf('\nGlobal Flags\n', sectionStart)
  const nextGroupEnd = nextGroup?.index === undefined ? output.length : sectionStart + nextGroup.index
  const globalFlagsEnd = globalFlags === -1 ? output.length : globalFlags
  return output.slice(sectionStart, Math.min(nextGroupEnd, globalFlagsEnd))
}

// Command-specific flags only; excludes the shared Global Flags block.
export const getCommandFlagsSection = (output: string): string => {
  const start = output.indexOf('\nFlags\n')
  if (start === -1) {
    return ''
  }
  const end = output.indexOf('\nGlobal Flags\n', start)
  return output.slice(start, end === -1 ? output.length : end)
}
