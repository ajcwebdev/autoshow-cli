import type { RetryClass, SttStageHttpError } from '~/types'
import { ProviderError } from '~/utils/error-handler'

/**
 * Stamps the pipeline stage and retry classification onto a provider failure and rethrows it.
 * Four STT adapters carried private copies of this; since the retry class is what decides
 * whether the failure is retried, four copies meant four places for that policy to drift.
 *
 * Distinct from `attachAsyncSttErrorContext`, which additionally unwraps `error.cause` for
 * the async job lifecycle.
 */
export const attachSttStageErrorContext = (
  error: unknown,
  stage: string,
  retryClass: RetryClass
): never => {
  const source = error instanceof Error ? error : ProviderError(String(error))
  ;(source as SttStageHttpError).stage = stage
  ;(source as SttStageHttpError).retryClass = retryClass
  throw source
}
