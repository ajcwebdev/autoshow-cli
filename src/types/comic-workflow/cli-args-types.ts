import type { CliCommandContext, ParsedReviewSheetArgs, ReviewSheetCommandSelectionOptions } from '~/types'

export type ComicParsedArgs = Pick<CliCommandContext, 'flags' | 'parameters' | 'rawParsed'>

export type ParsedReviewArgs = ParsedReviewSheetArgs & ReviewSheetCommandSelectionOptions
