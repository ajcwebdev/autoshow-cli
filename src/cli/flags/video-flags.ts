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
  REPLICATE_WAN_DURATION_RANGE,
  REPLICATE_VIDEO_RESOLUTIONS
} from '~/cli/commands/visuals/video/video-utils/video-normalization'
import { FAL_H3_ASPECT_RATIOS, FAL_H3_MAX_RESOLUTIONS, FAL_H3_RESOLUTIONS, FAL_SEEDANCE_RESOLUTIONS } from '~/cli/commands/visuals/video/video-services/fal-video-service/run-fal-video-gen'

const seedanceExtraAspectRatios = REPLICATE_SEEDANCE_ASPECT_RATIOS.filter(
  (ratio) => !(REPLICATE_COMMON_ASPECT_RATIOS as readonly string[]).includes(ratio)
)
const ltxFastOnlyDurations = LTX_FAST_1080P_DURATION_SECONDS.filter(
  (seconds) => !(LTX_DURATION_SECONDS as readonly number[]).includes(seconds)
)

export const videoGenFlags = {
  mode: strFlag(`Video generation mode: ${formatValueList(VIDEO_MODES)}`, DEFAULT_VIDEO_MODE),
  duration: strFlag(`Video duration in seconds: ${formatValuesByProvider([
    { provider: 'Gemini Omni', values: GEMINI_DURATION_SECONDS },
    { provider: 'Luma Labs', values: LUMA_DURATION_SECONDS, note: 'rounds to the nearer value' },
    { provider: 'LTX 2.5', values: LTX_DURATION_SECONDS, note: `2.5 Fast at 720p/1080p in either orientation also accept ${formatValueList(ltxFastOnlyDurations)}` }
  ])}, ${formatRange(GROK_VIDEO_DURATION_RANGE)} (Grok; clamped to range), ${formatRange(REPLICATE_HAPPYHORSE_DURATION_RANGE)} (Replicate HappyHorse), ${formatRange(REPLICATE_WAN_DURATION_RANGE)} (Replicate Wan 3), 5|8|10|15 (Replicate PixVerse V6), ${formatRange(REPLICATE_SEEDANCE_DURATION_RANGE)} or --duration=-1 for automatic duration (Replicate/fal.ai Seedance 2.5), 5-15 (fal.ai H3/H3 Max). Defaults: provider-selected (Gemini; estimate: 10), 8 (Grok/LTX), 5 (others)`),
  'aspect-ratio': strFlag(`Video aspect ratio: ${formatValuesByProvider([
    { provider: 'Gemini Omni', values: GEMINI_VIDEO_ASPECT_RATIOS },
    { provider: 'Replicate', values: REPLICATE_COMMON_ASPECT_RATIOS },
    { provider: 'Luma Labs', values: LUMA_ASPECT_RATIOS },
    { provider: 'Grok', values: GROK_VIDEO_ASPECT_RATIOS },
    { provider: 'LTX 2.5', values: LTX_ASPECT_RATIOS },
    { provider: 'fal.ai H3', values: FAL_H3_ASPECT_RATIOS }
  ])}; Replicate Seedance 2.5 also supports ${formatValueList(seedanceExtraAspectRatios)}; Wan 3 supports adaptive; PixVerse V6 supports 16:9|9:16|1:1; fal.ai Seedance adds auto. Default: 16:9 except fal.ai H3 (provider default) and fal.ai frame-input routes (follow input)`),
  resolution: strFlag(`Video resolution: ${formatValuesByProvider([
    { provider: 'Gemini Omni', values: GEMINI_VIDEO_RESOLUTIONS },
    { provider: 'Grok', values: GROK_VIDEO_RESOLUTIONS },
    { provider: 'LTX 2.5', values: LTX_RESOLUTIONS },
    { provider: 'Replicate', values: REPLICATE_VIDEO_RESOLUTIONS, note: 'HappyHorse: 720p|1080p; Seedance: 480p|720p; Wan: 480p|720p|1080p; PixVerse: 360p|540p|720p|1080p' },
    { provider: 'Luma Labs', values: LUMA_RESOLUTIONS },
    { provider: 'fal.ai H3', values: FAL_H3_RESOLUTIONS },
    { provider: 'fal.ai Seedance 2.5', values: FAL_SEEDANCE_RESOLUTIONS },
    { provider: 'fal.ai H3 Max', values: FAL_H3_MAX_RESOLUTIONS }
  ])}. Defaults: 480p (Grok), 1080p (LTX), 2k (fal.ai H3), 768p (fal.ai H3 Max), 720p (others)`),
  'input-image': strFlag('Video input image path, URL, or data URL for image-to-video and interpolation first frame (including Luma Labs start-frame generation)'),
  'last-frame': strFlag('Video last-frame image path, URL, or data URL for interpolation'),
  'reference-image': strListFlag('Reference image path, URL, or data URL for reference-to-video; repeat up to 3 (Gemini), 5 (Grok), 9 (Replicate HappyHorse/fal.ai H3), 30 (Replicate/fal.ai Seedance 2.5); fal.ai H3 Max routes do not accept references'),
  'input-video': strFlag('Source MP4 path, URL, or data URL for Gemini Omni edit/extend (uploaded sources must be 10 seconds or less); use --reference-video for reference-to-video'),
  'previous-interaction-id': strFlag('Gemini Omni previous interaction id from a prior run manifest providerRequestId; used with --mode edit or --mode extend instead of re-uploading the video'),
  'generate-audio': {
    description: 'Video synchronized/native audio toggle (Replicate Seedance 2.5/PixVerse V6: provider default; fal.ai Seedance 2.5: default true); other models use fixed provider audio behavior',
    type: Boolean,
    negatable: true
  },
  'reference-video': strListFlag('Reference MP4 video path, URL, or data URL; repeat up to 3 (Gemini/fal.ai MiniMax H3), 10 (Replicate/fal.ai Seedance 2.5)'),
  'reference-audio': strListFlag('Reference MP3/WAV audio path, URL, or data URL; repeat up to 3 (fal.ai MiniMax H3), 10 (Replicate/fal.ai Seedance 2.5); requires an image or video reference'),
  seed: strFlag('Video seed: integer from 0 to 2147483647 (Replicate; default: provider-selected seed)'),
  'negative-prompt': strFlag('Video negative prompt (Replicate PixVerse V6/Wan 3; default: none)'),
  'multi-clip': {
    description: 'Multi-shot generation toggle (Replicate PixVerse V6; omitted by default for provider behavior)',
    type: Boolean,
    negatable: true
  },
  'replicate-video-seed': { ...strFlag('Compatibility alias for --seed; do not combine both spellings'), help: { hidden: true } },
  'replicate-video-negative-prompt': { ...strFlag('Compatibility alias for --negative-prompt; do not combine both spellings'), help: { hidden: true } },
  'replicate-video-multi-clip': {
    description: 'Compatibility alias for --multi-clip; do not combine both spellings',
    type: Boolean,
    negatable: true,
    help: { hidden: true }
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
  'generate-audio',
  'seed',
  'negative-prompt',
  'multi-clip'
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

const replicateOptionNames = [
  'replicate-video-seed',
  'replicate-video-negative-prompt',
  'replicate-video-multi-clip'
] as const

export const videoCommandFlags = {
  ...withHelpGroup(videoProviderSelectionFlags, 'provider-selection'),
  ...withHelpGroup(pickFlags(videoGenFlags, videoGenerationOptionNames), 'video-options'),
  ...withHelpGroup(pickFlags(videoGenFlags, videoInputOptionNames), 'video-inputs'),
  ...withHelpGroup(pickFlags(videoGenFlags, replicateOptionNames), 'replicate-video'),
  ...withHelpGroup({ ...priceFlag, ...modelCostFilterFlag }, 'pricing')
} as const satisfies CliFlagsDefinition
