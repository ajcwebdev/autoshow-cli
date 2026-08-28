import type { HostedTtsChunkScheduler, ReplicateTtsModel, TtsRequestEvidenceScope } from '~/types'

export type RunReplicateTtsOptions = Readonly<{
  model: ReplicateTtsModel
  apiKey: string
  voiceId?: string | undefined
  speed?: number | undefined
  abortSignal?: AbortSignal | undefined
  chunkConcurrency?: number | undefined
  chunkScheduler?: HostedTtsChunkScheduler | undefined
  requestEvidence?: TtsRequestEvidenceScope | undefined
}>
