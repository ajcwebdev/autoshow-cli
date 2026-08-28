import type { FalTtsModel, HostedTtsChunkScheduler, TtsRequestEvidenceScope } from '~/types'

export type RunFalTtsOptions = Readonly<{
  model: FalTtsModel
  apiKey: string
  voiceId?: string | undefined
  voiceInstruction?: string | undefined
  abortSignal?: AbortSignal | undefined
  chunkConcurrency?: number | undefined
  chunkScheduler?: HostedTtsChunkScheduler | undefined
  requestEvidence?: TtsRequestEvidenceScope | undefined
  runQueue?: typeof import('~/utils/fal-client/fal-queue').runFalQueue | undefined
}>
