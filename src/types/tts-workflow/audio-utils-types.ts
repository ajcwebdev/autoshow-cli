import type { HostedTtsChunkAdmissionToken, HostedTtsChunkJobContext, HostedTtsChunkScheduler, TtsProvider } from '~/types'

export type RunTtsChunksOptions = {
  provider?: TtsProvider | undefined
  scheduler?: HostedTtsChunkScheduler | undefined
  job?: HostedTtsChunkJobContext | undefined
  scopeLabel?: string | undefined
  abortSignal?: AbortSignal | undefined
}

export type RunTtsChunk = <T>(chunk: string, index: number, admission?: HostedTtsChunkAdmissionToken | undefined) => Promise<T>
