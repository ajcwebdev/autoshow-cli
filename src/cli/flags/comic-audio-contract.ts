// Comic generate-audio enumerations shared by the flag definitions and the invocation parser, so
// `--help` lists exactly the values the parser accepts.
import { SOUND_EFFECT_LICENSE_USE_CLASSIFICATIONS } from '~/cli/commands/audio/tts/soundscape/sfx-license-use'

export const COMIC_AUDIO_MODES = ['auto', 'native', 'segmented'] as const
export type ComicAudioModeValue = typeof COMIC_AUDIO_MODES[number]
export const DEFAULT_COMIC_AUDIO_MODE: ComicAudioModeValue = 'auto'

export const COMIC_AUDIO_DELIVERY_POLICIES = ['strict', 'best-effort'] as const
export const DEFAULT_COMIC_AUDIO_DELIVERY_POLICY = 'strict'

export const COMIC_AUDIO_PACING_PROFILES = ['none', 'loose-comedy'] as const
export const DEFAULT_COMIC_AUDIO_PACING_PROFILE = 'none'

export const COMIC_SOUNDSCAPE_TIMING_POLICIES = ['strict', 'proportional'] as const
export const DEFAULT_COMIC_SOUNDSCAPE_TIMING_POLICY = 'strict'

export { SOUND_EFFECT_LICENSE_USE_CLASSIFICATIONS }
