import { stripAnsi } from '~/utils/terminal-colors'

// Single source of truth for transient-failure detection across the test suite.
// Houses the generic pressure patterns consumed by the runner's adaptive classifier
// (classifyAdaptivePressure) and the provider-specific predicates consumed by the
// service kit's classifyLiveProviderAvailabilityFailure. Both classifiers stay separate
// and keep their distinct return types; only these building blocks are shared.

// --- Generic transient-pressure patterns (used by classifyAdaptivePressure) ---

export const RATE_LIMIT_PATTERN = /\b(?:429|too many requests|rate[-\s]?limit(?:ed|ing)?|retryable status 429)\b/i
export const TIMEOUT_PATTERN = /\b(?:timed?\s*out|timeout|abort\/timeout|timeouterror|etimedout|deadline exceeded|sigterm)\b/i
export const TRANSIENT_PATTERN = /\(5\d\d\)|\b(?:retryable status 5\d\d|service unavailable|bad gateway|gateway timeout|internal server error|backend error|fetch failed|network error|econnreset|econnaborted|socket hang up|closed unexpectedly|connection reset|max attempts reached|retry_exhausted|retry attempts? (?:were )?exhausted|failed after \d+\/\d+ attempts)\b/i

// --- Provider-specific predicates (used by classifyLiveProviderAvailabilityFailure) ---

export const RUNWAY_INSUFFICIENT_CREDITS_MESSAGE = 'You do not have enough credits to run this task.'

const hasGlmSignal = (output: string): boolean =>
  /\bGLM\b/i.test(output)
  || /\bglm[-_](?:reader|ocr|llm|stt)\b/i.test(output)
  || /\bZ\.?AI\b/i.test(output)
  || /\bapi\.z\.ai\b/i.test(output)
  || /\bpaas\/v4\b/i.test(output)

export const isGlmAccountAvailabilityFailure = (output: string): boolean => {
  if (!hasGlmSignal(output)) return false
  return (
    /\b1113\b/.test(output) ||
    /insufficient\s+(?:account\s+)?balance/i.test(output) ||
    /balance\s+(?:is\s+)?(?:not\s+enough|insufficient)/i.test(output) ||
    /not\s+enough\s+balance/i.test(output) ||
    /no\s+(?:available\s+)?resource\s+package/i.test(output) ||
    /resource\s+package.{0,80}(?:not\s+found|unavailable|expired|exhausted|insufficient)/i.test(output)
  )
}

export const isGlmReaderRateLimitFailure = (output: string): boolean =>
  /GLM Reader request failed \(429\b/i.test(output)
  || /\bglm-reader\b[\s\S]{0,240}(?:\b429\b|too many requests|rate limit)/i.test(output)

export const isGlmCertificateExpiryFailure = (output: string): boolean =>
  hasGlmSignal(output)
  && (
    /\bcertificate\s+(?:has\s+)?expired\b/i.test(output) ||
    /\bCERT_HAS_EXPIRED\b/i.test(output)
  )

export const isGlmRetryable429Exhaustion = (output: string): boolean =>
  /retryable status 429/i.test(output)
  && (/\bglm-(?:ocr|llm)\b/i.test(output) || /GLM (?:OCR|model)/i.test(output))
  && (/\bfailed after \d+(?:\/\d+)? attempts\b/i.test(output) || /\bCommand failed\b/i.test(output))

export const isDeepInfraWhisperLargeV3CommandTimeout = (output: string): boolean =>
  /\bdeepinfra\b/i.test(output)
  && /openai\/whisper-large-v3(?!-turbo)\b/i.test(output)
  && (
    /\bcommand\b[\s\S]{0,120}\btimed?\s*out\b/i.test(output) ||
    /\bsubprocess\b[\s\S]{0,120}\btimed?\s*out\b/i.test(output) ||
    /\btimed?\s*out\b/i.test(output) ||
    /\btimeout\b/i.test(output) ||
    /\bSIGTERM\b/i.test(output) ||
    /\bexit(?:ed)?(?:\s+with)?(?:\s+code)?\s*(?:143|-15)\b/i.test(output)
  )

const GEMINI_IMAGE_TEMP_STATUS_PATTERN = '\\b(?:429|500|502|503|504)\\b'

const hasGeminiImageSignal = (output: string): boolean =>
  /\bgemini\b/i.test(output)
  && (
    /\bgemini-image(?:-generate)?\b/i.test(output)
    || /\bGemini image\b/i.test(output)
    || /\bgemini-[\w.\-]+-image-preview\b/i.test(output)
  )

// Gemini image surface: transient availability on the image-generation endpoint, gated on an
// image signal and HTTP status text. Distinct from isGeminiLlmTransientUnavailable (LLM surface).
export const isGeminiImageAvailabilityFailure = (output: string): boolean => {
  if (!hasGeminiImageSignal(output)) return false

  const statusPattern = new RegExp(`(?:Gemini API request failed with status|retryable status|status)\\s+${GEMINI_IMAGE_TEMP_STATUS_PATTERN}`, 'i')
  if (statusPattern.test(output)) return true

  return new RegExp(`${GEMINI_IMAGE_TEMP_STATUS_PATTERN}[\\s\\S]{0,160}(?:service unavailable|temporar(?:y|ily) unavailable|rate limit|rate limited|gateway|backend)`, 'i').test(output)
}

const hasBflImageSignal = (output: string): boolean =>
  /\bBFL\b/i.test(output)
  || /\bbfl-image\b/i.test(output)
  || /\bflux-2-/i.test(output)

export const isBflResultDownloadAvailabilityFailure = (output: string): boolean => {
  if (!hasBflImageSignal(output)) return false
  if (/BFL image result download failed \(504\)/i.test(output)) return true
  if (
    /\bbfl-image-result-download\b[\s\S]{0,240}\bfailed after \d+\/\d+ attempts\b/i.test(output)
    && /(?:max attempts reached|retryable status 504|gateway timeout|network error|abort\/timeout)/i.test(output)
  ) {
    return true
  }
  return /\bbfl-image-result-download\b[\s\S]{0,240}(?:retryable status 504|status 504|gateway timeout|network error|abort\/timeout)/i.test(output)
}

const hasTogetherSttSignal = (output: string): boolean =>
  /\btogether\b/i.test(output)
  && (
    /\btogether-stt\b/i.test(output)
    || /Together transcription/i.test(output)
    || /\bopenai\/whisper-large-v3\b/i.test(output)
  )

export const isTogetherSttAvailabilityFailure = (output: string): boolean => {
  if (!hasTogetherSttSignal(output)) return false

  return (
    /\btogether-stt[\s\S]{0,240}\bfailed after \d+\/\d+ attempts\b/i.test(output) ||
    /Together transcription failed \(503\)/i.test(output) ||
    /(?:retryable status 503|status 503|service[-\s]?unavailable|socket connection was closed unexpectedly|socket hang up|fetch failed|network error|econnreset|closed unexpectedly)/i.test(output)
  )
}

// Gemini LLM surface: transient availability on the text-generation endpoint, matched on the
// JSON error shape / high-demand wording. Distinct from isGeminiImageAvailabilityFailure.
export const isGeminiLlmTransientUnavailable = (output: string): boolean => {
  const clean = stripAnsi(output)
  return (
    /"code"\s*:\s*(408|425|429|500|502|503|504)\b/.test(clean) ||
    /"status"\s*:\s*"UNAVAILABLE"/.test(clean) ||
    /currently experiencing high demand/i.test(clean)
  )
}

export const isMinimaxTransientUnavailable = (output: string): boolean => {
  const clean = stripAnsi(output)
  return (
    /overloaded_error/i.test(clean) ||
    /\b529\b/.test(clean) ||
    /server is overloaded/i.test(clean) ||
    /fetch failed|network error|econnreset|econnrefused|etimedout|socket hang up|dns/i.test(clean)
  )
}
