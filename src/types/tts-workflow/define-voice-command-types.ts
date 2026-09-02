import type { TtsProvider, TtsVoiceProvider } from '~/types'

type VoiceProviderCapabilities = Readonly<{
  models: readonly string[]
  import: true
  catalog: boolean
  design: boolean
  clone: boolean
  lifecycle: boolean
}>

export const VOICE_CAPABILITY_REGISTRY = {
  elevenlabs: { models: ['eleven_v3'], import: true, catalog: true, design: true, clone: true, lifecycle: true },
  grok: { models: ['grok-tts'], import: true, catalog: true, design: false, clone: true, lifecycle: true },
  mistral: { models: ['voxtral-mini-tts-2603'], import: true, catalog: true, design: false, clone: true, lifecycle: true },
  openai: { models: ['gpt-4o-mini-tts-2025-12-15'], import: true, catalog: false, design: false, clone: false, lifecycle: false },
  speechify: { models: ['simba-3.2'], import: true, catalog: true, design: false, clone: false, lifecycle: true },
  hume: { models: ['octave-1', 'octave-2'], import: true, catalog: true, design: true, clone: false, lifecycle: true },
  cartesia: { models: ['sonic-3.5-2026-05-04'], import: true, catalog: true, design: false, clone: true, lifecycle: true },
  inworld: { models: ['realtime-tts-2'], import: true, catalog: true, design: true, clone: true, lifecycle: true },
} as const satisfies Record<TtsProvider, VoiceProviderCapabilities>

type ProviderWithCapability<K extends keyof Omit<VoiceProviderCapabilities, 'models'>> = {
  [P in keyof typeof VOICE_CAPABILITY_REGISTRY]: (typeof VOICE_CAPABILITY_REGISTRY)[P][K] extends true ? P : never
}[keyof typeof VOICE_CAPABILITY_REGISTRY]

export type VoiceImportProviderName = ProviderWithCapability<'import'>
export type VoiceCatalogProviderName = ProviderWithCapability<'catalog'>
export type VoiceDesignProviderName = ProviderWithCapability<'design'>
export type VoiceCloneProviderName = ProviderWithCapability<'clone'>
export type VoiceLifecycleProviderName = ProviderWithCapability<'lifecycle'>
export type VoiceProviderName = VoiceImportProviderName
export type DesignProviderName = VoiceDesignProviderName
export type CloneProviderName = VoiceCloneProviderName
export type ManagedAdvancedProvider = Pick<TtsVoiceProvider, 'provider' | 'getDeclaredCapabilities' | 'catalog' | 'design' | 'clone' | 'lifecycle'> & { accountScopeHash: string }
