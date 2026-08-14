import type { HostedTtsChunkAdmissionToken, HostedTtsChunkScheduler, RetryClassifier, RetryPolicy } from '~/types'

export type HostedTtsRetryOptions = {
  operationName: string
  abortSignal?: AbortSignal | undefined
  policy?: Partial<RetryPolicy> | undefined
  /** Explicit authorization to retry a paid request whose provider admission outcome is ambiguous. */
  allowAmbiguousRedispatch?: boolean | undefined
  timeoutMs?: number | undefined
  classifier?: RetryClassifier | undefined
  admission?: HostedTtsChunkAdmissionToken | undefined
  chunkScheduler?: HostedTtsChunkScheduler | undefined
}

export type HostedTtsRetryAttemptContext = {
  attempt: number
  retryReasonCode?: string | undefined
}
