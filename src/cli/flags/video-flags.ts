import { booleanAllProvidersFlag, priceFlag, sharedConcurrencyFlags } from './shared-flags'
import { formatProviderList, formatRange, formatValueList, formatValuesByProvider, pickFlags, renameFlags, strFlag, strListFlag, withHelpGroup } from './flag-utils'
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
import { FAL_H3_ASPECT_RATIOS, FAL_H3_RESOLUTIONS, FAL_PIXVERSE_ASPECT_RATIOS, FAL_PIXVERSE_RESOLUTIONS } from '~/cli/commands/process-steps/step-6-video/video-services/fal-video-service/run-fal-video-gen'

const seedanceExtraAspectRatios = REPLICATE_SEEDANCE_ASPECT_RATIOS.filter(
  (ratio) => !(REPLICATE_COMMON_ASPECT_RATIOS as readonly string[]).includes(ratio)
)
const ltxFastOnlyDurations = LTX_FAST_1080P_DURATION_SECONDS.filter(
  (seconds) => !(LTX_DURATION_SECONDS as readonly number[]).includes(seconds)
)

export const videoGenFlags = {
  'video-mode': strFlag(`Video generation mode: ${formatValueList(VIDEO_MODES)} (default: text)`),
  'video-duration': strFlag(`Video duration in seconds: ${formatValuesByProvider([
    { provider: 'Gemini Veo', values: GEMINI_DURATION_SECONDS },
    { provider: 'MiniMax Hailuo', values: MINIMAX_HAILUO_DURATION_SECONDS },
    { provider: 'GLM CogVideoX', values: GLM_COGVIDEOX_DURATION_SECONDS, note: `Vidu Q1 is fixed at ${GLM_VIDUQ1_FIXED_DURATION_SECONDS} and Vidu 2 at ${GLM_VIDU2_FIXED_DURATION_SECONDS}` },
    { provider: 'Luma Labs', values: LUMA_DURATION_SECONDS, note: 'rounds to the nearer value' },
    { provider: 'LTX', values: LTX_DURATION_SECONDS, note: `the Fast model at 1920x1080 also accepts ${formatValueList(ltxFastOnlyDurations)}` }
  ])}, ${formatRange(GROK_VIDEO_DURATION_RANGE)} (Grok), ${formatRange(RUNWAY_DURATION_RANGE)} (Runway), ${formatRange(REPLICATE_WAN_DURATION_RANGE)} (Replicate Wan), ${formatRange(REPLICATE_HAPPYHORSE_DURATION_RANGE)} (Replicate HappyHorse), ${formatRange(REPLICATE_SEEDANCE_DURATION_RANGE)} (Replicate Seedance, where ${REPLICATE_SEEDANCE_DURATION_RANGE[0]} means the model default), 5-15 (fal.ai H3), 1-15 (fal.ai PixVerse C1)`),
  'video-size': strFlag(`Video size: ${formatValueList(GLM_COGVIDEOX_SIZE_VALUES)} (GLM CogVideoX), ${formatValueList(GLM_VIDU2_SIZE_VALUES)} (GLM Vidu2), ${formatValueList(LTX_2_3_SIZE_VALUES)} (LTX); other providers use --video-resolution or --video-aspect-ratio`),
  'video-aspect-ratio': strFlag(`Video aspect ratio: ${formatValuesByProvider([
    { provider: 'GLM', values: GLM_VIDEO_ASPECT_RATIOS },
    { provider: 'Replicate', values: REPLICATE_COMMON_ASPECT_RATIOS },
    { provider: 'Luma Labs', values: LUMA_ASPECT_RATIOS },
    { provider: 'Grok', values: GROK_VIDEO_ASPECT_RATIOS },
    { provider: 'Runway', values: RUNWAY_ASPECT_RATIO_INPUTS },
    { provider: 'LTX 2.3', values: LTX_ASPECT_RATIOS },
    { provider: 'fal.ai H3', values: FAL_H3_ASPECT_RATIOS },
    { provider: 'fal.ai PixVerse C1', values: FAL_PIXVERSE_ASPECT_RATIOS }
  ])}; Replicate Seedance also supports ${formatValueList(seedanceExtraAspectRatios)}; Gemini forwards any ratio to the Veo API unvalidated and MiniMax has no aspect-ratio control`),
  'video-resolution': strFlag(`Video resolution: ${formatValuesByProvider([
    { provider: 'Gemini', values: GEMINI_VIDEO_RESOLUTIONS, note: '4k requires Veo 3.1 standard/Fast' },
    { provider: 'MiniMax Hailuo', values: MINIMAX_RESOLUTIONS },
    { provider: 'Grok', values: GROK_VIDEO_RESOLUTIONS },
    { provider: 'LTX', values: LTX_RESOLUTIONS },
    { provider: 'Replicate', values: REPLICATE_VIDEO_RESOLUTIONS, note: 'narrower on some models' },
    { provider: 'Luma Labs', values: LUMA_RESOLUTIONS },
    { provider: 'fal.ai H3', values: FAL_H3_RESOLUTIONS },
    { provider: 'fal.ai PixVerse C1', values: FAL_PIXVERSE_RESOLUTIONS }
  ])}`),
  'video-input-image': strFlag('Video input image path, URL, or data URL for image-to-video and interpolation first frame (including Luma Labs start-frame generation)'),
  'video-last-frame': strFlag('Video last-frame image path, URL, or data URL for interpolation'),
  'video-reference-image': strListFlag('Reference image path, URL, or data URL for reference-to-video; repeat up to 3 times'),
  'video-input-video': strFlag('Input MP4 path, URL, or data URL for video extension or editing'),
  'replicate-video-seed': strFlag('Replicate video seed: integer from 0 to 2147483647'),
  'replicate-video-generate-audio': {
    description: 'Replicate Seedance, Kling, or PixVerse synchronized/native audio toggle',
    type: Boolean
  },
  'replicate-video-reference-video': strListFlag('Replicate Seedance or Kling Omni reference MP4 path, URL, or data URL; repeat where supported'),
  'replicate-video-reference-audio': strListFlag('Replicate Seedance reference MP3/WAV path, URL, or data URL; repeat up to 3 times'),
  'replicate-video-negative-prompt': strFlag('Replicate Wan, Kling Video 3.0, or PixVerse V6 negative prompt'),
  'replicate-video-audio': strFlag('Replicate Wan MP3/WAV audio path, URL, or data URL'),
  'replicate-video-prompt-expansion': {
    description: 'Replicate Wan prompt expansion toggle',
    type: Boolean
  },
  'replicate-video-multi-prompt': strFlag('Replicate Kling multi-shot JSON array (up to 6 shots whose durations sum to --duration)'),
  'replicate-video-multi-clip': {
    description: 'Replicate PixVerse V6 multi-shot generation toggle',
    type: Boolean
  },
  'fal-video-generate-audio': {
    description: 'fal.ai PixVerse C1 synchronized audio toggle',
    type: Boolean
  },
  'fal-video-reference-video': strListFlag('fal.ai MiniMax H3 reference video path, URL, or data URL; repeat up to 3 times'),
  'fal-video-reference-audio': strListFlag('fal.ai MiniMax H3 reference audio path, URL, or data URL; repeat up to 3 times'),
  'grok-video-storage-filename': strFlag('Grok video storage filename for generated file output'),
  'grok-video-storage-expires-after': strFlag('Grok video storage expiration in seconds (max 2592000)'),
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
  provider: strListFlag(`Video provider[=model]: ${formatProviderList(STANDALONE_VIDEO_PROVIDER_TARGETS)}; repeatable`),
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
  'replicate-video-prompt-expansion',
  'replicate-video-multi-prompt',
  'replicate-video-multi-clip'
] as const

const falOptionNames = [
  'fal-video-generate-audio',
  'fal-video-reference-video',
  'fal-video-reference-audio'
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
  ...withHelpGroup(pickFlags(videoGenFlags, falOptionNames), 'fal-video'),
  ...withHelpGroup(renameFlags(pickFlags(videoGenFlags, grokStorageOptionNames), videoCommandOptionNames), 'grok-storage'),
  ...withHelpGroup(priceFlag, 'pricing')
} as const satisfies CliFlagsDefinition
