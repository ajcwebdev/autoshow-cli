import type { CliCommandDefinition } from '~/types'

// Help rendering never needs the handler, so nested subcommands can supply
// handler-less definitions purely to describe their own help output.
export type CliCommandHelpDefinition = Omit<CliCommandDefinition, 'handler'>
