import type { HostedOcrSchedulerRetryPressureHandler, RetryClassifier } from '~/types'

export type OcrCreateRetryOptions = {
  classifier?: RetryClassifier | undefined
  onRetryable?: HostedOcrSchedulerRetryPressureHandler | undefined
  abortSignal?: AbortSignal | undefined
}

export type OcrPageRequestRetryOptions = OcrCreateRetryOptions & {
  timeoutMs?: number | undefined
}
