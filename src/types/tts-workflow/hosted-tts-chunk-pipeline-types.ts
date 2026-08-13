import type { HostedTtsChunkJobContext, HostedTtsChunkScheduler, Step4Metadata, TtsProvider, TtsRequestEvidenceScope } from '~/types'

export type HostedTtsChunkFetchContext = {
  chunk: string
  chunkIndex: number
  signal: AbortSignal | undefined
  requestAttempt: number
  retryReasonCode?: string | undefined
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
  abortSignal?: AbortSignal | undefined
  chunkConcurrency?: number | undefined
  chunkScheduler?: HostedTtsChunkScheduler | undefined
  chunkJob?: HostedTtsChunkJobContext | undefined
  laneScopeLabel?: string | undefined
  requestEvidence?: TtsRequestEvidenceScope | undefined
  extraMetadata?: Partial<Step4Metadata> | undefined
  fetchChunkAudio: (context: HostedTtsChunkFetchContext) => Promise<Uint8Array>
}
