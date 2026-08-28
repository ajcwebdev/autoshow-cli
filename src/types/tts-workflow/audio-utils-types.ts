import type { HostedTtsChunkJobContext, HostedTtsChunkScheduler, TtsProvider } from '~/types'

export type RunTtsChunksOptions = {
  provider: TtsProvider
  scheduler: HostedTtsChunkScheduler
  job?: HostedTtsChunkJobContext | undefined
  scopeLabel?: string | undefined
  abortSignal?: AbortSignal | undefined
}
