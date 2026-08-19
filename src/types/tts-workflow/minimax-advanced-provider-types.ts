import type { AdvancedProviderHttpRequest, ProviderVoiceCloneRequest } from '~/types'

export type MiniMaxVoiceType = 'voice_cloning' | 'voice_generation'

export type MiniMaxAdvancedProviderOptions = {
  apiKey: string
  request?: AdvancedProviderHttpRequest | undefined
  resolveProtectedAsset?: ((asset: ProviderVoiceCloneRequest['protectedSamples'][number]) => Promise<{ bytes: Uint8Array, fileName: string, mediaType: string, durationMs: number }>) | undefined
  now?: (() => string) | undefined
}
