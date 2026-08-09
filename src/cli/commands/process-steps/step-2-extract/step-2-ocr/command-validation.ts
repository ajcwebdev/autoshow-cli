import type { OcrLikeContext } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { EPUB_INSPECT_JSON_ONLY_ERROR } from '../step-2-shared/inactive-flag-warnings'

export const validateEpubInspectCommandFlags = (
  ctx: OcrLikeContext
): void => {
  const formatWasExplicitlyProvided = ctx.rawParsed.explicitFlags.has('format')

  if (ctx.flags['epub-bun'] === true && formatWasExplicitlyProvided && ctx.flags['format'] !== 'json') {
    throw CLIUsageError(EPUB_INSPECT_JSON_ONLY_ERROR)
  }
}
