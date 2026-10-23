import { booleanAllProvidersFlag, modelCostFilterFlag, priceFlag, sharedConcurrencyFlags } from './shared-flags'
import { formatProviderList, formatRange, formatValueList, formatValuesByProvider, pickFlags, strFlag, strListFlag, withHelpGroup } from './flag-utils'
import { DEFAULT_VIDEO_MODE, VIDEO_MODES } from '~/types'
import type { CliFlagsDefinition } from '~/types'
import { STANDALONE_VIDEO_PROVIDER_TARGETS } from './service-selector-normalization/provider-targets'
import {
  GEMINI_DURATION_SECONDS,
  GEMINI_VIDEO_ASPECT_RATIOS,
  GEMINI_VIDEO_RESOLUTIONS,
  GROK_VIDEO_ASPECT_RATIOS,
  GROK_VIDEO_DURATION_RANGE,
  GROK_VIDEO_RESOLUTIONS
} from '~/cli/commands/visuals/video/video-utils/video-normalization'
import { FAL_H3_ASPECT_RATIOS, FAL_H3_MAX_RESOLUTIONS, FAL_H3_RESOLUTIONS, FAL_SEEDANCE_RESOLUTIONS } from '~/cli/commands/visuals/video/video-services/fal-video-service/run-fal-video-gen'

export const videoGenFlags = {
  mode: strFlag(`Video generation mode: ${formatValueList(VIDEO_MODES)}`, DEFAULT_VIDEO_MODE),
  duration: strFlag(`Video duration in seconds: ${formatValuesByProvider([
    { provider: 'Gemini Omni', values: GEMINI_DURATION_SECONDS },
  ])}, ${formatRange(GROK_VIDEO_DURATION_RANGE)} (Grok; clamped to range), 4-30 or --duration=-1 for automatic duration (fal.ai Seedance 2.5), 5-15 (fal.ai H3/H3 Max). Defaults: provider-selected (Gemini; estimate: 10), 8 (Grok), 5 (others)`),
  'aspect-ratio': strFlag(`Video aspect ratio: ${formatValuesByProvider([
    { provider: 'Gemini Omni', values: GEMINI_VIDEO_ASPECT_RATIOS },
    { provider: 'Grok', values: GROK_VIDEO_ASPECT_RATIOS },
    { provider: 'fal.ai H3', values: FAL_H3_ASPECT_RATIOS }
  ])}; fal.ai Seedance 2.5 supports 21:9|16:9|4:3|1:1|3:4|9:16|auto. Default: 16:9 except fal.ai H3 (provider default) and fal.ai frame-input routes (follow input)`),
  resolution: strFlag(`Video resolution: ${formatValuesByProvider([
    { provider: 'Gemini Omni', values: GEMINI_VIDEO_RESOLUTIONS },
    { provider: 'Grok', values: GROK_VIDEO_RESOLUTIONS },
    { provider: 'fal.ai H3', values: FAL_H3_RESOLUTIONS },
    { provider: 'fal.ai Seedance 2.5', values: FAL_SEEDANCE_RESOLUTIONS },
    { provider: 'fal.ai H3 Max', values: FAL_H3_MAX_RESOLUTIONS }
  ])}. Defaults: 480p (Grok), 2k (fal.ai H3), 768p (fal.ai H3 Max), 720p (others)`),
  'input-image': strFlag('Video input image path, URL, or data URL for image-to-video and interpolation first frame'),
  'last-frame': strFlag('Video last-frame image path, URL, or data URL for interpolation'),
  'reference-image': strListFlag('Reference image path, URL, or data URL for reference-to-video; repeat up to 3 (Gemini), 5 (Grok), 9 (fal.ai H3), 30 (fal.ai Seedance 2.5); fal.ai H3 Max routes do not accept references'),
  'input-video': strFlag('Source MP4 path, URL, or data URL for Gemini Omni edit/extend (uploaded sources must be 10 seconds or less); use --reference-video for reference-to-video'),
  'previous-interaction-id': strFlag('Gemini Omni previous interaction id from a prior run manifest providerRequestId; used with --mode edit or --mode extend instead of re-uploading the video'),
  'generate-audio': {
    description: 'Video synchronized/native audio toggle (fal.ai Seedance 2.5: default true); other models use fixed provider audio behavior',
    type: Boolean,
    negatable: true
  },
  'reference-video': strListFlag('Reference MP4 video path, URL, or data URL; repeat up to 3 (Gemini/fal.ai MiniMax H3), 10 (fal.ai Seedance 2.5)'),
  'reference-audio': strListFlag('Reference MP3/WAV audio path, URL, or data URL; repeat up to 3 (fal.ai MiniMax H3), 10 (fal.ai Seedance 2.5); requires an image or video reference')
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
  'previous-interaction-id',
  'reference-video',
  'reference-audio'
] as const

export const videoCommandFlags = {
  ...withHelpGroup(videoProviderSelectionFlags, 'provider-selection'),
  ...withHelpGroup(pickFlags(videoGenFlags, videoGenerationOptionNames), 'video-options'),
  ...withHelpGroup(pickFlags(videoGenFlags, videoInputOptionNames), 'video-inputs'),
  ...withHelpGroup({ ...priceFlag, ...modelCostFilterFlag }, 'pricing')
} as const satisfies CliFlagsDefinition
