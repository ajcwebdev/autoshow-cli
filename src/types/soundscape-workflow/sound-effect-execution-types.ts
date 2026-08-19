import type {
  ObservedAudioFormat,
  SoundEffectGenerationResponse,
  SoundEffectRenderTask,
  SoundEffectTarget,
} from '~/types'

export type CacheEntry = {
  schemaVersion: 1
  cacheNamespace: 'shared-synthesis-v1'
  modality: 'sound-effect'
  requestIdentity: string
  targetKey: string
  capabilityFixtureHash: string
  serializerVersion: string
  audio: { path: 'audio.bin', sha256: string, format: ObservedAudioFormat, durationMs: number }
  requestEvidence: SoundEffectGenerationResponse['requestEvidence']
  createdAt: string
}

export type SoundEffectAdmissionStarted = {
  schemaVersion: 1
  eventId: string
  state: 'dispatch-started'
  renderPlanId: string
  requestIdentity: string
  requestOrdinal: number
  targetKey: string
  createdAt: string
}

export type SoundEffectAdmissionTerminal = {
  schemaVersion: 1
  eventId: string
  state: 'provider-succeeded' | 'rejected' | 'ambiguous'
  renderPlanId: string
  requestIdentity: string
  requestOrdinal: number
  targetKey: string
  response?: {
    audio: { path: string, sha256: string }
    evidence: { path: string, sha256: string }
  } | undefined
  sanitizedReason?: string | undefined
  createdAt: string
}

export type PersistedSoundEffectResponse = {
  schemaVersion: 1
  responsePackageId: string
  requestIdentity: string
  requestOrdinal: number
  audioSha256: string
  contentType: string
  providerRequestId?: string | undefined
  observedCharacterCost?: number | undefined
  requestEvidence: SoundEffectGenerationResponse['requestEvidence']
}

export type SoundEffectAdapter = { generate(task: SoundEffectRenderTask, target: SoundEffectTarget, requestOrdinal: number, cancellation: AbortSignal): Promise<SoundEffectGenerationResponse> }
