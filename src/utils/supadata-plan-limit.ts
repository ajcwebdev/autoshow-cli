import { isRecord } from '~/utils/rest-client'

// Supadata answers both transient burst throttling and hard plan-quota exhaustion with HTTP 429.
// Only the burst case is worth retrying. When the body says the plan limit is exhausted the
// account has no requests left, so each retry spends another quota-denied request against the
// same exhausted plan and merely delays a failure that cannot recover within the run.
// Exported because the test suite had a second, drifted copy of this account-state
// knowledge; its predicate now matches on this pattern instead of its own.
export const SUPADATA_PLAN_LIMIT_PATTERN = /\blimit[-\s_]?exceeded\b|\bexceeded\b[\s\S]{0,40}\b(?:limit|quota|plan)\b|\bquota[-\s_]?(?:exceeded|exhausted)\b/i

const readErrorText = (payload: unknown): string[] => {
  if (typeof payload === 'string') return [payload]
  if (!isRecord(payload)) return []

  const fields = [payload['error'], payload['message'], payload['details']]
  const texts = fields.filter((field): field is string => typeof field === 'string')
  if (isRecord(payload['error']) && typeof payload['error']['message'] === 'string') {
    texts.push(payload['error']['message'])
  }
  return texts
}

/**
 * True when a Supadata response body reports plan/quota exhaustion rather than burst throttling.
 * Callers mark the resulting error `retryable: false` so the shared retry-on-any-error default
 * skips it (see the explicit-flag branch in `classifyFetchRetry`).
 */
export const isSupadataPlanLimitExhausted = (
  payload: unknown,
  message?: string | undefined
): boolean => {
  const candidates = readErrorText(payload)
  if (typeof message === 'string') candidates.push(message)
  return candidates.some((text) => SUPADATA_PLAN_LIMIT_PATTERN.test(text))
}
