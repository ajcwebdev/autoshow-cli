import type { RetryClass } from '~/types'

export type AppErrorKind =
  | 'usage'
  | 'provider_http'
  | 'retry_exhausted'
  | 'validation'
  | 'infrastructure'
  | 'internal'

export type AppErrorOptions = {
  kind: AppErrorKind
  hints?: string[]
  exitCode?: number
  cause?: Error | undefined
  status?: number
  headers?: Headers
  stage?: string
  retryClass?: RetryClass
  retryable?: boolean
  metadata?: Record<string, unknown>
}

export type ErrorChainEntry = Error & Record<string, unknown>
