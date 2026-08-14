import { SUPPORTED_WHISPER_MODELS } from '~/cli/commands/setup-and-utilities/models/stt-models'
import { booleanAllProvidersFlag, priceFlag, sharedConcurrencyFlags } from './shared-flags'
import { boolFlag, formatProviderList, formatRange, formatValueList, pickFlags, renameFlags, strFlag, strListFlag, withHelpGroup } from './flag-utils'
import type { CliFlagsDefinition } from '~/types'
import { STANDALONE_MUSIC_PROVIDER_TARGETS } from './service-selector-normalization/provider-targets'
import { ELEVENLABS_MAX_DURATION_SECONDS, ELEVENLABS_MIN_DURATION_SECONDS } from '~/cli/commands/process-steps/step-7-music/music-services/music-elevenlabs/run-elevenlabs-music-gen'
import { GEMINI_CLIP_DURATION_SECONDS, GEMINI_PRO_DEFAULT_DURATION_SECONDS } from '~/cli/commands/process-steps/step-7-music/music-services/music-gemini/run-gemini-music-gen'
import { DEFAULT_ELEVENLABS_MUSIC_DURATION_SECONDS } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'

export const musicGenFlags = {
  'music-duration': strFlag(`Music duration in seconds: ElevenLabs configurable from ${formatRange([ELEVENLABS_MIN_DURATION_SECONDS, ELEVENLABS_MAX_DURATION_SECONDS])} (default ${DEFAULT_ELEVENLABS_MUSIC_DURATION_SECONDS}); MiniMax currently ignores this flag and controls duration; Gemini Lyria Clip is fixed at ${GEMINI_CLIP_DURATION_SECONDS} seconds; Gemini Lyria Pro uses the requested duration (default ${GEMINI_PRO_DEFAULT_DURATION_SECONDS})`),
  'music-lyrics-file': strFlag('Lyrics file path (.md or .txt) for MiniMax and Gemini music generation'),
  'music-instrumental': boolFlag('Force instrumental generation for providers that support prompt/instrumental mode'),
} as const satisfies CliFlagsDefinition

const musicLyricVideoFlags = {
  'input-dir': strFlag('Input directory for lyric video audio files'),
  batch: boolFlag('Render lyric videos for all supported audio files under input recursively'),
  audio: strFlag('Single lyric-video audio file inside input'),
  captions: strFlag('Optional VTT or SRT file inside ./output for rerendering without Whisper'),
  model: strFlag(`Local whisper.cpp model for lyric-video captions: ${formatValueList(SUPPORTED_WHISPER_MODELS)} (default: large-v3-turbo)`, 'large-v3-turbo'),
  font: strFlag('Font family used for rendered lyric-video captions (default: DejaVu Sans)', 'DejaVu Sans'),
  'keep-tmp': boolFlag('Keep the per-run .lyrics-tmp workspace in the output directory')
} as const satisfies CliFlagsDefinition

const musicProviderSelectionFlags = {
  provider: strListFlag(`Music provider[=model]: ${formatProviderList(STANDALONE_MUSIC_PROVIDER_TARGETS)}; repeatable`),
  ...booleanAllProvidersFlag,
  ...pickFlags(sharedConcurrencyFlags, ['concurrency-mode', 'provider-concurrency'])
} as const satisfies CliFlagsDefinition

export const musicCommandOptionNames = {
  'music-duration': 'duration',
  'music-lyrics-file': 'lyrics-file',
  'music-instrumental': 'instrumental'
} as const satisfies Record<string, string>

export const musicCommandFlags = {
  ...withHelpGroup(musicProviderSelectionFlags, 'provider-selection'),
  ...withHelpGroup(renameFlags(musicGenFlags, musicCommandOptionNames), 'hosted-music'),
  ...withHelpGroup(priceFlag, 'pricing'),
  ...withHelpGroup(musicLyricVideoFlags, 'lyric-video')
} as const satisfies CliFlagsDefinition
