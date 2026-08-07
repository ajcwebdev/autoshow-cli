import { SUPPORTED_WHISPER_MODELS } from '~/cli/commands/setup-and-utilities/models/stt-models'
import { booleanAllProvidersFlag, priceFlag, sharedConcurrencyFlags } from './shared-flags'
import { formatProviderList, formatRange, formatValueList, pickFlags, renameFlags, withHelpGroup } from './flag-utils'
import type { CliFlagsDefinition } from '~/types'
import { STANDALONE_MUSIC_PROVIDER_TARGETS } from './service-selector-normalization/provider-targets'
import { ELEVENLABS_MAX_DURATION_SECONDS, ELEVENLABS_MIN_DURATION_SECONDS } from '~/cli/commands/process-steps/step-7-music/music-services/music-elevenlabs/run-elevenlabs-music-gen'
import { GEMINI_CLIP_DURATION_SECONDS, GEMINI_PRO_DEFAULT_DURATION_SECONDS } from '~/cli/commands/process-steps/step-7-music/music-services/music-gemini/run-gemini-music-gen'
import { DEFAULT_ELEVENLABS_MUSIC_DURATION_SECONDS } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'

export const musicGenFlags = {
  'music-duration': {
    description: `Music duration in seconds: ElevenLabs configurable from ${formatRange([ELEVENLABS_MIN_DURATION_SECONDS, ELEVENLABS_MAX_DURATION_SECONDS])} (default ${DEFAULT_ELEVENLABS_MUSIC_DURATION_SECONDS}); MiniMax currently ignores this flag and controls duration; Gemini Lyria Clip is fixed at ${GEMINI_CLIP_DURATION_SECONDS} seconds; Gemini Lyria Pro uses the requested duration (default ${GEMINI_PRO_DEFAULT_DURATION_SECONDS})`,
    type: String
  },
  'music-lyrics-file': {
    description: 'Lyrics file path (.md or .txt) for MiniMax and Gemini music generation',
    type: String
  },
  'music-instrumental': {
    description: 'Force instrumental generation for providers that support prompt/instrumental mode',
    type: Boolean,
    default: false,
    negatable: false
  },
} as const satisfies CliFlagsDefinition

const musicLyricVideoFlags = {
  'input-dir': {
    description: 'Input directory for lyric video audio files',
    type: String
  },
  batch: {
    description: 'Render lyric videos for all supported audio files under input recursively',
    type: Boolean,
    default: false,
    negatable: false
  },
  audio: {
    description: 'Single lyric-video audio file inside input',
    type: String
  },
  captions: {
    description: 'Optional VTT or SRT file inside ./output for rerendering without Whisper',
    type: String
  },
  model: {
    description: `Local whisper.cpp model for lyric-video captions: ${formatValueList(SUPPORTED_WHISPER_MODELS)} (default: large-v3-turbo)`,
    type: String,
    default: 'large-v3-turbo'
  },
  font: {
    description: 'Font family used for rendered lyric-video captions (default: DejaVu Sans)',
    type: String,
    default: 'DejaVu Sans'
  },
  'keep-tmp': {
    description: 'Keep the per-run .lyrics-tmp workspace in the output directory',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition

const musicProviderSelectionFlags = {
  provider: {
    description: `Music provider[=model]: ${formatProviderList(STANDALONE_MUSIC_PROVIDER_TARGETS)}; repeatable`,
    type: [String] as [StringConstructor]
  },
  ...booleanAllProvidersFlag,
  ...pickFlags(sharedConcurrencyFlags, ['provider-concurrency'])
} as const satisfies CliFlagsDefinition

export const musicCommandFlags = {
  ...withHelpGroup(musicProviderSelectionFlags, 'provider-selection'),
  ...withHelpGroup(renameFlags(musicGenFlags, {
    'music-duration': 'duration',
    'music-lyrics-file': 'lyrics-file',
    'music-instrumental': 'instrumental'
  }), 'hosted-music'),
  ...withHelpGroup(priceFlag, 'pricing'),
  ...withHelpGroup(musicLyricVideoFlags, 'lyric-video')
} as const satisfies CliFlagsDefinition
