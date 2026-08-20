import { classifyOcrProviderFailure } from '../ocr-run-state'
import { getErrorMessage, getErrorStatus } from './pdf-chunk-fallback-shared'

// Message-matching by design: these classify *provider* prose, which has no structured
// counterpart. The upstream sources are the hosted OCR providers' HTTP error bodies
// (OpenAI/Anthropic/Gemini/Mistral/Kimi) plus their gateway text — the wording is theirs,
// not ours, so a regex is the only available signal. Errors this repo raises are classified
// on `AppError` kind/retryable above instead.
const NON_FALLBACK_MESSAGE_PATTERN = /(?:api key|environment variable is required|auth(?:entication|orization)?|unauthori[sz]ed|forbidden|invalid api key|permission denied|access denied|credential|not configured|setup failed|bucket is required|project id|processor id|content (?:filter|filtering|policy)|blocked by content|safety|policy violation|encrypted|decrypt|unsupported .*format|only supports .*image|convert .*image)/i
const FALLBACK_MESSAGE_PATTERN = /(?:timed out|timeout|deadline exceeded|temporar(?:y|ily)|network|connection|socket|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|rate limit|too many requests|overloaded|unavailable|malformed|invalid json|not valid json|schema|returned \d+ pages|non-contiguous|no pages|no text output|exceeds|too large|supports .* up to|file upload limit|page(?:s)? .*limit|maximum|payload too large|413|split .*smaller chunks?)/i

export const shouldFallbackToOcrPdfChunks = (error: unknown): boolean => {
  const message = getErrorMessage(error)
  const failure = classifyOcrProviderFailure(error)
  if (failure.retryable === false && failure.providerWide === true) {
    return false
  }
  if (NON_FALLBACK_MESSAGE_PATTERN.test(message)) {
    return false
  }

  const status = getErrorStatus(error)
  if (typeof status === 'number') {
    if (status === 401 || status === 403) {
      return false
    }
    if (status === 408 || status === 425 || status === 429 || status === 413 || status >= 500) {
      return true
    }
  }

  return FALLBACK_MESSAGE_PATTERN.test(message)
}
