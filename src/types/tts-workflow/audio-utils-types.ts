import type { HostedTtsChunkJobContext, HostedTtsChunkScheduler, TtsProvider } from '~/types'

export type RunTtsChunksOptions = {
  provider?: TtsProvider | undefined
  scheduler?: HostedTtsChunkScheduler | undefined
  job?: HostedTtsChunkJobContext | undefined
  abortSignal?: AbortSignal | undefined
}
