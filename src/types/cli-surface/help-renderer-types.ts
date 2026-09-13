import type { CliCommandDefinition } from '~/types'

export type CliCommandHelpDefinition = Omit<CliCommandDefinition, 'handler'>
export type CliHelpRenderOptions = { width?: number | undefined, topic?: string | undefined }
export type CliHelpTopic = { description: string, groups?: readonly string[], flags?: readonly string[], notes?: readonly string[] }
