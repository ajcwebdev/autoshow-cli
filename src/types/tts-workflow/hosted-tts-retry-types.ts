import type { HostedTtsChunkAdmissionToken, HostedTtsChunkScheduler, RetryClassifier, RetryPolicy } from '~/types'

export type HostedTtsRetryOptions = {
  operationName: string
  abortSignal?: AbortSignal | undefined
  policy?: Partial<RetryPolicy> | undefined
  timeoutMs?: number | undefined
  classifier?: RetryClassifier | undefined
  admission?: HostedTtsChunkAdmissionToken | undefined
  chunkScheduler?: HostedTtsChunkScheduler | undefined
}

export type HostedTtsRetryAttemptContext = {
  attempt: number
  retryReasonCode?: string | undefined
}
