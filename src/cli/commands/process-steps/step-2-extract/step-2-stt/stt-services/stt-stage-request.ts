import type { InferOutput } from 'valibot'
import type { AsyncSttLifecycleMetrics, SttRequestMetrics, SttStageHttpError, SttStageRequestOptions, SttStageSchema } from '~/types'
import { attachAsyncSttErrorContext, attachAsyncSttValidationContext, getAsyncSttErrorStatus } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/async-lifecycle'
import { httpResponseError } from '~/utils/rest-client'
import { classifyFetchRetry, parseRetryAfterMs, withRetry } from '~/utils/retries'
import { validateData } from '~/utils/validate/validation'

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
        policy: { maxAttempts: options.maxAttempts },
        timeoutMs: options.timeoutMs
      },
      async (signal) => {
        metrics?.onRequest?.()
        const response = await options.doFetch(signal)

        if (!response.ok) {
          const failure = options.readFailure
            ? await options.readFailure(response)
            : { message: await response.text(), rawResponse: undefined }
          // AppProviderError rather than a bare Error: the duck-typed extras below stay
          // readable by `extractErrorMetadata`, but the error now carries `kind`, so the
          // provider_http hint branch fires and the fatal handler prints the message
          // instead of "payload redacted".
          throw httpResponseError(
            `${errorPrefix} ${failureLabel ?? stage} failed (${response.status}): ${failure.message}`,
            response,
            {
              stage,
              retryClass,
              ...(failure.rawResponse !== undefined ? { rawResponse: failure.rawResponse } : {})
            }
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
          metrics?.onRetry?.(getAsyncSttErrorStatus(error))
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
    return attachAsyncSttValidationContext<SttStageHttpError>(error, stage, retryClass, result.payload)
  }
}

export const sttStageRequest = async <TSchema extends SttStageSchema>(
  options: SttStageRequestOptions<TSchema>
): Promise<InferOutput<TSchema>> =>
  (await sttStageRequestWithRetryAfter(options)).value
