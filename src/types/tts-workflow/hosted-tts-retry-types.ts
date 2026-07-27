import type { HostedTtsChunkScheduler, RetryClassifier, RetryPolicy, TtsProvider } from '~/types'

export type HostedTtsRetryOptions = {
  operationName: string
  policy?: Partial<RetryPolicy> | undefined
  timeoutMs?: number | undefined
  classifier?: RetryClassifier | undefined
  ttsProvider?: TtsProvider | undefined
  chunkScheduler?: HostedTtsChunkScheduler | undefined
}
