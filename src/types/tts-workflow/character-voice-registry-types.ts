import type { AuditActorRef, VoiceAuditionManifest, VoiceConsentRecord } from '~/types'

export type CharacterVoiceRegistryPaths = {
  charactersRoot: string
  briefs: string
  registrations: string
  current: string
  referencesRoot: string
}

export type ApproveVoiceRegistrationInput = {
  charactersRoot: string
  registrationId: string
  generationId: string
  audition: VoiceAuditionManifest
  approvedBy: AuditActorRef
  expectedIndexRevision: number
  expectedCurrentGenerationId?: string | undefined
  approvedAt?: string | undefined
  consent?: VoiceConsentRecord | undefined
}
