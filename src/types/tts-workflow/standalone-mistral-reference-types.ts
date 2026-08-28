import type { ProtectedVoiceAssetStore, TtsOptions } from '~/types'

export type PendingStandaloneMistralReference = {
  sourcePath: string
  sourceExtension: string
  authorizationRef: string
  store: ProtectedVoiceAssetStore
}

export type PendingStandaloneMistralSpeakerReference = PendingStandaloneMistralReference & {
  speakerKey: string
  protectedAsset: Awaited<ReturnType<ProtectedVoiceAssetStore['plan']>>['protectedAsset']
}

export type PlannedStandaloneMistralSpeakerReferences = Readonly<{
  ttsSpeakers: readonly string[]
  attach: <T extends TtsOptions>(options: T) => T
}>
