import type { AdvancedProviderHttpRequest, ProviderVoiceCloneRequest } from '~/types'

type SpeechifyCloneConsent = {
  fullName: string
  email: string
  locale?: string | undefined
  gender?: 'male' | 'female' | 'not_specified' | undefined
}

export type SpeechifyAdvancedProviderOptions = {
  apiKey: string
  request?: AdvancedProviderHttpRequest | undefined
  resolveProtectedAsset?: ((asset: ProviderVoiceCloneRequest['protectedSamples'][number]) => Promise<{ bytes: Uint8Array, fileName: string, mediaType: string, durationMs: number }>) | undefined
  resolveProtectedConsent?: ((consentRecordRef: string) => Promise<SpeechifyCloneConsent>) | undefined
  now?: (() => string) | undefined
}
