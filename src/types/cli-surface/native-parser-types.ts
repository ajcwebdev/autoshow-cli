import type { CliCommandDefinition, CliFlagValues, CliParameterValues, CliRawParsed } from '~/types'

export type CliParseMode = 'command' | 'help' | 'version'

export type CliParseResult = {
  mode: CliParseMode
  argv: string[]
  calledAs?: string
  command?: CliCommandDefinition
  flags: CliFlagValues
  parameters: CliParameterValues
  rawParsed: CliRawParsed
}
