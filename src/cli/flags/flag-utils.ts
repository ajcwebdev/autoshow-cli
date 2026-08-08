import type { CliFlagDefinition, CliFlagsDefinition } from '~/types'

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

// Rewrites internal flag spellings into the public ones a surface registers. Help text and
// usage errors both need it: a command that renames `--image-size` to `--size` must never
// print a flag name the user cannot type on that surface.
export const renameFlagSpellings = (
  text: string,
  publicNameByInternalName: Record<string, string>
): string =>
  Object.entries(publicNameByInternalName).reduce(
    (value, [internalName, replacement]) => value.replaceAll(`--${internalName}`, `--${replacement}`),
    text
  )

export const renameFlags = (
  flags: CliFlagsDefinition,
  publicNameByInternalName: Record<string, string>
): CliFlagsDefinition => {
  const renamed: CliFlagsDefinition = {}
  for (const [name, definition] of Object.entries(flags)) {
    const publicName = publicNameByInternalName[name] ?? name
    renamed[publicName] = {
      ...definition,
      description: renameFlagSpellings(definition.description, publicNameByInternalName)
    }
  }
  return renamed
}

export const formatProviderList = (providers: Record<string, unknown>): string =>
  Object.keys(providers).join('|')

// Renders an allowed-value list into help text straight from the constant the
// validator uses, so a new supported value cannot go undocumented.
export const formatValueList = (values: readonly (string | number)[]): string =>
  values.join('|')

// Negative lower bounds get the spelled-out form so "-1-15" never appears in help.
export const formatRange = (range: readonly [number, number]): string =>
  range[0] < 0 ? `${range[0]} to ${range[1]}` : `${range[0]}-${range[1]}`

export const formatUniqueValueList = (...valueLists: readonly (readonly string[])[]): string =>
  [...new Set(valueLists.flat())].join('|')

// Renders "<values> (<providers>)" clauses, collapsing providers that accept the exact
// same values into one clause. If two providers' registries diverge later, the clause
// splits on its own instead of silently claiming shared support.
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
