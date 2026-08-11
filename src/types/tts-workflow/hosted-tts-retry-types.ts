import type { HostedTtsChunkScheduler, RetryClassifier, RetryPolicy, TtsProvider } from '~/types'

export type HostedTtsRetryOptions = {
  operationName: string
  abortSignal?: AbortSignal | undefined
  policy?: Partial<RetryPolicy> | undefined
  timeoutMs?: number | undefined
  classifier?: RetryClassifier | undefined
  ttsProvider?: TtsProvider | undefined
  chunkScheduler?: HostedTtsChunkScheduler | undefined
}

export type HostedTtsRetryAttemptContext = {
  attempt: number
  retryReasonCode?: string | undefined
}
