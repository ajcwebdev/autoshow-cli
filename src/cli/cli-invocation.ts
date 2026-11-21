import { IS_INSTALLED_CLI } from '~/utils/project-root'

export const CLI_INVOCATION = IS_INSTALLED_CLI ? 'autoshow' : 'bun autoshow'
