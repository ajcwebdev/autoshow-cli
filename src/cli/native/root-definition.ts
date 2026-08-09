import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { colorizeHelpFlagGroups } from '~/cli/help-colors'
import type { CliRootDefinition } from '~/types'
import { HELP_COMMAND_GROUPS, HELP_FLAG_GROUPS } from './help-groups'

export { HELP_COMMAND_GROUPS, HELP_FLAG_GROUPS } from './help-groups'

export const CLI_VERSION = (await import('../../../package.json')).version as string

export const HELP_COMMAND_GROUP_DEFINITIONS: [string, string][] = HELP_COMMAND_GROUPS.map(([key, label]) => [key, label])

export const createNativeRootDefinition = (): CliRootDefinition => ({
  scriptName: 'bun autoshow',
  description: 'Extract and write content, generate speech, images, video, and music, and build comic workflows',
  version: CLI_VERSION,
  globalFlags: GLOBAL_FLAG_DEFINITIONS,
  commandGroups: HELP_COMMAND_GROUP_DEFINITIONS,
  flagGroups: colorizeHelpFlagGroups(HELP_FLAG_GROUPS)
})
