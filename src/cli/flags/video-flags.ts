import { booleanAllProvidersFlag, priceFlag, sharedConcurrencyFlags } from './shared-flags'
import { formatProviderList, formatRange, formatValueList, formatValuesByProvider, pickFlags, strFlag, strListFlag, withHelpGroup } from './flag-utils'
import { VIDEO_MODES } from '~/types'
import type { CliFlagsDefinition } from '~/types'
import { STANDALONE_VIDEO_PROVIDER_TARGETS } from './service-selector-normalization/provider-targets'
import {
  GEMINI_DURATION_SECONDS,
  GEMINI_VIDEO_RESOLUTIONS,
  GROK_VIDEO_ASPECT_RATIOS,
  GROK_VIDEO_DURATION_RANGE,
  GROK_VIDEO_RESOLUTIONS,
  LTX_ASPECT_RATIOS,
  LTX_DURATION_SECONDS,
  LTX_FAST_1080P_DURATION_SECONDS,
  LTX_RESOLUTIONS,
  LUMA_ASPECT_RATIOS,
  LUMA_DURATION_SECONDS,
  LUMA_RESOLUTIONS,
  REPLICATE_COMMON_ASPECT_RATIOS,
  REPLICATE_HAPPYHORSE_DURATION_RANGE,
  REPLICATE_SEEDANCE_ASPECT_RATIOS,
  REPLICATE_SEEDANCE_DURATION_RANGE,
  REPLICATE_VIDEO_RESOLUTIONS
} from '~/cli/commands/process-steps/step-6-video/video-utils/video-normalization'
import { FAL_H3_ASPECT_RATIOS, FAL_H3_RESOLUTIONS, FAL_PIXVERSE_ASPECT_RATIOS, FAL_PIXVERSE_RESOLUTIONS } from '~/cli/commands/process-steps/step-6-video/video-services/fal-video-service/run-fal-video-gen'

const seedanceExtraAspectRatios = REPLICATE_SEEDANCE_ASPECT_RATIOS.filter(
  (ratio) => !(REPLICATE_COMMON_ASPECT_RATIOS as readonly string[]).includes(ratio)
)
const ltxFastOnlyDurations = LTX_FAST_1080P_DURATION_SECONDS.filter(
  (seconds) => !(LTX_DURATION_SECONDS as readonly number[]).includes(seconds)
)

export const videoGenFlags = {
  mode: strFlag(`Video generation mode: ${formatValueList(VIDEO_MODES)} (default: text)`),
  duration: strFlag(`Video duration in seconds: ${formatValuesByProvider([
    { provider: 'Gemini Veo', values: GEMINI_DURATION_SECONDS },
    { provider: 'Luma Labs', values: LUMA_DURATION_SECONDS, note: 'rounds to the nearer value' },
    { provider: 'LTX', values: LTX_DURATION_SECONDS, note: `the Fast model at 1920x1080 also accepts ${formatValueList(ltxFastOnlyDurations)}` }
  ])}, ${formatRange(GROK_VIDEO_DURATION_RANGE)} (Grok), ${formatRange(REPLICATE_HAPPYHORSE_DURATION_RANGE)} (Replicate HappyHorse), ${formatRange(REPLICATE_SEEDANCE_DURATION_RANGE)} (Replicate Seedance, where ${REPLICATE_SEEDANCE_DURATION_RANGE[0]} means the model default), 5-15 (fal.ai H3), 1-15 (fal.ai PixVerse C1)`),
  'aspect-ratio': strFlag(`Video aspect ratio: ${formatValuesByProvider([
    { provider: 'Replicate', values: REPLICATE_COMMON_ASPECT_RATIOS },
    { provider: 'Luma Labs', values: LUMA_ASPECT_RATIOS },
    { provider: 'Grok', values: GROK_VIDEO_ASPECT_RATIOS },
    { provider: 'LTX 2.3', values: LTX_ASPECT_RATIOS },
    { provider: 'fal.ai H3', values: FAL_H3_ASPECT_RATIOS },
    { provider: 'fal.ai PixVerse C1', values: FAL_PIXVERSE_ASPECT_RATIOS }
  ])}; Replicate Seedance also supports ${formatValueList(seedanceExtraAspectRatios)}; Gemini forwards any ratio to the Veo API unvalidated`),
  resolution: strFlag(`Video resolution: ${formatValuesByProvider([
    { provider: 'Gemini', values: GEMINI_VIDEO_RESOLUTIONS, note: '4k requires Veo 3.1 standard/Fast' },
    { provider: 'Grok', values: GROK_VIDEO_RESOLUTIONS },
    { provider: 'LTX', values: LTX_RESOLUTIONS },
    { provider: 'Replicate', values: REPLICATE_VIDEO_RESOLUTIONS, note: 'narrower on some models' },
    { provider: 'Luma Labs', values: LUMA_RESOLUTIONS },
    { provider: 'fal.ai H3', values: FAL_H3_RESOLUTIONS },
    { provider: 'fal.ai PixVerse C1', values: FAL_PIXVERSE_RESOLUTIONS }
  ])}`),
  'input-image': strFlag('Video input image path, URL, or data URL for image-to-video and interpolation first frame (including Luma Labs start-frame generation)'),
  'last-frame': strFlag('Video last-frame image path, URL, or data URL for interpolation'),
  'reference-image': strListFlag('Reference image path, URL, or data URL for reference-to-video; repeat up to 3 times'),
  'input-video': strFlag('Input MP4 path, URL, or data URL for video extension or editing'),
  'generate-audio': {
    description: 'Video synchronized/native audio toggle where supported (Replicate Seedance/Kling/PixVerse, fal.ai PixVerse C1)',
    type: Boolean
  },
  'reference-video': strListFlag('Reference MP4 video path, URL, or data URL; repeat where supported (Replicate Seedance/Kling Omni, fal.ai MiniMax H3)'),
  'reference-audio': strListFlag('Reference MP3/WAV audio path, URL, or data URL; repeat up to 3 times (Replicate Seedance, fal.ai MiniMax H3)'),
  'replicate-video-seed': strFlag('Replicate video seed: integer from 0 to 2147483647'),
  'replicate-video-negative-prompt': strFlag('Replicate Kling Video 3.0 or PixVerse V6 negative prompt'),
  'replicate-video-multi-prompt': strFlag('Replicate Kling multi-shot JSON array (up to 6 shots whose durations sum to --duration)'),
  'replicate-video-multi-clip': {
    description: 'Replicate PixVerse V6 multi-shot generation toggle',
    type: Boolean
  }
} as const satisfies CliFlagsDefinition

const videoProviderSelectionFlags = {
  provider: strListFlag(`Video provider[=model]: ${formatProviderList(STANDALONE_VIDEO_PROVIDER_TARGETS)}; repeatable`),
  ...booleanAllProvidersFlag,
  ...pickFlags(sharedConcurrencyFlags, ['concurrency-mode', 'provider-concurrency'])
} as const satisfies CliFlagsDefinition

export const videoGenerationOptionNames = [
  'mode',
  'duration',
  'aspect-ratio',
  'resolution',
  'generate-audio'
] as const

export const videoInputOptionNames = [
  'input-image',
  'last-frame',
  'reference-image',
  'input-video',
  'reference-video',
  'reference-audio'
] as const

const replicateOptionNames = [
  'replicate-video-seed',
  'replicate-video-negative-prompt',
  'replicate-video-multi-prompt',
  'replicate-video-multi-clip'
] as const

export const videoCommandFlags = {
  ...withHelpGroup(videoProviderSelectionFlags, 'provider-selection'),
  ...withHelpGroup(pickFlags(videoGenFlags, videoGenerationOptionNames), 'video-options'),
  ...withHelpGroup(pickFlags(videoGenFlags, videoInputOptionNames), 'video-inputs'),
  ...withHelpGroup(pickFlags(videoGenFlags, replicateOptionNames), 'replicate-video'),
  ...withHelpGroup(priceFlag, 'pricing')
} as const satisfies CliFlagsDefinition
