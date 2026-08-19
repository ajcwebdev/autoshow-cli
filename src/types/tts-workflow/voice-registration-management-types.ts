import type { ProtectedAssetRef } from '~/types'

export type MistralSavedReferencePlan = {
  registrationId: string
  attemptId: string
  slug: string
  source: ProtectedAssetRef
  estimatedCostCents: 0
}

export type VoiceRegistrationReadiness = {
  state: 'ready' | 'blocked' | 'external-action-required'
  registrationId: string
  generationId: string
  checkedAt: string
  networkAccess: 'none' | 'read-only'
  evidenceHash: string
  reason?: string | undefined
}
