import type { TtsProvider } from '../provider-core/provider-types'
import type { PreparedProviderText, ProviderVoiceLocator } from './voice-and-dialogue-types'

export type CapabilityMaturity = 'stable' | 'preview' | 'deprecated' | 'not-applicable'
export type CapabilityChannel = 'api' | 'ui-only' | 'external-import' | 'unsupported'
export type AdapterSupport = 'implemented' | 'planned' | 'unsupported'

export type VoiceCapabilityFeature =
  | 'turn-synthesis'
  | 'native-dialogue'
  | 'native-utterances'
  | 'voice-catalog'
  | 'voice-design'
  | 'voice-remix'
  | 'instant-clone'
  | 'professional-clone'
  | 'voice-import'
  | 'voice-delete'
  | 'acting-description'
  | 'word-timing'
  | 'phoneme-timing'
  | 'continuation'
  | 'speech-to-speech'

export type ProviderAccessRequirement =
  | { kind: 'plan', tier?: string | undefined }
  | { kind: 'approval', approvalKind?: string | undefined }
  | { kind: 'verification', verificationKind?: string | undefined }
  | { kind: 'region', allowedRegionCodes: string[] }

export type AccountCapabilityState =
  | 'available'
  | 'not-configured'
  | 'unavailable'
  | 'external-action-required'
  | 'unknown'

export type CapabilityScope = {
  provider: TtsProvider
  feature: VoiceCapabilityFeature
  model?: string | undefined
  transport?: string | undefined
}
export type TurnSynthesisConstraints = {
  voiceKinds: ProviderVoiceLocator['kind'][]
  maxCharacters?: number | undefined
  supportedOutputFormats?: string[] | undefined
}

export type NativeDialogueConstraints = TurnSynthesisConstraints & {
  minSpeakers: number
  maxSpeakers: number
  maxTurns?: number | undefined
}

export type NativeUtteranceConstraints = TurnSynthesisConstraints & {
  maxUtterances?: number | undefined
  maxTakesPerRequest?: number | undefined
}

export type VoiceCatalogConstraints = {
  paginated: boolean
  stableResourceIds: boolean
}

export type VoiceManagementConstraints = {
  requiresConsent: boolean
  createsRemoteResource: boolean
}

export type TimingConstraints = {
  providerTimeUnit: string
  providerIndexUnit?: PreparedProviderText['providerIndexUnit'] | undefined
}

export type CapabilityConstraintsByFeature = {
  'turn-synthesis': TurnSynthesisConstraints
  'native-dialogue': NativeDialogueConstraints
  'native-utterances': NativeUtteranceConstraints
  'voice-catalog': VoiceCatalogConstraints
  'voice-design': VoiceManagementConstraints
  'voice-remix': VoiceManagementConstraints
  'instant-clone': VoiceManagementConstraints
  'professional-clone': VoiceManagementConstraints
  'voice-import': VoiceManagementConstraints
  'voice-delete': { projectOwnedOnly: boolean }
  'acting-description': { maxCharacters?: number | undefined }
  'word-timing': TimingConstraints
  'phoneme-timing': TimingConstraints
  'continuation': { providerVersions: string[] }
  'speech-to-speech': { speechBusesOnly: boolean }
}

export type CapabilityDocumentationEvidence = {
  checkedAt: string
  sourceRefs: string[]
  evidenceHash: string
}

export type CapabilityRecord<F extends VoiceCapabilityFeature> = {
  scope: CapabilityScope & { feature: F }
  maturity: CapabilityMaturity
  channel: CapabilityChannel
  adapterSupport: AdapterSupport
  requirements: ProviderAccessRequirement[]
  constraints: CapabilityConstraintsByFeature[F]
  reason?: string | undefined
  documentationEvidence: CapabilityDocumentationEvidence
}

export type AnyCapabilityRecord = {
  [F in VoiceCapabilityFeature]: CapabilityRecord<F>
}[VoiceCapabilityFeature]

export type AccountCapabilityObservation = {
  observationHash: string
  capabilityScopeHash: string
  capabilityFixtureHash: string
  accountScopeHash: string
  state: AccountCapabilityState
  satisfiedRequirements: ProviderAccessRequirement[]
  unmetRequirements: ProviderAccessRequirement[]
  checkedAt: string
  expiresAt?: string | undefined
  evidenceRefs: string[]
  reason?: string | undefined
}
