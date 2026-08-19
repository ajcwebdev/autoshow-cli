import type {
  CanonicalAudioProviderProjection,
  ProtectedAssetRef,
  ProviderRenderStrategy,
} from '~/types'

export type CurrentTtsObservedVoice = {
  kind: 'provider-id' | 'reference-asset' | 'local-model-voice'
  value?: string | undefined
  valueHash: string
  protectedAsset?: ProtectedAssetRef | undefined
  authorizationRef?: string | undefined
}

export type CurrentTtsObservedTurn = {
  turnId: string
  sourceIndex: number
  speaker: string
  text: string
  voice: CurrentTtsObservedVoice
  outputPath?: string | undefined
}

export type CurrentTtsRenderArtifacts = {
  artifactDir: string
  operation: 'tts-synthesis' | 'comic-audio'
  targetKey: string
  transport: string
  renderIdentity: string
  resultIdentity: string
  audioRunId: string
  strategy: ProviderRenderStrategy
  projection: CanonicalAudioProviderProjection
}
