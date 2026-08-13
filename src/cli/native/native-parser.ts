import type { CliCommandDefinition, CliFlagDefinition, CliFlagOccurrence, CliFlagsDefinition, CliFlagValues, CliParameterDefinition, CliParameterValues, CliParseResult, CliRawParsed } from '~/types'
import { getNativeBuiltinCommand } from './builtins'
import {
NativeInvalidParametersError,
NativeMissingFlagValueError,
NativeNoSuchCommandError,
NativeUnknownFlagError
} from './native-errors'
import { getUnknownFlagSpellings } from './unknown-flag-spellings'

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

const camelize = (value: string): string =>
  value.replace(/-([a-zA-Z0-9])/g, (_match, char: string) => char.toUpperCase())

const parameterName = (parameter: CliParameterDefinition): string =>
  parameter.key.replace(/^[<[{]/, '').replace(/[>\]}]$/, '').replace(/\.\.\.$/, '')

const parameterRequired = (parameter: CliParameterDefinition): boolean =>
  parameter.key.startsWith('<')

const parameterVariadic = (parameter: CliParameterDefinition): boolean =>
  parameter.key.includes('...')

const isHelpFlag = (arg: string | undefined): boolean =>
  arg === '--help' || arg === '-h'

const isVersionFlag = (arg: string | undefined): boolean =>
  arg === '--version' || arg === '-v' || arg === '-V'

const isRepeatableStringFlag = (definition: CliFlagDefinition): boolean =>
  Array.isArray(definition.type)

const isBooleanFlag = (definition: CliFlagDefinition): boolean =>
  definition.type === Boolean

const isNegatableBooleanFlag = (definition: CliFlagDefinition | undefined): definition is CliFlagDefinition =>
  definition !== undefined && isBooleanFlag(definition) && definition.negatable === true

const cloneDefaultValue = (value: unknown): unknown =>
  Array.isArray(value) ? [...value] : value

const buildShortFlagMap = (flags: CliFlagsDefinition): Map<string, string> => {
  const aliases = new Map<string, string>()
  for (const [name, definition] of Object.entries(flags)) {
    if (definition.short) {
      aliases.set(definition.short, name)
    }
  }
  return aliases
}

const coerceBooleanValue = (rawValue: string | true): boolean => {
  if (rawValue === true) {
    return true
  }
  const normalized = rawValue.trim().toLowerCase()
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false
  }
  return true
}

const occurrenceValue = (
  definition: CliFlagDefinition | undefined,
  value: string | boolean
): string | boolean =>
  definition && isBooleanFlag(definition) && typeof value === 'string'
    ? coerceBooleanValue(value)
    : value

const recordFlagOccurrence = (
  flagOccurrences: CliFlagOccurrence[],
  name: string,
  raw: string,
  value: string | boolean,
  definition?: CliFlagDefinition
): void => {
  flagOccurrences.push({
    name,
    raw,
    value: occurrenceValue(definition, value),
    known: definition !== undefined
  })
}

const setFlagValue = (
  flags: CliFlagValues,
  name: string,
  definition: CliFlagDefinition,
  value: string | true
): void => {
  if (isBooleanFlag(definition)) {
    flags[name] = coerceBooleanValue(value)
    return
  }

  if (isRepeatableStringFlag(definition)) {
    const current = flags[name]
    const values = Array.isArray(current) ? [...current] : current === undefined ? [] : [current]
    values.push(value)
    flags[name] = values
    return
  }

  if (value === true) {
    throw new NativeMissingFlagValueError(name)
  }
  flags[name] = value
}

const getNextFlagValue = (
  argv: string[],
  index: number,
  name: string,
  definition: CliFlagDefinition
): { value: string | true, consumedNext: boolean } => {
  if (isBooleanFlag(definition) || isRepeatableStringFlag(definition)) {
    const next = argv[index + 1]
    if (isRepeatableStringFlag(definition) && typeof next === 'string' && next !== '--' && !next.startsWith('-')) {
      return { value: next, consumedNext: true }
    }
    return { value: true, consumedNext: false }
  }

  const next = argv[index + 1]
  if (typeof next !== 'string' || next === '--' || next.startsWith('-')) {
    throw new NativeMissingFlagValueError(name)
  }
  return { value: next, consumedNext: true }
}

const getAdjacentFlagValues = (
  argv: string[],
  index: number,
  definition: CliFlagDefinition
): string[] => {
  if (!isRepeatableStringFlag(definition) || definition.consumeAdjacentValues !== true) {
    return []
  }

  const values: string[] = []
  for (let valueIndex = index + 1; valueIndex < argv.length; valueIndex++) {
    const value = argv[valueIndex]
    if (typeof value !== 'string' || value === '--' || value.startsWith('-')) {
      break
    }
    values.push(value)
  }
  return values
}

const parseLongFlag = (
  argv: string[],
  index: number,
  flags: CliFlagValues,
  explicitFlags: Set<string>,
  flagOccurrences: CliFlagOccurrence[],
  unknown: Record<string, unknown>,
  definitions: CliFlagsDefinition
): number => {
  const arg = argv[index] as string
  const raw = arg.slice(2)
  const eqIndex = raw.indexOf('=')
  const name = eqIndex === -1 ? raw : raw.slice(0, eqIndex)
  const inlineValue = eqIndex === -1 ? undefined : raw.slice(eqIndex + 1)
  const definition = definitions[name]

  if (definition === undefined) {
    if (name.startsWith('no-')) {
      const positiveName = name.slice(3)
      const positiveDefinition = definitions[positiveName]
      if (isNegatableBooleanFlag(positiveDefinition)) {
        explicitFlags.add(positiveName)
        flags[positiveName] = false
        recordFlagOccurrence(flagOccurrences, positiveName, arg, false, positiveDefinition)
        return index
      }
    }

    unknown[camelize(name)] = inlineValue ?? true
    recordFlagOccurrence(flagOccurrences, camelize(name), arg, inlineValue ?? true)
    return index
  }

  explicitFlags.add(name)
  if (inlineValue !== undefined) {
    const value = inlineValue.length > 0 ? inlineValue : true
    setFlagValue(flags, name, definition, value)
    recordFlagOccurrence(flagOccurrences, name, arg, value, definition)
    return index
  }

  const adjacentValues = getAdjacentFlagValues(argv, index, definition)
  if (adjacentValues.length > 0) {
    for (const value of adjacentValues) {
      setFlagValue(flags, name, definition, value)
    }
    recordFlagOccurrence(flagOccurrences, name, arg, adjacentValues[0] as string, definition)
    return index + adjacentValues.length
  }

  const { value, consumedNext } = getNextFlagValue(argv, index, name, definition)
  setFlagValue(flags, name, definition, value)
  recordFlagOccurrence(flagOccurrences, name, arg, value, definition)
  return consumedNext ? index + 1 : index
}

const parseShortFlag = (
  argv: string[],
  index: number,
  flags: CliFlagValues,
  explicitFlags: Set<string>,
  flagOccurrences: CliFlagOccurrence[],
  unknown: Record<string, unknown>,
  definitions: CliFlagsDefinition,
  shortFlags: Map<string, string>
): number => {
  const arg = argv[index] as string
  const short = arg.slice(1)
  const name = shortFlags.get(short)
  if (name === undefined) {
    unknown[short] = true
    recordFlagOccurrence(flagOccurrences, short, arg, true)
    return index
  }

  const definition = definitions[name]
  if (definition === undefined) {
    unknown[short] = true
    recordFlagOccurrence(flagOccurrences, short, arg, true)
    return index
  }

  explicitFlags.add(name)
  const adjacentValues = getAdjacentFlagValues(argv, index, definition)
  if (adjacentValues.length > 0) {
    for (const value of adjacentValues) {
      setFlagValue(flags, name, definition, value)
    }
    recordFlagOccurrence(flagOccurrences, name, arg, adjacentValues[0] as string, definition)
    return index + adjacentValues.length
  }
  const { value, consumedNext } = getNextFlagValue(argv, index, name, definition)
  setFlagValue(flags, name, definition, value)
  recordFlagOccurrence(flagOccurrences, name, arg, value, definition)
  return consumedNext ? index + 1 : index
}

const buildInitialFlags = (definitions: CliFlagsDefinition): CliFlagValues => {
  const flags = {} as CliFlagValues
  for (const [name, definition] of Object.entries(definitions)) {
    if ('default' in definition) {
      flags[name] = cloneDefaultValue(definition.default)
    }
  }
  return flags
}

const assignParameters = (
  command: CliCommandDefinition,
  positional: Array<{ value: string, index: number }>,
  hasUnknownFlags: boolean
): CliParameterValues => {
  const parameters = {} as CliParameterValues
  const definitions = command.parameters ?? []
  let positionalIndex = 0

  for (let index = 0; index < definitions.length; index++) {
    const definition = definitions[index] as CliParameterDefinition
    const name = parameterName(definition)

    if (parameterVariadic(definition)) {
      const requiredAfter = definitions.slice(index + 1).filter((entry) =>
        parameterRequired(entry) && !parameterVariadic(entry)
      ).length
      const available = Math.max(0, positional.length - positionalIndex - requiredAfter)
      const values = positional.slice(positionalIndex, positionalIndex + available).map((entry) => entry.value)
      positionalIndex += values.length
      if (values.length > 0 || !parameterRequired(definition)) {
        parameters[name] = values
        continue
      }
      throw new NativeInvalidParametersError(`Missing required parameter: ${name}`)
    }

    const value = positional[positionalIndex]?.value
    if (value !== undefined) {
      parameters[name] = value
      positionalIndex++
      continue
    }
    if (parameterRequired(definition)) {
      throw new NativeInvalidParametersError(`Missing required parameter: ${name}`)
    }
  }

  if (!hasUnknownFlags && command.allowExcessParameters !== true && positionalIndex < positional.length) {
    throw new NativeInvalidParametersError(`Unexpected parameter "${positional[positionalIndex]?.value}"`)
  }

  return parameters
}

const buildRawParsed = (
  argv: string[],
  doubleDash: string[],
  explicitFlags: Set<string>,
  flagOccurrences: CliFlagOccurrence[],
  unknown: Record<string, unknown>,
  positionals: Array<{ value: string, index: number }> = []
): CliRawParsed => {
  let searchFrom = 1
  const flagOccurrenceIndices = flagOccurrences.map((occurrence) => {
    const index = argv.indexOf(occurrence.raw, searchFrom)
    searchFrom = index < 0 ? searchFrom : index + 1
    return index
  })
  return {
    doubleDash,
    explicitFlags,
    flagOccurrences,
    flagOccurrenceIndices,
    unknown,
    positionals
  }
}

export const parseCommandArgv = (
  argv: string[],
  command: CliCommandDefinition,
  globalFlags: CliFlagsDefinition
): CliParseResult => {
  const definitions = {
    ...globalFlags,
    ...(command.flags ?? {})
  }
  const shortFlags = buildShortFlagMap(definitions)
  const flags = buildInitialFlags(definitions)
  const explicitFlags = new Set<string>()
  const flagOccurrences: CliFlagOccurrence[] = []
  const unknown: Record<string, unknown> = {}
  const positional: Array<{ value: string, index: number }> = []
  let doubleDash: string[] = []

  for (let index = 1; index < argv.length; index++) {
    const arg = argv[index] as string
    if (arg === '--') {
      doubleDash = argv.slice(index + 1)
      break
    }
    if (
      (arg === '--help' || arg === '-h') &&
      !(command.passThroughHelpAfterFirstPositional === true && positional.length > 0)
    ) {
      explicitFlags.add('help')
      flags['help'] = true
      recordFlagOccurrence(flagOccurrences, 'help', arg, true, definitions['help'])
      return {
        mode: 'help',
        argv,
        calledAs: command.name,
        command,
        flags,
        parameters: {} as CliParameterValues,
        rawParsed: buildRawParsed(argv, doubleDash, explicitFlags, flagOccurrences, unknown, positional)
      }
    }
    if (arg === '--version' || arg === '-v' || arg === '-V') {
      explicitFlags.add('version')
      flags['version'] = true
      recordFlagOccurrence(flagOccurrences, 'version', arg, true, definitions['version'])
      return {
        mode: 'version',
        argv,
        calledAs: command.name,
        command,
        flags,
        parameters: {} as CliParameterValues,
        rawParsed: buildRawParsed(argv, doubleDash, explicitFlags, flagOccurrences, unknown, positional)
      }
    }
    if (arg.startsWith('--') && arg.length > 2) {
      index = parseLongFlag(argv, index, flags, explicitFlags, flagOccurrences, unknown, definitions)
      continue
    }
    if (arg.startsWith('-') && arg.length > 1) {
      index = parseShortFlag(argv, index, flags, explicitFlags, flagOccurrences, unknown, definitions, shortFlags)
      continue
    }
    positional.push({ value: arg, index })
  }

  const parameters = assignParameters(command, positional, Object.keys(unknown).length > 0)
  return {
    mode: 'command',
    argv,
    calledAs: command.name,
    command,
    flags,
    parameters,
    rawParsed: buildRawParsed(argv, doubleDash, explicitFlags, flagOccurrences, unknown, positional)
  }
}

export const parseCommandInvocation = (
  argv: string[],
  command: CliCommandDefinition,
  globalFlags: CliFlagsDefinition
): CliParseResult => {
  const commandIndex = argv.findIndex((argument) => argument === command.name)
  if (commandIndex < 0) {
    throw new NativeNoSuchCommandError(command.name)
  }
  const parsed = parseCommandArgv(argv.slice(commandIndex), command, globalFlags)
  const unknownFlagSpellings = getUnknownFlagSpellings(parsed.rawParsed)
  if (!command.allowUnknownFlags && unknownFlagSpellings.length > 0) {
    throw new NativeUnknownFlagError(unknownFlagSpellings)
  }
  return parsed
}

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
      if (definition && !isBooleanFlag(definition) && !arg.includes('=')) {
        index++
        if (definition.consumeAdjacentValues === true) {
          while (index + 1 < argv.length && argv[index + 1] !== '--' && !argv[index + 1]?.startsWith('-')) index++
        }
      }
      continue
    }
    if (arg.startsWith('-') && arg.length > 1) {
      const definition = definitions[shortFlags.get(arg.slice(1)) ?? '']
      if (definition && !isBooleanFlag(definition)) {
        index++
        if (definition.consumeAdjacentValues === true) {
          while (index + 1 < argv.length && argv[index + 1] !== '--' && !argv[index + 1]?.startsWith('-')) index++
        }
      }
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

  return parseCommandArgv([
    subcommand.name,
    ...argv.slice(1, subcommandIndex),
    ...argv.slice(subcommandIndex + 1)
  ], subcommand, globalFlags)
}

export const parseNativeCli = (
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
