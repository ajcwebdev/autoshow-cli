import type { RetryClass, RetryClassifier, RetryDecision } from '~/types'
import { extractErrorMetadata, ProviderError } from '~/utils/error-handler'
import { classifyFetchRetry } from '~/utils/retries'

const parseStatusFromGeminiError = (error: unknown): number | undefined => {
  if (error && typeof error === 'object') {
    if ('status' in error && typeof error.status === 'number') {
      return error.status
    }
    if ('code' in error && typeof error.code === 'number') {
      return error.code
    }
  }

  if (error instanceof Error) {
    const codeMatch = /"code"\s*:\s*(\d{3})/.exec(error.message)
    if (codeMatch) {
      const parsed = Number.parseInt(codeMatch[1] as string, 10)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return undefined
}

/**
 * Gemini reports the HTTP status inside the response body rather than on the error
 * object, so the shared classifier cannot see it. This restates the parsed status as a
 * structured field and then lets `classifyFetchRetry` apply the caller's retry class.
 *
 * The previous shape ran the conservative rule and then *overrode* its refusal for
 * 408/425/429/>=500, which meant a paid Gemini create redispatched after a 5xx — the
 * exact ambiguous-admission case the conservative tier exists to refuse — while its
 * logs and `retry_exhausted` metadata still claimed the conservative class. The class
 * now decides: conservative callers (image creates, LLM writes, TTS chunks) stop on a
 * 5xx, and the documented retriable tier (STT submissions, OCR requests) still retries.
 *
 * Defaults to the conservative class so a site that forgets to declare one gets the
 * safe posture rather than the spending one.
 */
export const classifyGeminiRetry = (
  error: unknown,
  retryClass: RetryClass = 'runtime_http_create_conservative'
): RetryDecision => {
  const metadata = extractErrorMetadata(error)
  const hasStructuredStatus = typeof metadata['status'] === 'number'
  const parsedStatus = hasStructuredStatus ? undefined : parseStatusFromGeminiError(error)

  if (parsedStatus === undefined) {
    return classifyFetchRetry(error, retryClass)
  }

  return classifyFetchRetry(
    ProviderError(error instanceof Error ? error.message : String(error), {
      status: parsedStatus,
      ...(error instanceof Error ? { cause: error } : {})
    }),
    retryClass
  )
}

export const createGeminiRetryClassifier = (retryClass: RetryClass): RetryClassifier =>
  (error) => classifyGeminiRetry(error, retryClass)
