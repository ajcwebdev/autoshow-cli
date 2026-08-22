import type { HappyScribeHttpError, HappyScribeStage, RetryClass } from '~/types'
import { httpResponseError, isRecord } from '~/utils/rest-client'
import { ProviderError } from '~/utils/error-handler'
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
): HappyScribeHttpError => Object.assign(
  httpResponseError(
    `${messagePrefix} (${response.status}): ${extractHappyScribeErrorMessage(payload) ?? 'Unknown error'}`,
    response,
    {
      stage,
      retryClass,
      rawResponse: payload
    } satisfies Pick<HappyScribeHttpError, 'stage' | 'retryClass' | 'rawResponse'>
  ),
  { headers: buildHappyScribeRetryHeaders(response, payload) }
)

export const attachHappyScribeErrorContext = (
  error: unknown,
  stage: HappyScribeStage,
  retryClass: RetryClass,
  rawResponse?: unknown
): never => {
  const source = error instanceof Error ? error : ProviderError(String(error))
  ;(source as HappyScribeHttpError).stage = stage
  ;(source as HappyScribeHttpError).retryClass = retryClass
  if (rawResponse !== undefined) {
    ;(source as HappyScribeHttpError).rawResponse = rawResponse
  }
  throw source
}
