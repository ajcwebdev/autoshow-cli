import { installProcessFailureHandlers } from '~/cli/failure-handlers'
import { extractErrorHints, isUsageError, normalizeExitCode, usageMessage } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import type { HelpCommandGroupKey } from '~/types'
import {
  colorizeFlagDescriptions,
  helpColorsEnabled
} from '~/cli/help-colors'
import { dispatchNativeCli } from '~/cli/native/dispatcher'
import { createNativeRootDefinition } from '~/cli/native/root-definition'
import { COMMAND_DEFINITIONS, HELP_COMMAND_GROUP_BY_NAME } from './command-definitions'

export { COMMAND_DEFINITIONS, HELP_COMMAND_GROUP_BY_NAME } from './command-definitions'

const cliErrorHandler = (error: unknown): void => {
  if (isUsageError(error)) {
    l.error(`Usage error: ${usageMessage(error)}`)
    for (const hint of extractErrorHints(error)) {
      l.write('info', hint)
    }
    process.exit(2)
  }

  const exitCode = normalizeExitCode(error)
  l.error('Command failed', error)

  for (const hint of extractErrorHints(error)) {
    l.write('info', hint)
  }

  process.exit(exitCode)
}

const setCommandHelpGroup = (command: unknown, group: HelpCommandGroupKey): void => {
  if (typeof command !== 'object' || command === null) {
    return
  }

  const commandDefinition = command as { help?: Record<string, unknown> }
  const existingHelp = commandDefinition.help
  commandDefinition.help = {
    ...(typeof existingHelp === 'object' && existingHelp !== null && !Array.isArray(existingHelp) ? existingHelp : {}),
    group
  }
}

const applyCommandHelpGroups = (): void => {
  for (const command of COMMAND_DEFINITIONS) {
    const group = HELP_COMMAND_GROUP_BY_NAME[command.name]
    if (group !== undefined) {
      setCommandHelpGroup(command, group)
    }
  }
}

applyCommandHelpGroups()

let helpDescriptionColorsApplied = false
const applyUniversalHelpDescriptionColors = (): void => {
  if (!helpColorsEnabled || helpDescriptionColorsApplied) {
    return
  }

  for (const command of COMMAND_DEFINITIONS) {
    colorizeFlagDescriptions(command.flags as Record<string, unknown> | undefined)
    for (const subcommand of command.subcommands ?? []) {
      colorizeFlagDescriptions(subcommand.flags as Record<string, unknown> | undefined)
    }
  }

  helpDescriptionColorsApplied = true
}

export const runCliInProcess = async (argv: string[]): Promise<void> => {
  applyUniversalHelpDescriptionColors()
  await dispatchNativeCli(argv, createNativeRootDefinition(), COMMAND_DEFINITIONS)
}

const main = async (): Promise<void> => {
  const argv = Bun.argv.slice(2)
  await runCliInProcess(argv)
}

if (import.meta.main) {
  installProcessFailureHandlers()

  try {
    await main()
  } catch (error) {
    cliErrorHandler(error)
  }
}
