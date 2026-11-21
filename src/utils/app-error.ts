import type { AppErrorKind, AppErrorOptions, RetryClass } from '~/types'

// This leaf class is also used before the source checkout has installed packages.
// Keep its runtime imports empty; richer diagnostics belong in error-handler.ts.
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
