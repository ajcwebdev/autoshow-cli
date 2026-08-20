/**
 * The retry classes the CLI recognises. Every class must have at least one caller:
 * `runtime_local_inference` and `runtime_poll_loop` were removed once the audit found
 * they had none, and `runtime_subprocess_transient` is the class `exec()` retries under.
 */
export type RetryClass =
  | 'setup_download'
  | 'runtime_subprocess_transient'
  | 'runtime_http_read'
  | 'runtime_http_create_conservative'
  | 'runtime_http_create_retriable'

export type RetryPolicy = {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  jitter: boolean
  exponential: boolean
}


export type RetryDecision = {
  shouldRetry: boolean
  delayMs: number
  reason: string
}
