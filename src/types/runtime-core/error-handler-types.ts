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
  stage: string
  hints?: string[]
  exitCode?: number
  cause?: unknown
  status?: number
  headers?: Headers
  retryClass?: RetryClass
  retryable?: boolean
  metadata?: Record<string, unknown>
}

export type ErrorChainEntry = Error & Record<string, unknown>

export type UsageErrorOptions = {
  hints?: string[]
  usageMessage?: string
  stage?: string
  metadata?: Record<string, unknown>
  cause?: unknown
  retryable?: boolean
}

export type NonUsageAppErrorOptions = Omit<AppErrorOptions, 'kind' | 'stage'> & { stage?: string }
