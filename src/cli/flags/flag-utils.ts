import type { CliFlagDefinition, CliFlagsDefinition } from '~/types'

export const strFlag = (description: string, defaultValue?: string): CliFlagDefinition =>
  defaultValue === undefined
    ? { description, type: String }
    : { description, type: String, default: defaultValue }

export const strListFlag = (description: string): CliFlagDefinition => ({
  description,
  type: [String] as [StringConstructor]
})

export const boolFlag = (description: string): CliFlagDefinition => ({
  description,
  type: Boolean,
  default: false,
  negatable: false
})

export const withHelpGroup = (flags: CliFlagsDefinition, group: string): CliFlagsDefinition => {
  const grouped: CliFlagsDefinition = {}
  for (const [name, definition] of Object.entries(flags)) {
    const flagDefinition = definition as CliFlagDefinition
    const existingHelp = flagDefinition.help
    grouped[name] = {
      ...flagDefinition,
      help: {
        ...(typeof existingHelp === 'object' && existingHelp !== null ? existingHelp : {}),
        group
      }
    }
  }
  return grouped
}

export const formatProviderList = (providers: Record<string, unknown>): string =>
  Object.keys(providers).join('|')

export const formatValueList = (values: readonly (string | number)[]): string =>
  values.join('|')

export const formatRange = (range: readonly [number, number]): string =>
  range[0] < 0 ? `${range[0]} to ${range[1]}` : `${range[0]}-${range[1]}`

export const formatUniqueValueList = (...valueLists: readonly (readonly string[])[]): string =>
  [...new Set(valueLists.flat())].join('|')

export const formatValuesByProvider = (
  entries: readonly { provider: string, values: readonly (string | number)[], note?: string }[]
): string => {
  const clauses: { values: string, providers: string[], note?: string | undefined }[] = []
  for (const entry of entries) {
    const values = formatValueList(entry.values)
    const existing = clauses.find((clause) => clause.values === values && clause.note === entry.note)
    if (existing) {
      existing.providers.push(entry.provider)
      continue
    }
    clauses.push({ values, providers: [entry.provider], note: entry.note })
  }
  return clauses
    .map((clause) => `${clause.values} (${clause.providers.join('/')}${clause.note ? `; ${clause.note}` : ''})`)
    .join(', ')
}

export const omitFlags = (
  flags: CliFlagsDefinition,
  names: readonly string[]
): CliFlagsDefinition => {
  const omitted = new Set(names)
  return Object.fromEntries(
    Object.entries(flags).filter(([name]) => !omitted.has(name))
  ) as CliFlagsDefinition
}

export const pickFlags = (
  flags: CliFlagsDefinition,
  names: readonly string[]
): CliFlagsDefinition => {
  const picked: CliFlagsDefinition = {}
  for (const name of names) {
    const definition = flags[name]
    if (definition !== undefined) {
      picked[name] = definition
    }
  }
  return picked
}
