import type { RetryClass, Step2Metadata, SupadataHttpError, SupadataStage } from '~/types'
import { ProviderError } from '~/utils/error-handler'
import { httpResponseError } from '~/utils/rest-client'
import { isSupadataPlanLimitExhausted } from '~/utils/supadata-plan-limit'
import { describeSupadataUnsupportedSource } from './supadata'
import { extractSupadataErrorMessage, isRecord } from './supadata-response-parsers'
export const buildSupadataUrl = (baseURL: string, path: string): string =>
  new URL(path.replace(/^\/+/, ''), baseURL.endsWith('/') ? baseURL : `${baseURL}/`).toString()

export const parseSupadataBillableRequests = (headers: Headers): number | undefined => {
  const raw = headers.get('x-billable-requests')
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return undefined
  }

  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

export const parsePersistedSupadataBilling = (value: unknown): Step2Metadata['billing'] | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const billing = isRecord(value['billing']) ? value['billing'] : undefined
  if (!billing) {
    return undefined
  }

  const parsed: NonNullable<Step2Metadata['billing']> = {}
  if (typeof billing['creditsUsed'] === 'number' && Number.isFinite(billing['creditsUsed']) && billing['creditsUsed'] >= 0) {
    parsed.creditsUsed = billing['creditsUsed']
  }
  if (typeof billing['creditRateCents'] === 'number' && Number.isFinite(billing['creditRateCents']) && billing['creditRateCents'] >= 0) {
    parsed.creditRateCents = billing['creditRateCents']
  }
  if (billing['source'] === 'response_header' || billing['source'] === 'registry_fallback') {
    parsed.source = billing['source']
  }

  return Object.keys(parsed).length > 0 ? parsed : undefined
}

export const toSupadataHttpError = (
  stage: SupadataStage,
  retryClass: RetryClass,
  response: Response,
  payload: unknown,
  messagePrefix = 'Supadata request failed'
): SupadataHttpError => {
  const message = extractSupadataErrorMessage(payload)
  return httpResponseError(
    `${messagePrefix} (${response.status}): ${message ?? 'Unknown error'}`,
    response,
    {
      stage,
      retryClass,
      rawResponse: payload,
      // Plan-quota exhaustion is terminal for this run; retrying only spends more
      // quota-denied requests. Burst 429s keep the default retryable behavior.
      ...(isSupadataPlanLimitExhausted(payload, message) ? { retryable: false } : {})
    } satisfies Pick<SupadataHttpError, 'stage' | 'retryClass' | 'rawResponse'> & { retryable?: false }
  )
}

export const attachSupadataErrorContext = (
  error: unknown,
  stage: SupadataStage,
  retryClass: RetryClass,
  rawResponse?: unknown
): never => {
  const source = error instanceof Error ? error : ProviderError(String(error))
  ;(source as SupadataHttpError).stage = stage
  ;(source as SupadataHttpError).retryClass = retryClass
  if (rawResponse !== undefined) {
    ;(source as SupadataHttpError).rawResponse = rawResponse
  }
  throw source
}

export const buildSupadataUnsupportedSourceError = (
  sourceUrl: string | undefined
): SupadataHttpError => Object.assign(
  ProviderError(describeSupadataUnsupportedSource(sourceUrl), { stage: 'create', retryable: false }),
  {
    stage: 'create' as const,
    retryable: false,
    // `skipped` stays an own property: `classifySttProviderFailure` reads it directly off
    // each chain entry rather than through `extractErrorMetadata`.
    skipped: true
  }
)
