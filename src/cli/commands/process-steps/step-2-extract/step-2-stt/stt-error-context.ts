import type { RetryClass, SttStageHttpError } from '~/types'
import { ProviderError } from '~/utils/error-handler'

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
