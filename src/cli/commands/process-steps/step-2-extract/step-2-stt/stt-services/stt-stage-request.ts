import type { InferOutput } from 'valibot'
import type { AsyncSttLifecycleMetrics, SttRequestMetrics, SttStageHttpError, SttStageRequestOptions, SttStageSchema } from '~/types'
import { attachAsyncSttErrorContext, attachAsyncSttValidationContext } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/async-lifecycle'
import { httpResponseError, httpResponseOptions } from '~/utils/rest-client'
import { classifyFetchRetry, isRetryableStatus, parseRetryAfterMs, withRetry } from '~/utils/retries'
import { validateData } from '~/utils/validate/validation'
import { getErrorStatus } from '~/utils/error-handler'

export const lifecycleMetricsToCallbacks = (
  metrics: AsyncSttLifecycleMetrics
): SttRequestMetrics => ({
  onRequest: () => {
    metrics.requestCount += 1
  },
  onRetry: (status) => {
    metrics.retryCount += 1
    if (status === 429) {
      metrics.rateLimitCount += 1
    }
  }
})

export const sttStageRequestWithRetryAfter = async <TSchema extends SttStageSchema>(
  options: SttStageRequestOptions<TSchema>
): Promise<{ value: InferOutput<TSchema>, retryAfterMs: number | null }> => {
  const { attachError = attachAsyncSttErrorContext, errorPrefix, failureLabel, metrics, retryClass, stage } = options

  let result!: { payload: unknown, retryAfterMs: number | null }
  try {
    result = await withRetry(
      {
        retryClass,
        operationName: options.operationName,
        timeoutMs: options.timeoutMs
      },
      async (signal) => {
        metrics?.onRequest?.()
        const response = await options.doFetch(signal)

        if (!response.ok) {
          const failure = options.readFailure
            ? await options.readFailure(response)
            : { message: await response.text(), rawResponse: undefined }
          throw httpResponseError(
            `${errorPrefix} ${failureLabel ?? stage} failed (${response.status}): ${failure.message}`,
            httpResponseOptions(response, {
              stage,
              retryClass,
              retryable: retryClass === 'runtime_http_create_conservative'
                ? response.status === 425 || response.status === 429
                : isRetryableStatus(response.status),
              metadata: failure.rawResponse !== undefined ? { rawResponse: failure.rawResponse } : {}
            })
          ) satisfies SttStageHttpError
        }

        return {
          payload: await response.json(),
          retryAfterMs: parseRetryAfterMs(response.headers) ?? null
        }
      },
      (error) => {
        const decision = classifyFetchRetry(error, retryClass)
        if (decision.shouldRetry) {
          metrics?.onRetry?.(getErrorStatus(error))
        }
        return decision
      }
    )
  } catch (error) {
    attachError(error, stage, retryClass)
  }

  try {
    return {
      value: validateData(options.schema, result.payload, options.schemaLabel),
      retryAfterMs: result.retryAfterMs
    }
  } catch (error) {
    return attachAsyncSttValidationContext(error, stage, retryClass, result.payload)
  }
}

export const sttStageRequest = async <TSchema extends SttStageSchema>(
  options: SttStageRequestOptions<TSchema>
): Promise<InferOutput<TSchema>> =>
  (await sttStageRequestWithRetryAfter(options)).value
