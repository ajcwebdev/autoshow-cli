import type { CliFlagDefinition, CliFlagOccurrence, CliFlagsDefinition, CliFlagValues } from '~/types'
import {
  NativeMissingFlagValueError
} from './native-errors'

const camelize = (value: string): string =>
  value.replace(/-([a-zA-Z0-9])/g, (_match, char: string) => char.toUpperCase())

const isRepeatableStringFlag = (definition: CliFlagDefinition): boolean =>
  Array.isArray(definition.type)

export const isBooleanFlag = (definition: CliFlagDefinition): boolean =>
  definition.type === Boolean

const isNegatableBooleanFlag = (definition: CliFlagDefinition | undefined): definition is CliFlagDefinition =>
  definition !== undefined && isBooleanFlag(definition) && definition.negatable === true

const cloneDefaultValue = (value: unknown): unknown =>
  Array.isArray(value) ? [...value] : value

export const buildShortFlagMap = (flags: CliFlagsDefinition): Map<string, string> => {
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

export const recordFlagOccurrence = (
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

const collectAdjacentFlagValues = (argv: string[], startIndex: number): string[] => {
  const values: string[] = []
  for (let valueIndex = startIndex; valueIndex < argv.length; valueIndex++) {
    const value = argv[valueIndex]
    if (typeof value !== 'string' || value === '--' || value.startsWith('-')) break
    values.push(value)
  }
  return values
}

const getAdjacentFlagValues = (
  argv: string[],
  index: number,
  definition: CliFlagDefinition
): string[] => isRepeatableStringFlag(definition) && definition.consumeAdjacentValues === true
  ? collectAdjacentFlagValues(argv, index + 1)
  : []

export const parseLongFlag = (
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

export const parseShortFlag = (
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

export const buildInitialFlags = (definitions: CliFlagsDefinition): CliFlagValues => {
  const flags = {} as CliFlagValues
  for (const [name, definition] of Object.entries(definitions)) {
    if ('default' in definition) {
      flags[name] = cloneDefaultValue(definition.default)
    }
  }
  return flags
}

// Discovery defers missing-value errors to command parsing so routing retains its error precedence.
export const findNativeFlagValueEnd = (
  argv: string[], index: number, definition: CliFlagDefinition | undefined
): number => {
  if (!definition || isBooleanFlag(definition)) return index
  // Value-taking flags occupy one discovery position even if that value is malformed.
  const firstValueIndex = index + 1
  return definition.consumeAdjacentValues === true
    ? firstValueIndex + collectAdjacentFlagValues(argv, firstValueIndex + 1).length
    : firstValueIndex
}
