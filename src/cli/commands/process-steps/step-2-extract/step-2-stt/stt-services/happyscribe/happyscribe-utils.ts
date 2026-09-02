import type { HappyScribeHttpError, HappyScribeStage, RetryClass } from '~/types'
import { httpResponseError, httpResponseOptions, isRecord } from '~/utils/rest-client'
import { annotateAppError } from '~/utils/error-handler'
import { isRetryableStatus } from '~/utils/retries'
export { isRecord }

export const normalizeHappyScribeId = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return undefined
}

export const parseHappyScribeNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value)
    ? value
    : typeof value === 'string'
      ? (() => {
          const parsed = Number.parseFloat(value)
          return Number.isFinite(parsed) ? parsed : undefined
        })()
      : undefined

export const extractHappyScribeErrorMessage = (payload: unknown): string | undefined => {
  if (typeof payload === 'string') {
    const trimmed = payload.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  if (!isRecord(payload)) {
    return undefined
  }

  for (const key of ['message', 'error', 'detail', 'failureMessage', 'failureReason'] as const) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }

  return undefined
}

export const buildHappyScribeRetryHeaders = (
  response: Response,
  payload: unknown
): Headers => {
  const headers = new Headers(response.headers)
  if (!headers.has('retry-after') && isRecord(payload)) {
    const retryInSeconds = parseHappyScribeNumber(payload['retry_in_seconds'])
    if (typeof retryInSeconds === 'number' && retryInSeconds >= 0) {
      headers.set('retry-after', String(retryInSeconds))
    }
  }
  return headers
}

export const toHappyScribeHttpError = (
  stage: HappyScribeStage,
  retryClass: RetryClass,
  response: Response,
  payload: unknown,
  messagePrefix = 'Happy Scribe request failed'
): HappyScribeHttpError =>
  httpResponseError(
    `${messagePrefix} (${response.status}): ${extractHappyScribeErrorMessage(payload) ?? 'Unknown error'}`,
    httpResponseOptions(response, {
      stage,
      retryClass,
      headers: buildHappyScribeRetryHeaders(response, payload),
      retryable: retryClass === 'runtime_http_create_conservative'
        ? response.status === 425 || response.status === 429
        : isRetryableStatus(response.status),
      metadata: { rawResponse: payload }
    })
  )

export const attachHappyScribeErrorContext = (
  error: unknown,
  stage: HappyScribeStage,
  retryClass: RetryClass,
  rawResponse?: unknown
): never => {
  throw annotateAppError(error, {
    kind: 'provider_http',
    stage,
    retryClass,
    metadata: {
      stage,
      retryClass,
      ...(rawResponse !== undefined ? { rawResponse } : {})
    }
  })
}
