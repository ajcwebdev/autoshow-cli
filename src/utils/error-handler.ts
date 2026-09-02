import { sanitizeLogMetadata, sanitizeLogText } from '~/utils/app-logger/redaction'
import type { AppErrorKind, AppErrorOptions, ErrorChainEntry, NonUsageAppErrorOptions, RetryClass, UsageErrorOptions } from '~/types'
import { isRecord } from '~/utils/value-helpers'

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
  readonly stage: string
  readonly retryClass?: RetryClass
  readonly retryable?: boolean
  readonly metadata: Record<string, unknown>
  override cause?: unknown

  constructor(message: string, options: AppErrorOptions) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'AppError'
    this.kind = options.kind
    this.hints = [...(options.hints ?? [])]
    this.exitCode = normalizePositiveExitCode(options.exitCode) ?? DEFAULT_EXIT_CODE_BY_KIND[options.kind]
    this.metadata = { ...(options.metadata ?? {}) }

    if (options.cause !== undefined) this.cause = options.cause
    if (typeof options.status === 'number') this.status = options.status
    if (options.headers instanceof Headers) this.headers = options.headers
    this.stage = options.stage
    if (options.retryClass !== undefined) this.retryClass = options.retryClass
    if (typeof options.retryable === 'boolean') this.retryable = options.retryable
  }
}

export class AppUsageError extends AppError {
  readonly usageMessage: string

  constructor(
    message: string,
    options: UsageErrorOptions = {}
  ) {
    super(message, {
      kind: 'usage',
      exitCode: 2,
      ...(options.hints ? { hints: options.hints } : {}),
      ...(options.cause !== undefined ? { cause: options.cause } : {}),
      stage: options.stage ?? 'cli:usage',
      retryable: options.retryable ?? false,
      ...(options.metadata ? { metadata: options.metadata } : {})
    })
    this.name = 'AppUsageError'
    this.usageMessage = options.usageMessage ?? message
  }
}

export class AppValidationError extends AppError {
  constructor(message: string, options: NonUsageAppErrorOptions = {}) {
    super(message, { ...options, kind: 'validation', stage: options.stage ?? 'validation', retryable: options.retryable ?? false })
    this.name = 'AppValidationError'
  }
}

export class AppProviderError extends AppError {
  constructor(message: string, options: NonUsageAppErrorOptions = {}) {
    super(message, { ...options, kind: 'provider_http', stage: options.stage ?? 'provider' })
    this.name = 'AppProviderError'
  }
}

export class AppInfrastructureError extends AppError {
  constructor(message: string, options: NonUsageAppErrorOptions = {}) {
    super(message, { ...options, kind: 'infrastructure', stage: options.stage ?? 'infrastructure' })
    this.name = 'AppInfrastructureError'
  }
}

class AppInternalError extends AppError {
  constructor(message: string, options: NonUsageAppErrorOptions = {}) {
    super(message, { ...options, kind: 'internal', stage: options.stage ?? 'internal', retryable: options.retryable ?? false })
    this.name = 'AppInternalError'
  }
}

export const UsageError = (
  message: string,
  options: UsageErrorOptions = {}
): AppUsageError => new AppUsageError(message, options)

export const InfraError = (
  message: string,
  options: NonUsageAppErrorOptions = {}
): AppInfrastructureError => new AppInfrastructureError(message, options)

export const ProviderError = (
  message: string,
  options: NonUsageAppErrorOptions = {}
): AppProviderError => new AppProviderError(message, options)

export const InternalError = (
  message: string,
  options: NonUsageAppErrorOptions = {}
): AppInternalError => new AppInternalError(message, options)

export const ValidationError = (
  message: string,
  options: NonUsageAppErrorOptions = {}
): AppValidationError => new AppValidationError(message, options)

export const isAppError = (error: unknown): error is AppError =>
  error instanceof AppError

export const isUsageError = (error: unknown): error is AppUsageError =>
  error instanceof AppUsageError

export const isRetryExhaustedError = (error: unknown): boolean => {
  const seen = new Set<unknown>()
  let current: unknown = error
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current)
    if (isAppError(current) && current.kind === 'retry_exhausted') {
      return true
    }
    current = current.cause
  }
  return false
}

export const hasErrorCode = (error: unknown, code: string): boolean => {
  const seen = new Set<unknown>()
  let current = error

  while (current !== null && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    if ('code' in current && (current as { code?: unknown }).code === code) {
      return true
    }
    current = 'cause' in current
      ? (current as { cause?: unknown }).cause
      : undefined
  }

  return false
}

export function rethrowAsUsage<T>(fn: () => Promise<T>, fallbackHint?: string): Promise<T>
export function rethrowAsUsage<T>(fn: () => T, fallbackHint?: string): T
export function rethrowAsUsage<T>(
  fn: () => T | Promise<T>,
  fallbackHint?: string
): T | Promise<T> {
  const wrap = (error: unknown): never => {
    if (isUsageError(error)) {
      throw error
    }
    throw UsageError(
      error instanceof Error ? error.message : String(error),
      {
        ...(fallbackHint ? { hints: [fallbackHint] } : {}),
        cause: error
      }
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



export const normalizeExitCode = (error: unknown): number => {
  if (isAppError(error)) {
    return error.exitCode
  }
  return 1
}

export const usageMessage = (error: unknown): string => {
  if (isUsageError(error)) {
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
  'errno',
  'syscall',
  'hostname',
  'input',
  'param',
  'type',
  'error',
  'errorType',
  'responseType'
] as const

const SAFE_CAUSE_METADATA_KEYS = [
  'code',
  'errno',
  'syscall',
  'hostname',
  'input'
] as const

const ERROR_METADATA_CAUSE_DEPTH_LIMIT = 6

export const collectErrorMetadataChain = (error: unknown): object[] => {
  const chain: object[] = []
  const seen = new Set<unknown>()
  let current = error

  while (
    current !== null
    && typeof current === 'object'
    && !seen.has(current)
    && chain.length < ERROR_METADATA_CAUSE_DEPTH_LIMIT
  ) {
    chain.push(current)
    seen.add(current)
    current = 'cause' in current
      ? (current as { cause?: unknown }).cause
      : undefined
  }

  return chain
}

const addMetadataValue = (
  out: Record<string, unknown>,
  key: string,
  value: unknown
): void => {
  if (value !== undefined && out[key] === undefined) {
    out[key] = value
  }
}

export const getErrorStatus = (error: unknown): number | undefined => {
  for (const entry of collectErrorMetadataChain(error)) {
    if (!('status' in entry)) continue
    const status = (entry as { status: unknown }).status
    if (typeof status === 'number') {
      return status
    }
  }
  return undefined
}

export const getErrorHeaders = (error: unknown): Headers | undefined => {
  for (const entry of collectErrorMetadataChain(error)) {
    if (!('headers' in entry)) continue
    const headers = (entry as { headers: unknown }).headers
    if (headers instanceof Headers) {
      return headers
    }
  }
  return undefined
}

export const extractErrorMetadata = (error: unknown): Record<string, unknown> => {
  const metadata: Record<string, unknown> = {}

  for (const entry of collectErrorMetadataChain(error)) {
    const record = entry as Record<string, unknown>
    if (isAppError(entry)) {
      for (const [key, value] of Object.entries(entry.metadata)) {
        addMetadataValue(metadata, key, value)
      }
    }

    for (const key of PROVIDER_METADATA_KEYS) {
      addMetadataValue(metadata, key, record[key])
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

  for (const entry of collectErrorMetadataChain(error)) {
    for (const key of SAFE_CAUSE_METADATA_KEYS) {
      addMetadataValue(metadata, key, (entry as Record<string, unknown>)[key])
    }
  }

  return metadata
}

const keyedHintsFor = (error: unknown, metadata: Record<string, unknown>): string[] => {
  const hints: string[] = []
  const status = typeof metadata['status'] === 'number' ? metadata['status'] : undefined
  const category = typeof metadata['category'] === 'string' ? metadata['category'] : undefined
  const blockedReason = typeof metadata['blockedReason'] === 'string' ? metadata['blockedReason'] : undefined
  const quotaOrBilling = status === 402
    || metadata['quota'] === true
    || category === 'billing'
    || category === 'quota'
    || blockedReason === 'billing_required'
    || blockedReason === 'insufficient_balance'
    || blockedReason === 'quota_or_billing'

  if (isAppError(error)) {
    if (error.kind === 'usage') {
      hints.push(...error.hints)
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
  if (quotaOrBilling) {
    hints.push('Check the provider billing balance, quota, and account limits before retrying.')
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

export const formatErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message
  }
  return error === undefined ? 'Unknown error' : String(error)
}

type AnnotateAppErrorOptions = {
  kind?: Exclude<AppErrorKind, 'retry_exhausted'>
  stage: string
  retryClass?: RetryClass
  message?: string
  metadata?: Record<string, unknown>
  retryable?: boolean
  hints?: string[]
}

export const annotateAppError = (
  error: unknown,
  options: AnnotateAppErrorOptions
): AppError => {
  if (isAppError(error)) {
    Object.assign(error.metadata, {
      stage: options.stage,
      ...(options.retryClass ? { retryClass: options.retryClass } : {}),
      ...(options.metadata ?? {})
    })
    return error
  }

  return new AppError(options.message ?? formatErrorMessage(error), {
    kind: options.kind ?? 'infrastructure',
    stage: options.stage,
    ...(options.retryClass ? { retryClass: options.retryClass } : {}),
    cause: error,
    retryable: options.retryable ?? false,
    ...(options.hints ? { hints: options.hints } : {}),
    ...(options.metadata ? { metadata: options.metadata } : {})
  })
}

const RESULT_CAUSE_DEPTH_LIMIT = 6

const serializeResultCauseChain = (error: unknown): Array<Record<string, unknown>> => {
  const causes: Array<Record<string, unknown>> = []
  const seen = new Set<unknown>()
  let current = error !== null && typeof error === 'object' && 'cause' in error
    ? (error as { cause?: unknown }).cause
    : undefined

  while (current !== undefined && causes.length < RESULT_CAUSE_DEPTH_LIMIT && !seen.has(current)) {
    seen.add(current)
    causes.push(current instanceof Error
      ? { name: current.name, message: sanitizeLogText(current.message) }
      : current !== null && typeof current === 'object'
        ? { name: 'ObjectCause', metadata: toDiagnosticValue(current) }
        : { name: 'PrimitiveCause', value: toDiagnosticValue(current) })
    current = current !== null && typeof current === 'object' && 'cause' in current
      ? (current as { cause?: unknown }).cause
      : undefined
  }

  if (current !== undefined) causes.push({ name: 'CauseChainTruncated', message: 'Additional causes were omitted.' })
  return causes
}

export const serializeResultError = (error: unknown): Record<string, unknown> => {
  const metadata = extractErrorMetadata(error)
  const causes = serializeResultCauseChain(error)

  const serialized: Record<string, unknown> = {
    kind: isAppError(error) ? error.kind : 'internal',
    name: error instanceof Error ? error.name : 'NonErrorThrown',
    message: sanitizeLogText(formatErrorMessage(error)),
    ...(typeof metadata['stage'] === 'string' ? { stage: metadata['stage'] } : {}),
    ...(typeof metadata['status'] === 'number' ? { status: metadata['status'] } : {}),
    ...(typeof metadata['retryClass'] === 'string' ? { retryClass: metadata['retryClass'] } : {}),
    ...(typeof metadata['retryable'] === 'boolean' ? { retryable: metadata['retryable'] } : {}),
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    ...(causes.length > 0 ? { causes } : {})
  }
  return sanitizeLogMetadata(serialized) as Record<string, unknown>
}
