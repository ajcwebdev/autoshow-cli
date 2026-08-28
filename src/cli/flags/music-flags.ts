import { SUPPORTED_WHISPER_MODELS } from '~/cli/commands/setup-and-utilities/models/stt-models'
import { booleanAllProvidersFlag, priceFlag, sharedConcurrencyFlags } from './shared-flags'
import { boolFlag, formatProviderList, formatRange, formatValueList, pickFlags, strFlag, strListFlag, withHelpGroup } from './flag-utils'
import type { CliFlagsDefinition } from '~/types'
import { STANDALONE_MUSIC_PROVIDER_TARGETS } from './service-selector-normalization/provider-targets'
import { ELEVENLABS_MAX_DURATION_SECONDS, ELEVENLABS_MIN_DURATION_SECONDS } from '~/cli/commands/process-steps/step-7-music/music-services/music-elevenlabs/run-elevenlabs-music-gen'
import { GEMINI_PRO_DEFAULT_DURATION_SECONDS } from '~/cli/commands/process-steps/step-7-music/music-services/music-gemini/run-gemini-music-gen'
import { DEFAULT_ELEVENLABS_MUSIC_DURATION_SECONDS } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'

export const musicGenFlags = {
  duration: strFlag(`Music duration in seconds: ElevenLabs configurable from ${formatRange([ELEVENLABS_MIN_DURATION_SECONDS, ELEVENLABS_MAX_DURATION_SECONDS])} (default: ${DEFAULT_ELEVENLABS_MUSIC_DURATION_SECONDS}); Gemini Lyria Pro uses the requested duration (default: ${GEMINI_PRO_DEFAULT_DURATION_SECONDS})`),
  'lyrics-file': strFlag('Lyrics file path (.md or .txt) with section headers like Verse 1 or Chorus; MiniMax and Gemini receive the lyrics directly, ElevenLabs music_v2 converts them into a composition plan and uses the prompt as style descriptors'),
  instrumental: boolFlag('Force instrumental generation for providers that support prompt/instrumental mode'),
} as const satisfies CliFlagsDefinition

const musicLyricVideoFlags = {
  batch: strFlag('Render lyric videos for all supported audio files under directory recursively'),
  audio: strFlag('Single lyric-video audio file'),
  captions: strFlag('Optional VTT or SRT file for rerendering without Whisper'),
  model: strFlag(`Local whisper.cpp model for lyric-video captions: ${formatValueList(SUPPORTED_WHISPER_MODELS)}`, 'large-v3-turbo'),
  font: strFlag('Font family used for rendered lyric-video captions', 'DejaVu Sans')
} as const satisfies CliFlagsDefinition

const musicProviderSelectionFlags = {
  provider: strListFlag(`Music provider[=model]: ${formatProviderList(STANDALONE_MUSIC_PROVIDER_TARGETS)}; repeatable`),
  ...booleanAllProvidersFlag,
  ...pickFlags(sharedConcurrencyFlags, ['concurrency-mode', 'provider-concurrency'])
} as const satisfies CliFlagsDefinition

export const musicCommandFlags = {
  ...withHelpGroup(musicProviderSelectionFlags, 'provider-selection'),
  ...withHelpGroup(musicGenFlags, 'hosted-music'),
  ...withHelpGroup(priceFlag, 'pricing'),
  ...withHelpGroup(musicLyricVideoFlags, 'lyric-video')
} as const satisfies CliFlagsDefinition
