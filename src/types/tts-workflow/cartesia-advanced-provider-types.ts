import type { AdvancedProviderHttpRequest, ProviderVoiceCloneRequest } from '~/types'

export type CartesiaAdvancedProviderOptions = {
  apiKey: string
  request?: AdvancedProviderHttpRequest | undefined
  resolveProtectedAsset?: ((asset: ProviderVoiceCloneRequest['protectedSamples'][number]) => Promise<{ bytes: Uint8Array, fileName: string, mediaType: string }>) | undefined
  cloneLanguage?: string | undefined
  now?: (() => string) | undefined
}
