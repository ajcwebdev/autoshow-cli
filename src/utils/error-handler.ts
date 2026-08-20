import { sanitizeLogMetadata, sanitizeLogText } from '~/utils/app-logger/redaction'
import type { AppErrorKind, AppErrorOptions, ErrorChainEntry, RetryClass } from '~/types'
const DEFAULT_EXIT_CODE_BY_KIND: Readonly<Record<AppErrorKind, number>> = {
  usage: 2,
  provider_http: 1,
  retry_exhausted: 1,
  validation: 1,
  infrastructure: 1,
  internal: 1
}

const normalizePositiveExitCode = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined

export class AppError extends Error {
  readonly kind: AppErrorKind
  readonly hints: string[]
  readonly exitCode: number
  readonly status?: number
  readonly headers?: Headers
  readonly stage?: string
  readonly retryClass?: RetryClass
  readonly retryable?: boolean
  readonly metadata: Record<string, unknown>
  override cause?: Error

  constructor(message: string, options: AppErrorOptions) {
    super(message, options.cause ? { cause: options.cause } : undefined)
    this.name = 'AppError'
    this.kind = options.kind
    this.hints = [...(options.hints ?? [])]
    this.exitCode = normalizePositiveExitCode(options.exitCode) ?? DEFAULT_EXIT_CODE_BY_KIND[options.kind]
    this.metadata = { ...(options.metadata ?? {}) }

    if (options.cause) this.cause = options.cause
    if (typeof options.status === 'number') this.status = options.status
    if (options.headers instanceof Headers) this.headers = options.headers
    if (options.stage !== undefined) this.stage = options.stage
    if (options.retryClass !== undefined) this.retryClass = options.retryClass
    if (typeof options.retryable === 'boolean') this.retryable = options.retryable
  }
}

export class AppUsageError extends AppError {
  // The phrasing the top-level handler prints on the "Usage error: …" line. Defaults to
  // `message`; subclasses (notably the native parser errors) set a longer form that adds
  // the follow-up command without changing the message the throw site chose.
  readonly usageMessage: string

  constructor(
    message: string,
    hints?: string[],
    options: {
      usageMessage?: string
      cause?: Error | undefined
      // Usage errors carry the same structural fields as every other kind: the credential
      // gate needs `stage`/`retryable`/`metadata.missingEnvVar` on the error it throws, and
      // reaching them through a post-construction `Object.assign` bypassed the constructor
      // that normalizes them.
      stage?: string
      retryable?: boolean
      metadata?: Record<string, unknown>
    } = {}
  ) {
    super(message, {
      kind: 'usage',
      exitCode: 2,
      ...(hints ? { hints } : {}),
      ...(options.cause ? { cause: options.cause } : {}),
      ...(options.stage !== undefined ? { stage: options.stage } : {}),
      ...(typeof options.retryable === 'boolean' ? { retryable: options.retryable } : {}),
      ...(options.metadata ? { metadata: options.metadata } : {})
    })
    this.name = 'AppUsageError'
    this.usageMessage = options.usageMessage ?? message
  }
}

export class AppValidationError extends AppError {
  constructor(message: string, options: Omit<AppErrorOptions, 'kind'> = {}) {
    super(message, { ...options, kind: 'validation' })
    this.name = 'AppValidationError'
  }
}

export class AppProviderError extends AppError {
  constructor(message: string, options: Omit<AppErrorOptions, 'kind'> = {}) {
    super(message, { ...options, kind: 'provider_http' })
    this.name = 'AppProviderError'
  }
}

export class AppInfrastructureError extends AppError {
  constructor(message: string, options: Omit<AppErrorOptions, 'kind'> = {}) {
    super(message, { ...options, kind: 'infrastructure' })
    this.name = 'AppInfrastructureError'
  }
}

export class AppInternalError extends AppError {
  constructor(message: string, options: Omit<AppErrorOptions, 'kind'> = {}) {
    super(message, { ...options, kind: 'internal' })
    this.name = 'AppInternalError'
  }
}

// `cause` matters even for usage errors: a re-wrap that drops it leaves `collectErrorChain`
// with a one-element chain, so the underlying failure never reaches diagnostics.
export const CLIUsageError = (
  message: string,
  hint?: string,
  options: { cause?: Error | undefined } = {}
): Error => new AppUsageError(
  message,
  hint ? [hint] : undefined,
  options.cause ? { cause: options.cause } : {}
)

export const InfraError = (
  message: string,
  options: Omit<AppErrorOptions, 'kind'> = {}
): AppInfrastructureError => new AppInfrastructureError(message, options)

export const ProviderError = (
  message: string,
  options: Omit<AppErrorOptions, 'kind'> = {}
): AppProviderError => new AppProviderError(message, options)

export const InternalError = (
  message: string,
  options: Omit<AppErrorOptions, 'kind'> = {}
): AppInternalError => new AppInternalError(message, options)

export const ValidationError = (
  message: string,
  options: Omit<AppErrorOptions, 'kind'> = {}
): AppValidationError => new AppValidationError(message, options)

// Covers every variable in HOSTED_PROVIDER_ENV_CHECKS; the env-example drift
// contract pins the two sets together so a new provider registers a hint too.
export const MISSING_ENV_HINTS: Readonly<Record<string, string>> = {
  OPENAI_API_KEY: 'Set OPENAI_API_KEY environment variable to use OpenAI models (https://platform.openai.com/api-keys)',
  XAI_API_KEY: 'Set XAI_API_KEY environment variable to use Grok models (https://console.x.ai/)',
  GEMINI_API_KEY: 'Set GEMINI_API_KEY environment variable to use Gemini models (https://aistudio.google.com/apikey)',
  GROQ_API_KEY: 'Set GROQ_API_KEY environment variable to use Groq models (https://console.groq.com/keys)',
  GLM_API_KEY: 'Set GLM_API_KEY environment variable to use GLM models (https://docs.z.ai/)',
  KIMI_API_KEY: 'Set KIMI_API_KEY environment variable to use Kimi models (https://platform.moonshot.ai/)',
  CEREBRAS_API_KEY: 'Set CEREBRAS_API_KEY environment variable to use Cerebras models (https://cloud.cerebras.ai/)',
  TOGETHER_API_KEY: 'Set TOGETHER_API_KEY environment variable to use Together models (https://api.together.ai/)',
  ANTHROPIC_API_KEY: 'Set ANTHROPIC_API_KEY environment variable to use Anthropic Claude models (https://console.anthropic.com/settings/keys)',
  MINIMAX_API_KEY: 'Set MINIMAX_API_KEY environment variable to use MiniMax models (https://platform.minimax.io/)',
  MISTRAL_API_KEY: 'Set MISTRAL_API_KEY environment variable to use Mistral transcription/OCR/TTS (https://console.mistral.ai/api-keys)',
  DEEPINFRA_API_KEY: 'Set DEEPINFRA_API_KEY environment variable to use DeepInfra transcription/OCR/TTS (https://deepinfra.com/)',
  ASSEMBLYAI_API_KEY: 'Set ASSEMBLYAI_API_KEY environment variable to use AssemblyAI transcription (https://www.assemblyai.com/dashboard/signup)',
  DEEPGRAM_API_KEY: 'Set DEEPGRAM_API_KEY environment variable to use Deepgram transcription/TTS (https://console.deepgram.com/project/api-keys)',
  SONIOX_API_KEY: 'Set SONIOX_API_KEY environment variable to use Soniox transcription (https://console.soniox.com)',
  ELEVENLABS_API_KEY: 'Set ELEVENLABS_API_KEY environment variable to use ElevenLabs transcription/TTS/music (https://elevenlabs.io/)',
  SPEECHMATICS_API_KEY: 'Set SPEECHMATICS_API_KEY environment variable to use Speechmatics transcription (https://portal.speechmatics.com)',
  REVAI_ACCESS_TOKEN: 'Set REVAI_ACCESS_TOKEN environment variable to use Rev transcription (https://www.rev.ai/)',
  GLADIA_API_KEY: 'Set GLADIA_API_KEY environment variable to use Gladia transcription (https://app.gladia.io/apikeys)',
  HAPPYSCRIBE_API_KEY: 'Set HAPPYSCRIBE_API_KEY environment variable to use Happy Scribe transcription (https://www.happyscribe.com/)',
  SUPADATA_API_KEY: 'Set SUPADATA_API_KEY environment variable to use Supadata transcription and URL extraction (https://supadata.ai/)',
  SCRAPECREATORS_API_KEY: 'Set SCRAPECREATORS_API_KEY environment variable to use ScrapeCreators YouTube transcript retrieval (https://scrapecreators.com/)',
  FIRECRAWL_API_KEY: 'Set FIRECRAWL_API_KEY environment variable to use Firecrawl URL extraction (https://www.firecrawl.dev/)',
  SPIDER_API_KEY: 'Set SPIDER_API_KEY environment variable to use Spider URL extraction (https://spider.cloud/)',
  ZYTE_API_KEY: 'Set ZYTE_API_KEY environment variable to use Zyte URL extraction (https://www.zyte.com/)',
  SPEECHIFY_API_KEY: 'Set SPEECHIFY_API_KEY environment variable to use Speechify TTS (https://console.speechify.com/)',
  HUME_API_KEY: 'Set HUME_API_KEY environment variable to use Hume TTS (https://platform.hume.ai/)',
  CARTESIA_API_KEY: 'Set CARTESIA_API_KEY environment variable to use Cartesia TTS (https://play.cartesia.ai/)',
  FISH_API_KEY: 'Set FISH_API_KEY environment variable to use Fish Audio TTS (https://fish.audio/)',
  INWORLD_API_KEY: 'Set INWORLD_API_KEY environment variable to use Inworld AI TTS (https://inworld.ai/)',
  LTXV_API_KEY: 'Set LTXV_API_KEY environment variable to use LTX video generation (https://docs.ltx.video/)',
  BFL_API_KEY: 'Set BFL_API_KEY environment variable to use BFL image generation (https://dashboard.bfl.ai/)',
  LUMA_AGENTS_API_KEY: 'Set LUMA_AGENTS_API_KEY environment variable to use Luma Labs image/video generation (https://platform.lumalabs.ai/)',
  REPLICATE_API_TOKEN: 'Set REPLICATE_API_TOKEN environment variable to use Replicate OCR/image/video/TTS (https://replicate.com/)',
  FAL_API_KEY: 'Set FAL_API_KEY environment variable to use fal.ai OCR/image/video/TTS (https://fal.ai/dashboard/keys)',
  STABILITY_API_KEY: 'Set STABILITY_API_KEY environment variable to use Stability AI sound effects (https://platform.stability.ai/account/keys)',
  X_BEARER_TOKEN: 'Set X_BEARER_TOKEN environment variable to use X/Twitter Spaces; create a Bearer Token at https://developer.x.com/en/portal/dashboard'
}

/**
 * Structured remediation hint(s) for a missing environment variable. Keeps the
 * env-var wording centralized so throw sites can attach `hints: hintsForMissingEnv(key)`.
 */
export const hintsForMissingEnv = (key: string): string[] => [
  MISSING_ENV_HINTS[key] ?? `Set ${key} environment variable to use this provider`
]

export const isAppError = (error: unknown): error is AppError =>
  error instanceof AppError

export const isCLIUsageError = (error: unknown): error is AppUsageError =>
  error instanceof AppUsageError

/**
 * The one filesystem/system errno check. ENOENT in particular used to be detected three
 * different ways (this predicate defined twice locally, plus a `/does not exist|no such
 * file/` message regex), so a probe could silently classify differently depending on which
 * spelling the call site happened to use.
 */
export const hasErrorCode = (error: unknown, code: string): boolean =>
  typeof error === 'object'
  && error !== null
  && 'code' in error
  && (error as { code?: unknown }).code === code

/**
 * Runs `fn` and re-wraps any non-usage throw as a `CLIUsageError` (usage errors pass
 * through untouched). Consolidates the validator-wrapping idiom at command boundaries.
 */
export function rethrowAsUsage<T>(fn: () => Promise<T>, fallbackHint?: string): Promise<T>
export function rethrowAsUsage<T>(fn: () => T, fallbackHint?: string): T
export function rethrowAsUsage<T>(
  fn: () => T | Promise<T>,
  fallbackHint?: string
): T | Promise<T> {
  const wrap = (error: unknown): never => {
    if (isCLIUsageError(error)) {
      throw error
    }
    throw CLIUsageError(
      error instanceof Error ? error.message : String(error),
      fallbackHint,
      error instanceof Error ? { cause: error } : {}
    )
  }
  try {
    const result = fn()
    if (result instanceof Promise) {
      return result.catch(wrap)
    }
    return result
  } catch (error) {
    return wrap(error)
  }
}

// The whole usage family now extends AppUsageError, so one instanceof check covers it;
// the native-parser duck-type bridge this used to need is gone.
export const isUsageError = (error: unknown): boolean => isCLIUsageError(error)

export const normalizeExitCode = (error: unknown): number => {
  if (isAppError(error)) {
    return error.exitCode
  }

  if (error instanceof Error && 'exitCode' in error) {
    const exitCode = (error as Error & { exitCode?: unknown }).exitCode
    const normalized = normalizePositiveExitCode(exitCode)
    if (normalized !== undefined) {
      return normalized
    }
  }
  return isUsageError(error) ? 2 : 1
}

export const usageMessage = (error: unknown): string => {
  if (isCLIUsageError(error)) {
    return error.usageMessage
  }
  return 'Invalid command usage. Run: bun autoshow --help'
}

export const collectErrorChain = (error: unknown): ErrorChainEntry[] => {
  const chain: ErrorChainEntry[] = []
  const seen = new Set<unknown>()
  let current: unknown = error

  while (current instanceof Error && !seen.has(current)) {
    chain.push(current as ErrorChainEntry)
    seen.add(current)
    current = current.cause
  }

  return chain
}

const PROVIDER_METADATA_KEYS = [
  'status',
  'stage',
  'retryClass',
  'retryable',
  'category',
  'headers',
  'body',
  'rawResponse',
  'rawResponseFile',
  'errorFile',
  'code',
  'param',
  'type',
  'error',
  'errorType',
  'responseType'
] as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const addMetadataValue = (
  out: Record<string, unknown>,
  key: string,
  value: unknown
): void => {
  if (value !== undefined && out[key] === undefined) {
    out[key] = value
  }
}

export const extractErrorMetadata = (error: unknown): Record<string, unknown> => {
  const metadata: Record<string, unknown> = {}

  for (const entry of collectErrorChain(error)) {
    if (isAppError(entry)) {
      for (const [key, value] of Object.entries(entry.metadata)) {
        addMetadataValue(metadata, key, value)
      }
    }

    for (const key of PROVIDER_METADATA_KEYS) {
      addMetadataValue(metadata, key, entry[key])
    }

    for (const [key, value] of Object.entries(entry)) {
      if (
        key === 'name'
        || key === 'message'
        || key === 'stack'
        || key === 'cause'
        || key === 'kind'
        || key === 'hints'
        || key === 'exitCode'
        || key === 'metadata'
      ) {
        continue
      }
      addMetadataValue(metadata, key, value)
    }
  }

  return metadata
}

const keyedHintsFor = (error: unknown, metadata: Record<string, unknown>): string[] => {
  const hints: string[] = []
  const status = typeof metadata['status'] === 'number' ? metadata['status'] : undefined
  const category = typeof metadata['category'] === 'string' ? metadata['category'] : undefined

  if (isAppError(error)) {
    if (error.kind === 'usage') {
      hints.push(...error.hints)
    }
    if (error.kind === 'provider_http' && status === 429) {
      hints.push('The provider rate-limited the request. Retry later or reduce provider concurrency.')
    }
    if (error.kind === 'retry_exhausted') {
      hints.push('Retry attempts were exhausted. Check the provider diagnostics for the final failure.')
    }
  }

  if (status === 401 || status === 403 || category === 'auth') {
    hints.push('Check the provider credentials and setup for the selected service.')
  }
  if (status === 429 || category === 'rate_limit') {
    hints.push('The provider is rate limiting requests. Retry later or lower concurrency.')
  }

  return hints
}

export const extractErrorHints = (error: unknown): string[] => {
  const hints: string[] = []
  const emitted = new Set<string>()
  const addHint = (hint: string | undefined): void => {
    if (hint && !emitted.has(hint)) {
      emitted.add(hint)
      hints.push(hint)
    }
  }

  if (isAppError(error)) {
    for (const hint of error.hints) {
      addHint(hint)
    }
  }

  const metadata = extractErrorMetadata(error)
  for (const hint of keyedHintsFor(error, metadata)) {
    addHint(hint)
  }

  return hints
}

const toDiagnosticValue = (
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>()
): unknown => {
  if (
    value === null
    || value === undefined
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value
  }

  if (typeof value === 'bigint') {
    return value.toString()
  }

  if (depth > 5) {
    return '[Truncated]'
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (value instanceof URL) {
    return value.toString()
  }

  if (value instanceof Headers) {
    return Object.fromEntries(value.entries())
  }

  if (value instanceof Error) {
    return serializeError(value, depth, seen)
  }

  if (Array.isArray(value)) {
    return value.map(item => toDiagnosticValue(item, depth + 1, seen))
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]'
    }
    seen.add(value)
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        toDiagnosticValue(entry, depth + 1, seen)
      ])
    )
  }

  return String(value)
}

const serializeError = (
  error: Error,
  depth = 0,
  seen = new WeakSet<object>()
): Record<string, unknown> => {
  if (seen.has(error)) {
    return { name: error.name, message: '[Circular]' }
  }
  seen.add(error)

  const out: Record<string, unknown> = {
    name: error.name,
    message: error.message
  }

  if (error.stack) {
    out['stack'] = error.stack
  }

  if (isRecord(error)) {
    for (const [key, value] of Object.entries(error)) {
      if (key === 'name' || key === 'message' || key === 'stack' || key === 'cause') {
        continue
      }
      out[key] = toDiagnosticValue(value, depth + 1, seen)
    }
  }

  if ('cause' in error && error.cause !== undefined) {
    out['cause'] = toDiagnosticValue(error.cause, depth + 1, seen)
  }

  return out
}

export const serializeDiagnosticError = (error: unknown): Record<string, unknown> => {
  const raw = error instanceof Error
    ? serializeError(error)
    : toDiagnosticValue(error)
  const normalized = isRecord(raw) ? raw : { value: raw }
  const sanitized = sanitizeLogMetadata(normalized)
  return isRecord(sanitized)
    ? sanitized
    : { value: sanitizeLogText(String(sanitized)) }
}
