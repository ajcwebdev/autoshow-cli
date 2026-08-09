import { isNativeUsageError, nativeUsageMessage } from '~/cli/native/native-errors'
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
  constructor(message: string, hints?: string[]) {
    super(message, { kind: 'usage', exitCode: 2, ...(hints ? { hints } : {}) })
    this.name = 'CLIUsageError'
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

export const CLIUsageError = (
  message: string,
  hint?: string
): Error => new AppUsageError(message, hint ? [hint] : undefined)

export const InfraError = (
  message: string,
  options: Omit<AppErrorOptions, 'kind'> = {}
): AppInfrastructureError => new AppInfrastructureError(message, options)

export const InternalError = (
  message: string,
  options: Omit<AppErrorOptions, 'kind'> = {}
): AppInternalError => new AppInternalError(message, options)

export const ValidationError = (
  message: string,
  options: Omit<AppErrorOptions, 'kind'> = {}
): AppValidationError => new AppValidationError(message, options)

const MISSING_ENV_HINTS: Readonly<Record<string, string>> = {
  OPENAI_API_KEY: 'Set OPENAI_API_KEY environment variable to use OpenAI models',
  GEMINI_API_KEY: 'Set GEMINI_API_KEY environment variable to use Gemini models',
  GROQ_API_KEY: 'Set GROQ_API_KEY environment variable to use Groq models',
  GLM_API_KEY: 'Set GLM_API_KEY environment variable to use GLM models',
  DEEPINFRA_API_KEY: 'Set DEEPINFRA_API_KEY environment variable to use DeepInfra transcription',
  ANTHROPIC_API_KEY: 'Set ANTHROPIC_API_KEY environment variable to use Anthropic Claude models',
  MINIMAX_API_KEY: 'Set MINIMAX_API_KEY environment variable to use MiniMax models',
  ELEVENLABS_API_KEY: 'Set ELEVENLABS_API_KEY environment variable to use ElevenLabs transcription/TTS/music',
  SPEECHMATICS_API_KEY: 'Set SPEECHMATICS_API_KEY environment variable to use Speechmatics transcription',
  REVAI_ACCESS_TOKEN: 'Set REVAI_ACCESS_TOKEN environment variable to use Rev transcription',
  GLADIA_API_KEY: 'Set GLADIA_API_KEY environment variable to use Gladia transcription',
  HAPPYSCRIBE_API_KEY: 'Set HAPPYSCRIBE_API_KEY environment variable to use Happy Scribe transcription',
  SUPADATA_API_KEY: 'Set SUPADATA_API_KEY environment variable to use Supadata transcription',
  SCRAPECREATORS_API_KEY: 'Set SCRAPECREATORS_API_KEY environment variable to use ScrapeCreators YouTube transcript retrieval',
  LUMA_AGENTS_API_KEY: 'Set LUMA_AGENTS_API_KEY environment variable to use Luma Labs image/video generation'
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
    throw CLIUsageError(error instanceof Error ? error.message : String(error), fallbackHint)
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

export const isUsageError = (error: unknown): boolean => {
  return (
    isCLIUsageError(error) ||
    isNativeUsageError(error)
  )
}

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
    return error.message
  }
  const nativeMessage = nativeUsageMessage(error)
  if (nativeMessage !== undefined) return nativeMessage
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
