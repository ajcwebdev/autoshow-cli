import type { RetryAttemptLog, RetryContext, RetryReasonCode } from '~/types'
import { AppError, extractErrorMetadata, serializeDiagnosticError } from '~/utils/error-handler'
import { readRetrySignals } from './retry-classification'
import * as l from '~/utils/app-logger/app-logger'

export const logRetryAttempt = (
  summary: RetryAttemptLog,
  metadata: Record<string, unknown> = {}
): void => {
  l.write('warn', `Retrying ${summary.operation} in ${summary.delayMs}ms after attempt ${summary.failedAttempt}/${summary.maxAttempts}: ${summary.reason}`, {
    category: 'retry',
    metadata: {
      ...summary,
      ...metadata
    }
  })
}

export const formatRetryExhaustedMessage = (
  operationName: string,
  attemptsMade: number,
  maxAttempts: number,
  stopReason: string,
  elapsedMs: number
): string => `${operationName} failed after ${attemptsMade}/${maxAttempts} attempts (${stopReason}, ${elapsedMs}ms elapsed)`

export const buildRetryAttemptMetadata = (ctx: RetryContext, error: unknown): Record<string, unknown> => ({
  retryClass: ctx.retryClass,
  stage: typeof extractErrorMetadata(error)['stage'] === 'string' ? extractErrorMetadata(error)['stage'] : ctx.operationName,
  status: readRetrySignals(error).status,
  cause: serializeDiagnosticError(error),
  ...ctx.retryLogMetadata?.(error)
})

export const throwRetryExhausted = (
  ctx: RetryContext,
  lastError: unknown,
  { startedAt, attemptsMade, maxAttempts, stopReason, stopReasonCode }: {
    startedAt: number
    attemptsMade: number
    maxAttempts: number
    stopReason: string
    stopReasonCode: RetryReasonCode
  }
): never => {
  const elapsed = Date.now() - startedAt
  const metadata = extractErrorMetadata(lastError)
  const status = typeof metadata['status'] === 'number' ? metadata['status'] : undefined
  const headers = metadata['headers'] instanceof Headers ? metadata['headers'] : undefined
  const stage = typeof metadata['stage'] === 'string' ? metadata['stage'] : undefined
  const retryable = typeof metadata['retryable'] === 'boolean' ? metadata['retryable'] : undefined
  const {
    status: _causeStatus,
    headers: _causeHeaders,
    stage: _causeStage,
    retryable: _causeRetryable,
    retryClass: _causeRetryClass,
    ...causeMetadata
  } = metadata

  throw new AppError(formatRetryExhaustedMessage(ctx.operationName, attemptsMade, maxAttempts, stopReason, elapsed), {
    kind: 'retry_exhausted',
    cause: lastError,
    retryClass: ctx.retryClass,
    ...(typeof status === 'number' ? { status } : {}),
    ...(headers ? { headers } : {}),
    stage: stage ?? ctx.operationName,
    retryable: false,
    metadata: {
      ...causeMetadata,
      attemptsMade,
      maxAttempts,
      elapsedMs: elapsed,
      stopReason,
      stopReasonCode,
      retryClass: ctx.retryClass,
      ...(typeof retryable === 'boolean' ? { causeRetryable: retryable } : {})
    }
  })
}
