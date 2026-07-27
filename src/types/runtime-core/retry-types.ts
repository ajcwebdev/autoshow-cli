export type RetryClass =
  | 'setup_download'
  | 'runtime_subprocess_transient'
  | 'runtime_local_inference'
  | 'runtime_http_read'
  | 'runtime_http_create_conservative'
  | 'runtime_poll_loop'

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

