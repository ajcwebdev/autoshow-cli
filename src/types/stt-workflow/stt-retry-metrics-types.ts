import type { AsyncSttLifecycleHooks, DiarizationOptions } from '~/types'

export type SttSegmentRunOptions = {
  model: string
  segmentOffsetMinutes: number
  segmentNumber?: number | undefined
  totalSegments?: number | undefined
  audioDurationSeconds?: number | undefined
}

export type HostedAsyncSttRunOptions = SttSegmentRunOptions & {
  diarizationOptions?: DiarizationOptions | undefined
  runMode?: 'initial' | 'backfill' | undefined
  lifecycle?: AsyncSttLifecycleHooks | undefined
}

export type SttRetryMetrics = {
  retryCount: number
  rateLimitCount: number
}
