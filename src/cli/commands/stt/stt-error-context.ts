import type { RetryClass } from '~/types'
import { annotateAppError } from '~/utils/error-handler'

export const attachSttStageErrorContext = (
  error: unknown,
  stage: string,
  retryClass: RetryClass
): never => {
  throw annotateAppError(error, {
    kind: 'provider_http',
    stage,
    retryClass,
    metadata: { stage, retryClass }
  })
}
