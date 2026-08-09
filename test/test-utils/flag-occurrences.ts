import { parseCommandArgv } from '~/cli/native/native-parser'
import type { CliCommandDefinition, CliFlagOccurrence, CliFlagsDefinition, CliParseResult } from '~/types'

export const flagOccurrencesFromValues = (
  flags: Record<string, unknown>,
  explicitFlags: ReadonlySet<string> = new Set(Object.keys(flags))
): CliFlagOccurrence[] => Object.entries(flags).flatMap(([name, rawValue]) => {
  if (!explicitFlags.has(name)) {
    return []
  }
  const values = Array.isArray(rawValue) ? rawValue : [rawValue]
  return values.flatMap((value): CliFlagOccurrence[] =>
    typeof value === 'string' || typeof value === 'boolean'
      ? [{ name, raw: `--${name}`, value, known: true }]
      : []
  )
})

export const parseFlagsAndOccurrences = (
  argv: string[],
  flags: CliFlagsDefinition
): CliParseResult => {
  const command: CliCommandDefinition = {
    name: argv[0] ?? 'probe',
    description: 'flag occurrence contract parser',
    parameters: [{ key: '[positionals...]' }],
    flags,
    allowUnknownFlags: true,
    allowExcessParameters: true,
    handler: () => {}
  }
  return parseCommandArgv(argv, command, {})
}

export const parseFlagOccurrences = (
  argv: string[],
  flags: CliFlagsDefinition
): CliFlagOccurrence[] => parseFlagsAndOccurrences(argv, flags).rawParsed.flagOccurrences
