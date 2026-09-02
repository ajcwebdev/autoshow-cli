export type RetryAttemptLog = {
  operation: string
  failedAttempt: number
  nextAttempt: number
  maxAttempts: number
  reason: string
  reasonCode: import('~/types').RetryReasonCode
  delayMs: number
}
