import type { AdvancedProviderHttpRequest, ProviderVoiceCloneRequest } from '~/types'

export type CreateInworldAdvancedProviderOptions = Readonly<{
  apiKey: string
  request?: AdvancedProviderHttpRequest | undefined
  resolveProtectedAsset?: ((asset: ProviderVoiceCloneRequest['protectedSamples'][number]) => Promise<{ bytes: Uint8Array, fileName: string, mediaType: string, transcription?: string | undefined }>) | undefined
  now?: (() => string) | undefined
}>
