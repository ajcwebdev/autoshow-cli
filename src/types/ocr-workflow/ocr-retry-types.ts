import type { HostedOcrSchedulerRetryPressureHandler, RetryClassifier } from '~/types'

export type OcrCreateRetryOptions = {
  classifier?: RetryClassifier | undefined
  onRetryable?: HostedOcrSchedulerRetryPressureHandler | undefined
}

export type OcrPageRequestRetryOptions = OcrCreateRetryOptions & {
  attempts?: number | undefined
  timeoutMs?: number | undefined
}
