import type { VoiceIssuedResource, VoiceProvisioningAttempt, VoiceProvisioningState } from '~/types'

type VoiceProvisioningProviderResponse = {
  state: VoiceProvisioningState
  issuedResources: VoiceIssuedResource[]
  evidenceHash: string
}

export type RunCrashSafeProvisioningInput = {
  journalRoot: string
  attempt: VoiceProvisioningAttempt
  mutate: (attempt: VoiceProvisioningAttempt) => Promise<VoiceProvisioningProviderResponse>
  faultInjection?: {
    afterPrepared?: (() => void | Promise<void>) | undefined
    afterRequestSent?: (() => void | Promise<void>) | undefined
    afterResponseRecorded?: (() => void | Promise<void>) | undefined
  } | undefined
}
