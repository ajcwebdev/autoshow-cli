import type { TtsVoiceProvider } from '~/types'

export type VoiceProviderName = 'elevenlabs' | 'inworld' | 'fish' | 'cartesia' | 'speechify'
export type DesignProviderName = 'elevenlabs' | 'fish' | 'inworld'
export type CloneProviderName = 'elevenlabs' | 'inworld' | 'fish' | 'cartesia' | 'speechify'
export type ManagedAdvancedProvider = Pick<TtsVoiceProvider, 'provider' | 'getDeclaredCapabilities' | 'catalog' | 'design' | 'clone' | 'lifecycle'> & { accountScopeHash: string }
