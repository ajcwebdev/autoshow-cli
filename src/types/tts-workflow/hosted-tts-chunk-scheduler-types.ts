import type { HostedTtsChunkJobContext, HostedTtsSchedulerLimitChange, TtsProvider } from '~/types'

export type HostedTtsProviderChunkState = {
  provider: TtsProvider
  maxLimit: number
  currentLimit: number
  active: number
  jobs: HostedTtsChunkJob[]
  allJobs: HostedTtsChunkJob[]
  pauseUntilMs: number
  successStreak: number
  wakeTimer?: ReturnType<typeof setTimeout> | undefined
  stats: HostedTtsProviderStats
}

export type HostedTtsProviderStats = {
  startedChunks: number
  completedChunks: number
  failedChunks: number
  retryCount: number
  rateLimitCount: number
  maxActive: number
  queueWaitSamplesMs: number[]
  activeLatencySamplesMs: number[]
  pauseTimeMs: number
  limitChanges: HostedTtsSchedulerLimitChange[]
}

export type HostedTtsChunkJob<T = any> = HostedTtsChunkJobContext & {
  internalId: number
  provider: TtsProvider
  chunks: readonly string[]
  runChunk: (chunk: string, index: number) => Promise<T>
  results: T[]
  resolve: (value: T[]) => void
  reject: (error: unknown) => void
  registeredAtMs: number
  nextChunkIndex: number
  active: number
  startedChunks: number
  completedChunks: number
  failedChunks: number
  retryCount: number
  rateLimitCount: number
  queueWaitSamplesMs: number[]
  activeLatencySamplesMs: number[]
  lastSelectedAtMs: number
  failed: boolean
  settled: boolean
  failureReason?: unknown
  abortSignal?: AbortSignal | undefined
  abortListener?: (() => void) | undefined
}

export type HostedTtsChunkSchedulerOptions = {
  maxConcurrency?: number | undefined
  defaultRateLimitPauseMs?: number | undefined
  autoStart?: boolean | undefined
}
