import type { HostedTtsChunkJobContext, HostedTtsChunkScheduler, RetryPolicy, Step4Metadata, TtsProvider, TtsRequestEvidenceScope, TtsTimingFactory } from '~/types'

type HostedTtsChunkFetchContext = {
  chunk: string
  chunkIndex: number
  signal: AbortSignal | undefined
  requestAttempt: number
  retryReasonCode?: string | undefined
}

type HostedTtsChunkFetchResult = Uint8Array | Readonly<{
  audio: Uint8Array
  timing?: TtsTimingFactory | undefined
}>

/**
 * A provider that inlines chunk audio in JSON at a byte rate fixed by the request. Declare it only
 * when that rate is known from the request fields, never from a guess about provider defaults.
 */
export type HostedTtsInlineAudioResponse = {
  audioBytesPerSecond: number
  encoding: 'base64' | 'hex'
  /** Speed multiplier sent with the request. Slower speech yields longer audio. */
  speed?: number | undefined
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
  timeoutMs?: number | undefined
  chunkConcurrency?: number | undefined
  chunkScheduler?: HostedTtsChunkScheduler | undefined
  retryPolicy?: Partial<RetryPolicy> | undefined
  chunkJob?: HostedTtsChunkJobContext | undefined
  laneScopeLabel?: string | undefined
  requestEvidence?: TtsRequestEvidenceScope | undefined
  extraMetadata?: Partial<Step4Metadata> | undefined
  /** Rejects a chunk whose inlined response cannot fit the HTTP payload ceiling before any chunk is dispatched. */
  inlineAudioResponse?: HostedTtsInlineAudioResponse | undefined
  fetchChunkAudio: (context: HostedTtsChunkFetchContext) => Promise<HostedTtsChunkFetchResult>
}
