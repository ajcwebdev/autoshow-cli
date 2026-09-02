export type RetryClass =
  | 'setup_download'
  | 'filesystem_visibility'
  | 'runtime_subprocess_transient'
  | 'runtime_http_read'
  | 'runtime_http_poll'
  | 'runtime_http_create_conservative'
  | 'runtime_http_create_retriable'

export type RetryReasonCode =
  | 'retryable_status'
  | 'provider_rejected_admission'
  | 'network_error'
  | 'timeout'
  | 'filesystem_not_visible'
  | 'subprocess_transient'
  | 'unclassified_infrastructure'
  | 'non_retryable_marked'
  | 'non_retryable_status'
  | 'unsafe_paid_redispatch'
  | 'nested_exhaustion'
  | 'max_attempts'
  | 'classifier_refused'

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
  reasonCode: RetryReasonCode
}
