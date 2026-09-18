import type { HostedTtsChunkScheduler, InworldTtsModel, TtsRequestEvidenceScope } from '~/types'

export type RunInworldTtsOptions = Readonly<{
  model: InworldTtsModel
  apiKey: string
  voiceId?: string | undefined
  steeringPrompt?: string | undefined
  speed?: number | undefined
  abortSignal?: AbortSignal | undefined
  chunkConcurrency?: number | undefined
  chunkScheduler?: HostedTtsChunkScheduler | undefined
  chunking?: import('./tts-types').TtsChunkingOptions | undefined
  requestEvidence?: TtsRequestEvidenceScope | undefined
}>
