import type { AdvancedProviderHttpRequest, DeepinfraTtsModel, ProviderVoiceCloneRequest } from '~/types'

export type DeepinfraDesignSynthesis = (input: {
  model: DeepinfraTtsModel
  body: Readonly<Record<string, unknown>>
  signal?: AbortSignal | undefined
}) => Promise<Uint8Array>

export type CreateDeepinfraAdvancedProviderOptions = Readonly<{
  apiKey: string
  request?: AdvancedProviderHttpRequest | undefined
  synthesizeDesign?: DeepinfraDesignSynthesis | undefined
  resolveProtectedAsset?: ((asset: ProviderVoiceCloneRequest['protectedSamples'][number]) => Promise<{ bytes: Uint8Array, fileName: string, mediaType: string }>) | undefined
  now?: (() => string) | undefined
}>
