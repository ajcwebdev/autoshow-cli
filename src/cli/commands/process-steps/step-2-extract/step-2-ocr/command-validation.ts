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

export const validateOcrProviderModeCommandFlags = (
  ctx: OcrLikeContext
): void => {
  const mode = ctx.flags['ocr-provider-mode']
  if (mode !== undefined && mode !== 'fanout' && mode !== 'pool') {
    throw CLIUsageError(`Invalid --ocr-provider-mode "${String(mode)}". Expected fanout or pool.`)
  }
  if (mode === 'pool' && typeof ctx.flags['primary-ocr'] === 'string' && ctx.flags['primary-ocr'].trim().length > 0) {
    throw CLIUsageError('--primary-ocr cannot be used with --ocr-provider-mode pool because the top-level extraction is the composite pooled result.')
  }
}
