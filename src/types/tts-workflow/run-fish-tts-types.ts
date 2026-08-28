import type { FishTtsModel, HostedTtsChunkScheduler, TtsRequestEvidenceScope } from '~/types'

export type RunFishTtsOptions = Readonly<{
  model: FishTtsModel
  apiKey: string
  voiceId?: string | undefined
  latency?: 'normal' | 'balanced' | undefined
  abortSignal?: AbortSignal | undefined
  chunkConcurrency?: number | undefined
  chunkScheduler?: HostedTtsChunkScheduler | undefined
  requestEvidence?: TtsRequestEvidenceScope | undefined
}>
