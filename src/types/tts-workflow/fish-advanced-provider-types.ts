import type { ProviderVoiceCloneRequest } from '~/types'

export type CreateFishAdvancedProviderOptions = Readonly<{
  apiKey: string
  baseUrl?: string | undefined
  fetchImpl?: typeof fetch | undefined
  resolveProtectedAsset?: ((asset: ProviderVoiceCloneRequest['protectedSamples'][number]) => Promise<{ bytes: Uint8Array, fileName: string, mediaType: string }>) | undefined
  now?: (() => string) | undefined
}>
