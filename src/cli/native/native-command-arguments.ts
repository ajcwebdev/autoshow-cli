import type { CliCommandDefinition, CliFlagOccurrence, CliFlagsDefinition, CliParameterDefinition, CliParameterValues, CliParseResult, CliRawParsed } from '~/types'
import {
  NativeInvalidParametersError,
  NativeNoSuchCommandError,
  NativeUnknownFlagError
} from './native-errors'
import { buildInitialFlags, buildShortFlagMap, parseLongFlag, parseShortFlag, recordFlagOccurrence } from './native-flag-parser'
import { getUnknownFlagSpellings } from './unknown-flag-spellings'

const parameterName = (parameter: CliParameterDefinition): string =>
  parameter.key.replace(/^[<[{]/, '').replace(/[>\]}]$/, '').replace(/\.\.\.$/, '')

const parameterRequired = (parameter: CliParameterDefinition): boolean =>
  parameter.key.startsWith('<')

const parameterVariadic = (parameter: CliParameterDefinition): boolean =>
  parameter.key.includes('...')

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

export const buildRawParsed = (
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
    if (arg === '--version' || arg === '-v') {
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
