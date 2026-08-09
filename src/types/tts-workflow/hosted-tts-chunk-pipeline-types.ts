import type { HostedTtsChunkScheduler, Step4Metadata, TtsProvider } from '~/types'

export type HostedTtsChunkFetchContext = {
  chunk: string
  chunkIndex: number
  signal: AbortSignal | undefined
}

export type HostedTtsChunkPipelineOptions = {
  provider: TtsProvider
  providerLabel: string
  model: string
  speaker?: string | undefined
  chunks: readonly string[]
  outputDir: string
  chunkExtension: string
  startTime: number
  chunkConcurrency?: number | undefined
  chunkScheduler?: HostedTtsChunkScheduler | undefined
  extraMetadata?: Partial<Step4Metadata> | undefined
  fetchChunkAudio: (context: HostedTtsChunkFetchContext) => Promise<Uint8Array>
}
