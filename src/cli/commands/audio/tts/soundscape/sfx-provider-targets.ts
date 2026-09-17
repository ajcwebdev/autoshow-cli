// Single source of truth for the --sfx-provider selectors. The pinned Replicate community-model
// version lives here so the flag description, the help examples, the adapter's usage errors, and
// the docs all render the same string instead of repeating the hash.
export const REPLICATE_AUDIOGEN_PINNED_VERSION = '154b3e5141493cb1b8cec976d9aa90f2b691137e39ad906d2421b74c2a8c52b8'
export const REPLICATE_AUDIOGEN_MODEL_ID = 'sepal/audiogen'
export const ELEVENLABS_SFX_MODEL_ID = 'eleven_text_to_sound_v2'
export const STABILITY_STABLE_AUDIO_MODEL_ID = 'stable-audio-3'

export const SFX_PROVIDER_TARGETS = {
  elevenlabs: ELEVENLABS_SFX_MODEL_ID,
  replicate: `${REPLICATE_AUDIOGEN_MODEL_ID}@${REPLICATE_AUDIOGEN_PINNED_VERSION}`,
  stability: STABILITY_STABLE_AUDIO_MODEL_ID
} as const

export type SfxProvider = keyof typeof SFX_PROVIDER_TARGETS

export const SFX_PROVIDER_SELECTORS = Object.entries(SFX_PROVIDER_TARGETS)
  .map(([provider, model]) => `${provider}=${model}`) as readonly string[]

export const REPLICATE_AUDIOGEN_SELECTOR = `replicate=${SFX_PROVIDER_TARGETS.replicate}`
export const ELEVENLABS_SFX_SELECTOR = `elevenlabs=${SFX_PROVIDER_TARGETS.elevenlabs}`
export const STABILITY_SFX_SELECTOR = `stability=${SFX_PROVIDER_TARGETS.stability}`

// The flag row keeps the version abbreviated; the topic and docs carry the pinned hash.
export const SFX_PROVIDER_FLAG_CHOICES = [
  ELEVENLABS_SFX_SELECTOR,
  `replicate=${REPLICATE_AUDIOGEN_MODEL_ID}@<pinned-version>`,
  STABILITY_SFX_SELECTOR
] as const
