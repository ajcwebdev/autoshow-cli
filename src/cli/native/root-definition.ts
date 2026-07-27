import { CONFIG_COMMAND_HELP_FLAG_GROUPS } from '~/cli/flags/config-flags'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { colorizeHelpFlagGroups } from '~/cli/help-colors'
import type { CliRootDefinition } from '~/types'

export const CLI_VERSION = (await import('../../../package.json')).version as string

export const HELP_COMMAND_GROUPS = [
  ['core', 'Core Commands'],
  ['setup', 'Setup & Utilities'],
  ['processing', 'Processing & Generation']
] as const

export const HELP_COMMAND_GROUP_DEFINITIONS: [string, string][] = HELP_COMMAND_GROUPS.map(([key, label]) => [key, label])

export const createNativeRootDefinition = (): CliRootDefinition => ({
  name: 'AutoShow CLI',
  scriptName: 'bun autoshow',
  description: 'Extract and write content, generate speech, images, video, and music, and build comic workflows',
  version: CLI_VERSION,
  globalFlags: GLOBAL_FLAG_DEFINITIONS,
  commandGroups: HELP_COMMAND_GROUP_DEFINITIONS,
  flagGroups: colorizeHelpFlagGroups(CONFIG_COMMAND_HELP_FLAG_GROUPS)
})
