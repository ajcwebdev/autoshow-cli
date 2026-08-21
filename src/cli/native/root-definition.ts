import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { colorizeHelpFlagGroups } from '~/cli/help-colors'
import type { CliRootDefinition } from '~/types'
import packageJson from '../../../package.json'
import { HELP_COMMAND_GROUPS, HELP_FLAG_GROUPS } from './help-groups'

export { HELP_COMMAND_GROUPS, HELP_FLAG_GROUPS } from './help-groups'

// Statically imported so this module stays synchronous. A top-level await here
// makes every importer an async module, which Bun's parallel test workers do
// not await, leaving the exports below in the temporal dead zone.
const CLI_VERSION = packageJson.version as string

const HELP_COMMAND_GROUP_DEFINITIONS: [string, string][] = HELP_COMMAND_GROUPS.map(([key, label]) => [key, label])

export const createNativeRootDefinition = (): CliRootDefinition => ({
  scriptName: 'bun autoshow',
  description: 'Extract and write content, manage voices, generate speech, images, video, and music, and build comic workflows',
  version: CLI_VERSION,
  globalFlags: GLOBAL_FLAG_DEFINITIONS,
  commandGroups: HELP_COMMAND_GROUP_DEFINITIONS,
  flagGroups: colorizeHelpFlagGroups(HELP_FLAG_GROUPS)
})
