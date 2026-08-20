import type { DeepinfraTtsModel, HostedTtsChunkScheduler, TtsRequestEvidenceScope } from '~/types'

export type RunDeepinfraTtsOptions = Readonly<{
  model: DeepinfraTtsModel
  apiKey: string
  voiceId?: string | undefined
  promptInstructions?: string | undefined
  abortSignal?: AbortSignal | undefined
  chunkConcurrency?: number | undefined
  chunkScheduler?: HostedTtsChunkScheduler | undefined
  requestEvidence?: TtsRequestEvidenceScope | undefined
}>
