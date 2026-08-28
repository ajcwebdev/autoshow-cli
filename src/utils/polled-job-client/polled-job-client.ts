import { InfraError } from '~/utils/error-handler'
import { classifyFetchRetry, pollUntil, withRetry } from '~/utils/retries'
import { validateData } from '~/utils/validate/validation'
import type { PolledJobCustomStep, PolledJobFailure, PolledJobStep } from '~/types'

const isCustomStep = <T>(step: PolledJobStep<T>): step is PolledJobCustomStep<T> =>
  'run' in step

const readHttpPayload = async (response: Response): Promise<unknown> =>
  response.ok ? await response.json() as unknown : await response.text()

const defaultErrorBody = (payload: unknown): string =>
  typeof payload === 'string' && payload.length > 0 ? payload : 'No response body'

const runStep = async <T>(
  step: PolledJobStep<T>,
  signal?: AbortSignal | undefined
): Promise<T> => {
  if (isCustomStep(step)) {
    return await step.run(signal)
  }

  const response = await fetch(step.url, {
    ...step.init,
    ...(signal && !step.init.signal ? { signal } : {})
  })
  const payload = await (step.readResponse ?? readHttpPayload)(response)
  if (!response.ok) {
    if (step.errorFactory) {
      throw step.errorFactory(response, payload)
    }
    const detail = (step.formatErrorBody ?? defaultErrorBody)(payload)
    throw InfraError(`${step.errorMessage} (${response.status}): ${detail}`, {
      stage: step.stage,
      status: response.status
    })
  }
  return validateData(step.schema, payload, step.context)
}

export const runPolledJob = async <TCreate, TPoll>(options: {
  operationName: string
  intervalMs: number
  deadlineMs: number
  create: PolledJobStep<TCreate>
  poll: (created: TCreate) => PolledJobStep<TPoll>
  isDone: (value: TPoll) => boolean
  isFailed?: ((value: TPoll) => PolledJobFailure) | undefined
  onPoll?: ((value: TPoll) => void) | undefined
  validateCreate?: ((value: TCreate) => void) | undefined
  abortSignal?: AbortSignal | undefined
}): Promise<{ created: TCreate, result: TPoll }> => {
  const created = await runStep(options.create)
  options.validateCreate?.(created)

  const result = await pollUntil({
    operationName: options.operationName,
    intervalMs: options.intervalMs,
    deadlineMs: options.deadlineMs,
    pollFn: () => withRetry(
      {
        retryClass: 'runtime_http_read',
        operationName: `${options.operationName}-poll`,
        ...(options.abortSignal ? { abortSignal: options.abortSignal } : {})
      },
      async (signal) => {
        const value = await runStep(options.poll(created), signal)
        options.onPoll?.(value)
        return value
      },
      (error) => classifyFetchRetry(error, 'runtime_http_read')
    ),
    isDone: options.isDone,
    ...(options.isFailed ? { isFailed: options.isFailed } : {}),
    ...(options.abortSignal ? { abortSignal: options.abortSignal } : {})
  })

  return { created, result }
}

export const formatPolledJobError = (
  value: unknown,
  fallback = 'Unknown error'
): string => {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'string') return value
  if (typeof value === 'object' && 'message' in value) {
    const message = (value as { message?: unknown }).message
    if (typeof message === 'string' && message.length > 0) return message
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
