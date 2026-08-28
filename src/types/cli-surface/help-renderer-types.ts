import type { CliCommandDefinition } from '~/types'

export type CliCommandHelpDefinition = Omit<CliCommandDefinition, 'handler'>
