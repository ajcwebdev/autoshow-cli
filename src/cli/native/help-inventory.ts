import type { CliCommandDefinition } from '~/types'
import { getNativeRenderableCommands } from './builtins'

export const RETIRED_HELP_COMMANDS = ['benchmark'] as const

export const getCommandHelpInventory = (commands: readonly CliCommandDefinition[]) => {
  const rows: Array<{ command: CliCommandDefinition, visibility: 'public' | 'compatibility' }> = []
  const seen = new Set<string>()
  const visit = (command: CliCommandDefinition, hidden = false): void => {
    if (seen.has(command.name)) throw new Error(`Duplicate help command: ${command.name}`)
    seen.add(command.name)
    const compatibility = hidden || command.help?.hidden === true
    rows.push({ command, visibility: compatibility ? 'compatibility' : 'public' })
    for (const child of command.subcommands ?? []) visit(child, compatibility)
  }
  for (const command of getNativeRenderableCommands(commands)) visit(command)
  return rows
}
