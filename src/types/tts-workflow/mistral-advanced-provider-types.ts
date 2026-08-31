import type { MistralVoiceManagementRequest, ProviderVoiceCloneRequest } from '~/types'

export type MistralAdvancedProviderOptions = {
  apiKey: string
  request?: MistralVoiceManagementRequest | undefined
  resolveProtectedAsset?: ((asset: ProviderVoiceCloneRequest['protectedSamples'][number]) => Promise<{ bytes: Uint8Array, fileName: string, mediaType: string }>) | undefined
  now?: (() => string) | undefined
}
