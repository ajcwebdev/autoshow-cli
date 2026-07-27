import { booleanAllProvidersFlag, priceFlag, sharedConcurrencyFlags } from './shared-flags'
import { formatProviderList, formatRange, formatValueList, formatValuesByProvider, pickFlags, renameFlags, withHelpGroup } from './flag-utils'
import { VIDEO_MODES } from '~/types'
import type { CliFlagsDefinition } from '~/types'
import { STANDALONE_VIDEO_PROVIDER_TARGETS } from './service-selector-normalization/provider-targets'
import {
  GEMINI_DURATION_SECONDS,
  GEMINI_VIDEO_RESOLUTIONS,
  GLM_COGVIDEOX_DURATION_SECONDS,
  GLM_COGVIDEOX_SIZE_VALUES,
  GLM_VIDEO_ASPECT_RATIOS,
  GLM_VIDU2_FIXED_DURATION_SECONDS,
  GLM_VIDU2_SIZE_VALUES,
  GLM_VIDUQ1_FIXED_DURATION_SECONDS,
  GROK_VIDEO_ASPECT_RATIOS,
  GROK_VIDEO_DURATION_RANGE,
  GROK_VIDEO_RESOLUTIONS,
  LTX_2_3_SIZE_VALUES,
  LTX_ASPECT_RATIOS,
  LTX_DURATION_SECONDS,
  LTX_FAST_1080P_DURATION_SECONDS,
  LTX_RESOLUTIONS,
  LUMA_ASPECT_RATIOS,
  LUMA_DURATION_SECONDS,
  LUMA_RESOLUTIONS,
  MINIMAX_HAILUO_DURATION_SECONDS,
  MINIMAX_RESOLUTIONS,
  REPLICATE_COMMON_ASPECT_RATIOS,
  REPLICATE_HAPPYHORSE_DURATION_RANGE,
  REPLICATE_SEEDANCE_ASPECT_RATIOS,
  REPLICATE_SEEDANCE_DURATION_RANGE,
  REPLICATE_VIDEO_RESOLUTIONS,
  REPLICATE_WAN_DURATION_RANGE,
  RUNWAY_ASPECT_RATIO_INPUTS,
  RUNWAY_DURATION_RANGE
} from '~/cli/commands/process-steps/step-6-video/video-utils/video-normalization'

const seedanceExtraAspectRatios = REPLICATE_SEEDANCE_ASPECT_RATIOS.filter(
  (ratio) => !(REPLICATE_COMMON_ASPECT_RATIOS as readonly string[]).includes(ratio)
)
const ltxFastOnlyDurations = LTX_FAST_1080P_DURATION_SECONDS.filter(
  (seconds) => !(LTX_DURATION_SECONDS as readonly number[]).includes(seconds)
)

export const VIDEO_COMMAND_SELECTOR_FLAGS = {
  'gemini-video': 'gemini',
  'minimax-video': 'minimax',
  'glm-video': 'glm',
  'grok-video': 'grok',
  'runway-video': 'runway',
  'ltx-video': 'ltx',
  'replicate-video': 'replicate',
  'lumalabs-video': 'lumalabs'
} as const satisfies Record<string, string>

export const videoGenFlags = {
  'video-mode': {
    description: `Video generation mode: ${formatValueList(VIDEO_MODES)} (default: text)`,
    type: String
  },
  'video-duration': {
    description: `Video duration in seconds: ${formatValuesByProvider([
      { provider: 'Gemini Veo', values: GEMINI_DURATION_SECONDS },
      { provider: 'MiniMax Hailuo', values: MINIMAX_HAILUO_DURATION_SECONDS },
      { provider: 'GLM CogVideoX', values: GLM_COGVIDEOX_DURATION_SECONDS, note: `Vidu Q1 is fixed at ${GLM_VIDUQ1_FIXED_DURATION_SECONDS} and Vidu 2 at ${GLM_VIDU2_FIXED_DURATION_SECONDS}` },
      { provider: 'Luma Labs', values: LUMA_DURATION_SECONDS, note: 'rounds to the nearer value' },
      { provider: 'LTX', values: LTX_DURATION_SECONDS, note: `the Fast model at 1920x1080 also accepts ${formatValueList(ltxFastOnlyDurations)}` }
    ])}, ${formatRange(GROK_VIDEO_DURATION_RANGE)} (Grok), ${formatRange(RUNWAY_DURATION_RANGE)} (Runway), ${formatRange(REPLICATE_WAN_DURATION_RANGE)} (Replicate Wan), ${formatRange(REPLICATE_HAPPYHORSE_DURATION_RANGE)} (Replicate HappyHorse), ${formatRange(REPLICATE_SEEDANCE_DURATION_RANGE)} (Replicate Seedance, where ${REPLICATE_SEEDANCE_DURATION_RANGE[0]} means the model default)`,
    type: String
  },
  'video-size': {
    description: `Video size: ${formatValueList(GLM_COGVIDEOX_SIZE_VALUES)} (GLM CogVideoX), ${formatValueList(GLM_VIDU2_SIZE_VALUES)} (GLM Vidu2), ${formatValueList(LTX_2_3_SIZE_VALUES)} (LTX); other providers use --video-resolution or --video-aspect-ratio`,
    type: String
  },
  'video-aspect-ratio': {
    description: `Video aspect ratio: ${formatValuesByProvider([
      { provider: 'GLM', values: GLM_VIDEO_ASPECT_RATIOS },
      { provider: 'Replicate', values: REPLICATE_COMMON_ASPECT_RATIOS },
      { provider: 'Luma Labs', values: LUMA_ASPECT_RATIOS },
      { provider: 'Grok', values: GROK_VIDEO_ASPECT_RATIOS },
      { provider: 'Runway', values: RUNWAY_ASPECT_RATIO_INPUTS },
      { provider: 'LTX 2.3', values: LTX_ASPECT_RATIOS }
    ])}; Replicate Seedance also supports ${formatValueList(seedanceExtraAspectRatios)}; Gemini forwards any ratio to the Veo API unvalidated and MiniMax has no aspect-ratio control`,
    type: String
  },
  'video-resolution': {
    description: `Video resolution: ${formatValuesByProvider([
      { provider: 'Gemini', values: GEMINI_VIDEO_RESOLUTIONS, note: '4k requires Veo 3.1 standard/Fast' },
      { provider: 'MiniMax Hailuo', values: MINIMAX_RESOLUTIONS },
      { provider: 'Grok', values: GROK_VIDEO_RESOLUTIONS },
      { provider: 'LTX', values: LTX_RESOLUTIONS },
      { provider: 'Replicate', values: REPLICATE_VIDEO_RESOLUTIONS, note: 'narrower on some models' },
      { provider: 'Luma Labs', values: LUMA_RESOLUTIONS }
    ])}`,
    type: String
  },
  'video-input-image': {
    description: 'Video input image path, URL, or data URL for image-to-video and interpolation first frame (including Luma Labs start-frame generation)',
    type: String
  },
  'video-last-frame': {
    description: 'Video last-frame image path, URL, or data URL for interpolation',
    type: String
  },
  'video-reference-image': {
    description: 'Reference image path, URL, or data URL for reference-to-video; repeat up to 3 times',
    type: [String] as [StringConstructor]
  },
  'video-input-video': {
    description: 'Input MP4 path, URL, or data URL for video extension or editing',
    type: String
  },
  'replicate-video-seed': {
    description: 'Replicate video seed: integer from 0 to 2147483647',
    type: String
  },
  'replicate-video-generate-audio': {
    description: 'Replicate Seedance synchronized audio toggle',
    type: Boolean
  },
  'replicate-video-reference-video': {
    description: 'Replicate Seedance reference MP4 path, URL, or data URL; repeat up to 3 times',
    type: [String] as [StringConstructor]
  },
  'replicate-video-reference-audio': {
    description: 'Replicate Seedance reference MP3/WAV path, URL, or data URL; repeat up to 3 times',
    type: [String] as [StringConstructor]
  },
  'replicate-video-negative-prompt': {
    description: 'Replicate Wan negative prompt',
    type: String
  },
  'replicate-video-audio': {
    description: 'Replicate Wan MP3/WAV audio path, URL, or data URL',
    type: String
  },
  'replicate-video-prompt-expansion': {
    description: 'Replicate Wan prompt expansion toggle',
    type: Boolean
  },
  'grok-video-storage-filename': {
    description: 'Grok video storage filename for generated file output',
    type: String
  },
  'grok-video-storage-expires-after': {
    description: 'Grok video storage expiration in seconds (max 2592000)',
    type: String
  },
} as const satisfies CliFlagsDefinition

const videoCommandOptionNames = {
  'video-mode': 'mode',
  'video-duration': 'duration',
  'video-size': 'size',
  'video-aspect-ratio': 'aspect-ratio',
  'video-resolution': 'resolution',
  'video-input-image': 'input-image',
  'video-last-frame': 'last-frame',
  'video-reference-image': 'reference-image',
  'video-input-video': 'input-video'
} as const satisfies Record<string, string>

const videoProviderSelectionFlags = {
  provider: {
    description: `Video provider[=model]: ${formatProviderList(STANDALONE_VIDEO_PROVIDER_TARGETS)}; repeatable`,
    type: [String] as [StringConstructor]
  },
  'gemini-video': {
    description: 'Gemini video model; repeatable',
    type: [String] as [StringConstructor]
  },
  'minimax-video': {
    description: 'MiniMax video model; repeatable',
    type: [String] as [StringConstructor]
  },
  'glm-video': {
    description: 'GLM video model; repeatable',
    type: [String] as [StringConstructor]
  },
  'grok-video': {
    description: 'Grok video model; repeatable',
    type: [String] as [StringConstructor]
  },
  'runway-video': {
    description: 'Runway video model; repeatable',
    type: [String] as [StringConstructor]
  },
  'ltx-video': {
    description: 'LTX video model; repeatable',
    type: [String] as [StringConstructor]
  },
  'replicate-video': {
    description: 'Replicate video model; repeatable',
    type: [String] as [StringConstructor]
  },
  'lumalabs-video': {
    description: 'Luma Labs video model; repeatable',
    type: [String] as [StringConstructor]
  },
  ...booleanAllProvidersFlag,
  ...pickFlags(sharedConcurrencyFlags, ['provider-concurrency'])
} as const satisfies CliFlagsDefinition

export const videoGenerationOptionNames = [
  'video-mode',
  'video-duration',
  'video-size',
  'video-aspect-ratio',
  'video-resolution'
] as const

export const videoInputOptionNames = [
  'video-input-image',
  'video-last-frame',
  'video-reference-image',
  'video-input-video'
] as const

const replicateOptionNames = [
  'replicate-video-seed',
  'replicate-video-generate-audio',
  'replicate-video-reference-video',
  'replicate-video-reference-audio',
  'replicate-video-negative-prompt',
  'replicate-video-audio',
  'replicate-video-prompt-expansion'
] as const

const grokStorageOptionNames = [
  'grok-video-storage-filename',
  'grok-video-storage-expires-after'
] as const

export const videoCommandFlags = {
  ...withHelpGroup(videoProviderSelectionFlags, 'provider-selection'),
  ...withHelpGroup(renameFlags(pickFlags(videoGenFlags, videoGenerationOptionNames), videoCommandOptionNames), 'video-options'),
  ...withHelpGroup(renameFlags(pickFlags(videoGenFlags, videoInputOptionNames), videoCommandOptionNames), 'video-inputs'),
  ...withHelpGroup(pickFlags(videoGenFlags, replicateOptionNames), 'replicate-video'),
  ...withHelpGroup(renameFlags(pickFlags(videoGenFlags, grokStorageOptionNames), videoCommandOptionNames), 'grok-storage'),
  ...withHelpGroup(priceFlag, 'pricing')
} as const satisfies CliFlagsDefinition
