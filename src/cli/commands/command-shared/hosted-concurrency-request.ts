import type { HostedConcurrencyAdmission, HostedConcurrencyAdmissionToken, HostedConcurrencyCoordinator, HostedConcurrencyPressureDecision, HostedConcurrencyRequestOptions, ProviderLanePressureFeedback } from '~/types'
import { AppError, extractErrorMetadata } from '~/utils/error-handler'
import { classifyHostedRateLimitPressure } from './hosted-rate-limit-pressure'

const toHeaders = (headers: unknown): Headers | undefined => {
  if (headers instanceof Headers) return headers
  if (!headers || typeof headers !== 'object') return undefined
  const normalized = new Headers()
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' || typeof item === 'number') normalized.append(key, String(item))
      }
    } else if (typeof value === 'string' || typeof value === 'number') {
      normalized.append(key, String(value))
    }
  }
  return [...normalized.keys()].length > 0 ? normalized : undefined
}

const toErrorCause = (error: unknown): Error =>
  error instanceof Error ? error : new Error(error === undefined ? 'Unknown hosted request failure' : String(error))

const throwHostedRecoveryExhausted = (
  error: unknown,
  pressure: ProviderLanePressureFeedback,
  decision: HostedConcurrencyPressureDecision,
  token: HostedConcurrencyAdmissionToken
): never => {
  const metadata = extractErrorMetadata(error)
  const status = typeof metadata['status'] === 'number' ? metadata['status'] : pressure.status
  const headers = toHeaders(metadata['headers'])
  const stage = typeof metadata['stage'] === 'string' ? metadata['stage'] : 'hosted:rate-limit-recovery'
  throw new AppError(`Hosted request rate-limit recovery exhausted after ${decision.pressureAttempt} pressure event(s) and ${decision.elapsedMs}ms.`, {
    kind: 'retry_exhausted',
    cause: toErrorCause(error),
    ...(typeof status === 'number' ? { status } : {}),
    ...(headers ? { headers } : {}),
    stage,
    retryable: false,
    metadata: {
      ...metadata,
      pressureAttempt: decision.pressureAttempt,
      elapsedMs: decision.elapsedMs,
      remainingBudgetMs: decision.remainingBudgetMs,
      requiredDelayMs: decision.delayMs,
      stopReasonCode: 'max_attempts',
      hostedConcurrencyLane: token.lane,
      hostedConcurrencyWorkClass: token.workClass,
      hostedConcurrencyWorkId: token.workId,
      hostedConcurrencyUnitIndex: token.unitIndex
    }
  })
}

export const recoverHostedConcurrencyRequest = async (options: {
  coordinator: HostedConcurrencyCoordinator
  admission: HostedConcurrencyAdmission
  token: HostedConcurrencyAdmissionToken
  error: unknown
  pressure?: ProviderLanePressureFeedback | undefined
}): Promise<HostedConcurrencyAdmissionToken> => {
  const pressure = options.pressure ?? classifyHostedRateLimitPressure(options.error)
  if (!pressure) throw options.error
  const decision = options.coordinator.reportRateLimit(options.token, pressure)
  options.coordinator.release(options.token, 'failed')
  if (!decision.retry) {
    throwHostedRecoveryExhausted(options.error, pressure, decision, options.token)
  }
  return await options.coordinator.acquire(options.admission)
}

export const runHostedConcurrencyRequest = async <T>(
  options: HostedConcurrencyRequestOptions,
  task: (token: HostedConcurrencyAdmissionToken) => Promise<T>
): Promise<T> => {
  const classifyPressure = options.classifyPressure ?? classifyHostedRateLimitPressure
  let token = await options.coordinator.acquire(options.admission)
  while (true) {
    try {
      const result = await task(token)
      options.coordinator.release(token, 'succeeded')
      return result
    } catch (error) {
      const pressure = classifyPressure(error)
      if (!pressure) {
        options.coordinator.release(token, options.admission.abortSignal?.aborted === true ? 'canceled' : 'failed')
        throw error
      }
      token = await recoverHostedConcurrencyRequest({
        coordinator: options.coordinator,
        admission: options.admission,
        token,
        error,
        pressure
      })
    }
  }
}
