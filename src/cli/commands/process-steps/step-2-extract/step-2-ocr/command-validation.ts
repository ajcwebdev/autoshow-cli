import type { OcrLikeContext } from '~/types'
import { UsageError } from '~/utils/error-handler'

export const validateOcrProviderModeCommandFlags = (
  ctx: OcrLikeContext
): void => {
  const mode = ctx.flags['ocr-provider-mode']
  if (mode !== undefined && mode !== 'fanout' && mode !== 'pool') {
    throw UsageError(`Invalid --ocr-provider-mode "${String(mode)}". Expected fanout or pool.`)
  }
  if (mode === 'pool' && typeof ctx.flags['primary-ocr'] === 'string' && ctx.flags['primary-ocr'].trim().length > 0) {
    throw UsageError('--primary-ocr cannot be used with --ocr-provider-mode pool because the top-level extraction is the composite pooled result.')
  }
}
