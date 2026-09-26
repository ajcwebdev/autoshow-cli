export type VoiceRegistrationReadiness = {
  state: 'ready' | 'blocked' | 'external-action-required'
  registrationId: string
  generationId: string
  checkedAt: string
  networkAccess: 'none' | 'read-only'
  evidenceHash: string
  reason?: string | undefined
}
