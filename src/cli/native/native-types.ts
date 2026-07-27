import type { CliCommandDefinition, CliCommandHandler } from '~/types'

export const defineCliCommand = (
  definition: Omit<CliCommandDefinition, 'handler'>,
  handler: CliCommandHandler
): CliCommandDefinition => ({
  ...definition,
  handler
})
