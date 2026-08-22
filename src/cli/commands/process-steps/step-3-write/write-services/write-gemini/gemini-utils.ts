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
