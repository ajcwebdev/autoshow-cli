import { stripAnsi } from '~/utils/terminal-colors'
import { NETWORK_FAILURE_SPELLINGS, RETRYABLE_STATUS_CODES } from '~/utils/retries'
import { SUPADATA_PLAN_LIMIT_PATTERN } from '~/utils/supadata-plan-limit'

// Single source of truth for transient-failure detection across the test suite.
// Houses the generic pressure patterns consumed by the runner's adaptive classifier
// (classifyAdaptivePressure) and the provider-specific predicates consumed by the
// service kit's classifyLiveProviderAvailabilityFailure. Both classifiers stay separate
// and keep their distinct return types; only these building blocks are shared.
//
// The status codes and network spellings below are derived from production's own retry
// vocabulary rather than re-typed here. Hand-maintained copies had already drifted: the
// network pattern was missing three of production's socket-failure spellings, so a
// MiniMax run failing with a spelling production retries was denied its sanctioned retry.

const escapeForRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const RETRYABLE_STATUS_GROUP = RETRYABLE_STATUS_CODES.join('|')
const SERVER_ERROR_STATUS_GROUP = RETRYABLE_STATUS_CODES.filter((status) => status >= 500).join('|')

// --- Generic transient-pressure patterns (used by classifyAdaptivePressure) ---

export const RATE_LIMIT_PATTERN = /\b(?:429|too many requests|rate[-\s]?limit(?:ed|ing)?|(?<!non-)retryable status 429)\b/i
export const TIMEOUT_PATTERN = /\b(?:timed?\s*out|timeout|abort\/timeout|timeouterror|etimedout|deadline exceeded|sigterm)\b/i

/**
 * Transient evidence that stands on its own, independent of any retry-exhaustion banner.
 * `(?<!non-)` matters: "non-retryable status 500" is production refusing to retry, and the
 * old pattern read the tail of that phrase as a retryable status.
 */
const TRANSIENT_SIGNAL_PATTERN = new RegExp(
  `\\(5\\d\\d\\)|\\b(?:(?<!non-)retryable status (?:${SERVER_ERROR_STATUS_GROUP})|service unavailable|bad gateway|gateway timeout|internal server error|backend error|econnaborted|connection reset|max attempts reached|retry_exhausted|retry attempts? (?:were )?exhausted|${NETWORK_FAILURE_SPELLINGS.map(escapeForRegex).join('|')})\\b`,
  'i'
)

/** The stop reasons `withRetry` prints when it refused to retry rather than ran out of budget. */
const TERMINAL_STOP_REASON_PATTERN =
  /^(?:non-retryable status \d{3}|unexpected status \d{3}|error marked non-retryable|paid create outcome is ambiguous|paid create status \d{3} is not safe to redispatch|deterministic \w+ error|provider admission outcome is ambiguous|operation cancelled|non-schema failure)/i

const RETRY_EXHAUSTION_PATTERN = /failed after \d+\/\d+ attempts \(([^),]+)/gi

/**
 * True when a run's retry-exhaustion banner reports a transient stop reason. A run that
 * ended "failed after 2/4 attempts (non-retryable status 400, …)" is production's own
 * deterministic refusal: re-running the command re-spends the money and can mask a
 * request-shape regression for another two paid attempts.
 */
export const hasTransientRetryExhaustion = (output: string): boolean => {
  for (const match of output.matchAll(RETRY_EXHAUSTION_PATTERN)) {
    const stopReason = (match[1] ?? '').trim()
    if (!TERMINAL_STOP_REASON_PATTERN.test(stopReason)) {
      return true
    }
  }
  return false
}

export const isTransientPressureOutput = (output: string): boolean =>
  TRANSIENT_SIGNAL_PATTERN.test(output) || hasTransientRetryExhaustion(output)

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

const GEMINI_IMAGE_TEMP_STATUS_PATTERN = `\\b(?:429|${SERVER_ERROR_STATUS_GROUP})\\b`

const hasGeminiImageSignal = (output: string): boolean =>
  /\bgemini\b/i.test(output)
  && (
    /\bgemini-image(?:-generate)?\b/i.test(output)
    || /\bGemini image\b/i.test(output)
    || /\bgemini-[\w.\-]+-image(?:-preview)?\b/i.test(output)
  )

// Gemini image surface: transient availability on the image-generation endpoint, gated on an
// image signal and HTTP status text. Distinct from isGeminiLlmTransientUnavailable (LLM surface).
export const isGeminiImageAvailabilityFailure = (output: string): boolean => {
  if (!hasGeminiImageSignal(output)) return false

  const statusPattern = new RegExp(`(?:Gemini API request failed with status|retryable status|status)\\s+${GEMINI_IMAGE_TEMP_STATUS_PATTERN}`, 'i')
  if (statusPattern.test(output)) return true

  return new RegExp(`${GEMINI_IMAGE_TEMP_STATUS_PATTERN}[\\s\\S]{0,160}(?:service unavailable|temporar(?:y|ily) unavailable|rate limit|rate limited|gateway|backend)`, 'i').test(output)
}

// Gemini image refusal/filtering: a 200 response with no image part. Distinct from
// isGeminiImageAvailabilityFailure, which is gated on an HTTP status.
export const isGeminiImageEmptyResponse = (output: string): boolean =>
  hasGeminiImageSignal(output)
  && /\bno images?\s+(?:content in Gemini response|outputs? were generated|were generated by Gemini)/i.test(output)

// Supadata answers plan-quota exhaustion with 429 "Limit Exceeded". That is an account state,
// not a code regression, and no retry inside the run can clear it.
export const isSupadataPlanLimitFailure = (output: string): boolean =>
  /\bsupadata\b/i.test(output)
  && SUPADATA_PLAN_LIMIT_PATTERN.test(output)

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
    new RegExp(`"code"\\s*:\\s*(?:${RETRYABLE_STATUS_GROUP})\\b`).test(clean) ||
    /"status"\s*:\s*"UNAVAILABLE"/.test(clean) ||
    /currently experiencing high demand/i.test(clean)
  )
}

// The transport-level alternation shared by every provider predicate below, built from
// production's own list so a spelling cannot exist on one side and not the other.
const NETWORK_FAILURE_PATTERN = new RegExp(
  NETWORK_FAILURE_SPELLINGS.map(escapeForRegex).join('|'),
  'i'
)

export const isNetworkFailureOutput = (output: string): boolean =>
  NETWORK_FAILURE_PATTERN.test(stripAnsi(output))

export const isMinimaxTransientUnavailable = (output: string): boolean => {
  const clean = stripAnsi(output)
  return (
    /overloaded_error/i.test(clean) ||
    /\b529\b/.test(clean) ||
    /server is overloaded/i.test(clean) ||
    NETWORK_FAILURE_PATTERN.test(clean)
  )
}

/**
 * Task *creation* is deliberately absent from the retriable stages. It is a paid create,
 * and production refuses to redispatch one after a 408/5xx because the request may already
 * have been admitted (`classifyPaidCreateRetry`); re-running the whole command here would
 * perform exactly the redispatch production declined. The read-side stages carry no such
 * risk. Production's own rate-limit rejection (429) stays retriable at every stage.
 */
const MINIMAX_TTS_RETRIABLE_STAGE_PATTERN = new RegExp(
  `MiniMax TTS (?:task query|download) failed \\((?:${RETRYABLE_STATUS_CODES.join('|')})\\)`,
  'i'
)
const MINIMAX_TTS_REJECTED_CREATE_PATTERN = /MiniMax TTS task creation failed \((?:425|429)\)/i

export const isTransientMinimaxTtsFailure = (output: string): boolean => {
  const clean = stripAnsi(output)
  return (
    /minimax-tts-chunk-\d+: deadline exceeded/i.test(clean) ||
    MINIMAX_TTS_RETRIABLE_STAGE_PATTERN.test(clean) ||
    MINIMAX_TTS_REJECTED_CREATE_PATTERN.test(clean) ||
    NETWORK_FAILURE_PATTERN.test(clean)
  )
}

const isGroqTermsAcceptanceFailure = (output: string): boolean =>
  /requires terms acceptance/i.test(stripAnsi(output))

/**
 * Terminal per-service account states: no retry inside the run can clear them, so a suite
 * fails with the account-state message instead of a generic command failure. Adding a
 * provider quirk is a row here, not another branch in a test body.
 */
export const TERMINAL_TTS_FAILURES: Record<string, {
  matches: (output: string) => boolean
  describe: (model: string) => string
}> = {
  groq: {
    matches: isGroqTermsAcceptanceFailure,
    describe: (model) => `Groq terms acceptance is required for ${model}`,
  },
}
