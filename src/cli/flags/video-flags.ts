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

export const videoGenFlags = {
  mode: strFlag(`Video generation mode: ${formatValueList(VIDEO_MODES)}`, DEFAULT_VIDEO_MODE),
  duration: strFlag(`Video duration in seconds: ${formatValuesByProvider([
    { provider: 'Gemini Omni', values: GEMINI_DURATION_SECONDS },
  ])}, ${formatRange(GROK_VIDEO_DURATION_RANGE)} (Grok; clamped to range). Defaults: provider-selected (Gemini; estimate: 10), 8 (Grok)`),
  'aspect-ratio': strFlag(`Video aspect ratio: ${formatValuesByProvider([
    { provider: 'Gemini Omni', values: GEMINI_VIDEO_ASPECT_RATIOS },
    { provider: 'Grok', values: GROK_VIDEO_ASPECT_RATIOS }
  ])}. Default: 16:9`),
  resolution: strFlag(`Video resolution: ${formatValuesByProvider([
    { provider: 'Gemini Omni', values: GEMINI_VIDEO_RESOLUTIONS },
    { provider: 'Grok', values: GROK_VIDEO_RESOLUTIONS }
  ])}. Defaults: 480p (Grok), 720p (Gemini)`),
  'input-image': strFlag('Video input image path, URL, or data URL for image-to-video and interpolation first frame'),
  'last-frame': strFlag('Video last-frame image path, URL, or data URL for interpolation'),
  'reference-image': strListFlag('Reference image path, URL, or data URL for reference-to-video; repeat up to 3 (Gemini), 5 (Grok)'),
  'input-video': strFlag('Source MP4 path, URL, or data URL for Gemini Omni edit/extend (uploaded sources must be 10 seconds or less); use --reference-video for reference-to-video'),
  'previous-interaction-id': strFlag('Gemini Omni previous interaction id from a prior run manifest providerRequestId; used with --mode edit or --mode extend instead of re-uploading the video'),
  'reference-video': strListFlag('Reference MP4 video path, URL, or data URL; repeat up to 3 (Gemini)')
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
  'resolution'
] as const

export const videoInputOptionNames = [
  'input-image',
  'last-frame',
  'reference-image',
  'input-video',
  'previous-interaction-id',
  'reference-video'
] as const

export const videoCommandFlags = {
  ...withHelpGroup(videoProviderSelectionFlags, 'provider-selection'),
  ...withHelpGroup(pickFlags(videoGenFlags, videoGenerationOptionNames), 'video-options'),
  ...withHelpGroup(pickFlags(videoGenFlags, videoInputOptionNames), 'video-inputs'),
  ...withHelpGroup({ ...priceFlag, ...modelCostFilterFlag }, 'pricing')
} as const satisfies CliFlagsDefinition
