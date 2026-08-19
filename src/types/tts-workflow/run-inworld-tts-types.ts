import type { HostedTtsChunkScheduler, InworldTtsModel, TtsRequestEvidenceScope } from '~/types'

export type RunInworldTtsOptions = Readonly<{
  model: InworldTtsModel
  apiKey: string
  voiceId?: string | undefined
  steeringPrompt?: string | undefined
  abortSignal?: AbortSignal | undefined
  chunkConcurrency?: number | undefined
  chunkScheduler?: HostedTtsChunkScheduler | undefined
  requestEvidence?: TtsRequestEvidenceScope | undefined
}>
