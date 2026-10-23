// Single source of truth for the --sfx-provider selectors.
export const ELEVENLABS_SFX_MODEL_ID = 'eleven_text_to_sound_v2'

export const SFX_PROVIDER_TARGETS = {
  elevenlabs: ELEVENLABS_SFX_MODEL_ID
} as const

export type SfxProvider = keyof typeof SFX_PROVIDER_TARGETS

export const SFX_PROVIDER_SELECTORS = Object.entries(SFX_PROVIDER_TARGETS)
  .map(([provider, model]) => `${provider}=${model}`) as readonly string[]

export const ELEVENLABS_SFX_SELECTOR = `elevenlabs=${SFX_PROVIDER_TARGETS.elevenlabs}`

export const SFX_PROVIDER_FLAG_CHOICES = [
  ELEVENLABS_SFX_SELECTOR
] as const
