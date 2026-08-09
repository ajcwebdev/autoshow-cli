import type { InferOutput } from 'valibot'
import type { AsyncSttLifecycleMetrics, SttRequestMetrics, SttStageHttpError, SttStageRequestOptions, SttStageSchema } from '~/types'
import { attachAsyncSttErrorContext, attachAsyncSttValidationContext, getAsyncSttErrorStatus } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/async-lifecycle'
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
          throw Object.assign(
            new Error(`${errorPrefix} ${failureLabel ?? stage} failed (${response.status}): ${await response.text()}`),
            {
              status: response.status,
              headers: response.headers,
              stage,
              retryClass
            }
          ) satisfies SttStageHttpError
        }

        return {
          payload: await response.json(),
          retryAfterMs: parseRetryAfterMs(response.headers) ?? null
        }
      },
      (error) => {
        const decision = classifyFetchRetry(error, retryClass, { retryAbortOnConservative: true })
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
