import type { HostedTtsChunkScheduler, MinimaxTtsModel, TtsRequestEvidenceScope } from '~/types'

export type MinimaxTtsOptions = {
  model: MinimaxTtsModel
  voiceId?: string | undefined
  languageBoost?: string | undefined
  speed?: number | undefined
  volume?: number | undefined
  pitch?: number | undefined
  emotion?: string | undefined
  englishNormalization?: boolean | undefined
  pronunciations?: string[] | undefined
  abortSignal?: AbortSignal | undefined
  chunkConcurrency?: number | undefined
  chunkScheduler?: HostedTtsChunkScheduler | undefined
  requestEvidence?: TtsRequestEvidenceScope | undefined
}
