import type { CliCommandContext } from '~/types'

export type ComicParsedArgs = Pick<CliCommandContext, 'flags' | 'parameters' | 'rawParsed'>
