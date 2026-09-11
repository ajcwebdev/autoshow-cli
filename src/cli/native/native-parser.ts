import type { CliCommandDefinition, CliFlagsDefinition, CliParameterValues, CliParseResult } from '~/types'
import { getNativeBuiltinCommand } from './builtins'
import { buildRawParsed, parseCommandArgv } from './native-command-arguments'
import {
  NativeNoSuchCommandError
} from './native-errors'
import { buildInitialFlags, buildShortFlagMap, findNativeFlagValueEnd } from './native-flag-parser'
import { takeHelpTopic } from './help-topic-request'

const createCommandMap = (
  commands: readonly CliCommandDefinition[]
): Map<string, CliCommandDefinition> =>
  new Map(commands.map((command) => [command.name, command]))

const getSubcommandName = (
  parent: CliCommandDefinition,
  subcommand: CliCommandDefinition
): string => {
  const prefix = `${parent.name} `
  return subcommand.name.startsWith(prefix)
    ? subcommand.name.slice(prefix.length)
    : subcommand.name
}

const createSubcommandMap = (
  command: CliCommandDefinition
): Map<string, CliCommandDefinition> =>
  new Map((command.subcommands ?? []).map((subcommand) => [
    getSubcommandName(command, subcommand),
    subcommand
  ]))

const findCommand = (
  commands: Map<string, CliCommandDefinition>,
  name: string
): CliCommandDefinition | undefined =>
  commands.get(name) ?? getNativeBuiltinCommand(name)

const isHelpFlag = (arg: string | undefined): boolean =>
  arg === '--help' || arg === '-h'

const isVersionFlag = (arg: string | undefined): boolean =>
  arg === '--version' || arg === '-v'

const findSubcommandIndex = (
  argv: string[],
  command: CliCommandDefinition,
  globalFlags: CliFlagsDefinition
): number | undefined => {
  const definitions = { ...globalFlags, ...(command.flags ?? {}) }
  const shortFlags = buildShortFlagMap(definitions)

  for (let index = 1; index < argv.length; index++) {
    const arg = argv[index] as string
    if (arg === '--' || isHelpFlag(arg)) return undefined
    if (arg.startsWith('--') && arg.length > 2) {
      const rawName = arg.slice(2).split('=', 1)[0] as string
      const name = rawName.startsWith('no-') ? rawName.slice(3) : rawName
      const definition = definitions[name]
      if (!arg.includes('=')) index = findNativeFlagValueEnd(argv, index, definition)
      continue
    }
    if (arg.startsWith('-') && arg.length > 1) {
      const definition = definitions[shortFlags.get(arg.slice(1)) ?? '']
      index = findNativeFlagValueEnd(argv, index, definition)
      continue
    }
    return index
  }

  return undefined
}

const parseCommandTreeArgv = (
  argv: string[],
  command: CliCommandDefinition,
  globalFlags: CliFlagsDefinition
): CliParseResult => {
  if (!command.subcommands?.length) {
    return parseCommandArgv(argv, command, globalFlags)
  }

  const subcommandIndex = findSubcommandIndex(argv, command, globalFlags)
  if (subcommandIndex === undefined) {
    const parsed = parseCommandArgv(argv, command, globalFlags)
    if (parsed.mode === 'help' || parsed.mode === 'version') {
      return parsed
    }
    if (command.defaultSubcommand) {
      const defaultCommand = createSubcommandMap(command).get(command.defaultSubcommand)
      if (defaultCommand === undefined) {
        throw new NativeNoSuchCommandError(`${command.name} ${command.defaultSubcommand}`)
      }
      return parseCommandTreeArgv([defaultCommand.name, ...argv.slice(1)], defaultCommand, globalFlags)
    }
    return parsed.mode === 'command' && Object.keys(parsed.rawParsed.unknown).length === 0
      ? { ...parsed, mode: 'help' }
      : parsed
  }

  const subcommandName = argv[subcommandIndex] as string
  if (subcommandName === 'help') {
    const helpTarget = argv[subcommandIndex + 1]
    if (helpTarget === undefined || isHelpFlag(helpTarget)) {
      const parsed = parseCommandArgv(argv.slice(0, subcommandIndex), command, globalFlags)
      return { ...parsed, mode: 'help' }
    }
    const helpCommand = createSubcommandMap(command).get(helpTarget)
    if (helpCommand === undefined) {
      throw new NativeNoSuchCommandError(`${command.name} ${helpTarget}`)
    }
    return {
      mode: 'help',
      argv,
      calledAs: helpCommand.name,
      command: helpCommand,
      flags: buildInitialFlags(globalFlags),
      parameters: {} as CliParameterValues,
      rawParsed: buildRawParsed(argv, [], new Set(['help']), [], {})
    }
  }

  const subcommand = createSubcommandMap(command).get(subcommandName)
  if (subcommand === undefined) {
    throw new NativeNoSuchCommandError(`${command.name} ${subcommandName}`)
  }

  return parseCommandTreeArgv([
    subcommand.name,
    ...argv.slice(1, subcommandIndex),
    ...argv.slice(subcommandIndex + 1)
  ], subcommand, globalFlags)
}

const parseNativeArgv = (
  argv: string[],
  commands: readonly CliCommandDefinition[],
  globalFlags: CliFlagsDefinition
): CliParseResult => {
  const commandMap = createCommandMap(commands)

  if (argv.length === 0) {
    return {
      mode: 'help',
      argv,
      flags: buildInitialFlags(globalFlags),
      parameters: {} as CliParameterValues,
      rawParsed: buildRawParsed(argv, [], new Set(['help']), [], {})
    }
  }

  const first = argv[0] as string
  if (isHelpFlag(first)) {
    return {
      mode: 'help',
      argv,
      flags: buildInitialFlags(globalFlags),
      parameters: {} as CliParameterValues,
      rawParsed: buildRawParsed(argv, [], new Set(['help']), [], {})
    }
  }
  if (isVersionFlag(first)) {
    return {
      mode: 'version',
      argv,
      flags: buildInitialFlags(globalFlags),
      parameters: {} as CliParameterValues,
      rawParsed: buildRawParsed(argv, [], new Set(['version']), [], {})
    }
  }
  if (first === 'version') {
    if (argv.slice(1).some(isHelpFlag)) {
      const versionCommand = getNativeBuiltinCommand('version')!
      return {
        mode: 'help',
        argv,
        calledAs: 'version',
        command: versionCommand,
        flags: buildInitialFlags(globalFlags),
        parameters: {} as CliParameterValues,
        rawParsed: buildRawParsed(argv, [], new Set(['help']), [], {})
      }
    }
    return {
      mode: 'version',
      argv,
      calledAs: 'version',
      flags: buildInitialFlags(globalFlags),
      parameters: {} as CliParameterValues,
      rawParsed: buildRawParsed(argv, [], new Set(), [], {})
    }
  }
  if (first === 'help') {
    const commandName = argv[1]
    if (isVersionFlag(commandName)) {
      return {
        mode: 'version',
        argv,
        calledAs: 'help',
        flags: buildInitialFlags(globalFlags),
        parameters: {} as CliParameterValues,
        rawParsed: buildRawParsed(argv, [], new Set(['version']), [], {})
      }
    }
    const helpCommandName = isHelpFlag(commandName) ? 'help' : commandName
    const command = typeof helpCommandName === 'string' ? findCommand(commandMap, helpCommandName) : undefined
    if (typeof helpCommandName === 'string' && command === undefined) {
      throw new NativeNoSuchCommandError(helpCommandName)
    }
    if (command?.subcommands?.length && typeof argv[2] === 'string' && !argv[2]?.startsWith('-')) {
      const subcommand = createSubcommandMap(command).get(argv[2] as string)
      if (subcommand === undefined) {
        throw new NativeNoSuchCommandError(`${command.name} ${argv[2]}`)
      }
      return {
        mode: 'help',
        argv,
        calledAs: subcommand.name,
        command: subcommand,
        flags: buildInitialFlags(globalFlags),
        parameters: {} as CliParameterValues,
        rawParsed: buildRawParsed(argv, [], new Set(['help']), [], {})
      }
    }
    return {
      mode: 'help',
      argv,
      ...(command ? { calledAs: command.name, command } : {}),
      flags: buildInitialFlags(globalFlags),
      parameters: {} as CliParameterValues,
      rawParsed: buildRawParsed(argv, [], new Set(['help']), [], {})
    }
  }

  const command = commandMap.get(first)
  if (command === undefined) {
    throw new NativeNoSuchCommandError(first)
  }

  return parseCommandTreeArgv(argv, command, globalFlags)
}

export { parseCommandArgv, parseCommandInvocation } from './native-command-arguments'

export const parseNativeCli = (argv: string[], commands: readonly CliCommandDefinition[], globalFlags: CliFlagsDefinition): CliParseResult => {
  const request = takeHelpTopic(argv)
  const parsed = parseNativeArgv(request.argv, commands, globalFlags)
  if (request.topic !== undefined) parsed.flags['help-topic'] = request.topic
  return parsed
}
