export type RetryAttemptLog = {
  operation: string
  attempt: number
  maxAttempts: number
  reason: string
  delayMs: number
}
