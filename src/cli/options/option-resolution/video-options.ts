import type { ResolvedFlagContext, VideoRuntimeOptions } from '~/types'
import { VIDEO_PRICING_MODEL_KEYS } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import {
  parseOptionalIntFlag,
  parseOptionalNumberFlag,
  readOptionalBooleanFlag,
  readOptionalStringFlag,
  readOptionalStringListFlag
} from './flag-readers'
import { resolveLocalConcurrency, resolveProviderConcurrency } from './concurrency'
import { pick } from '~/utils/cli-utils'

export const buildVideoOptions = (ctx: ResolvedFlagContext): VideoRuntimeOptions => {
  const { mergedFlags, explicitFlags, configuredFlags, allShortcutFlags, modelOptions } = ctx

  return {
    ...pick(modelOptions, VIDEO_PRICING_MODEL_KEYS),
    videoProviderConcurrency: resolveProviderConcurrency(mergedFlags, 'video-provider-concurrency', allShortcutFlags['all-video'], explicitFlags, configuredFlags),
    videoLocalConcurrency: resolveLocalConcurrency(mergedFlags, 'video-local-concurrency', explicitFlags, configuredFlags),
    allVideo: allShortcutFlags['all-video'],
    videoDuration: parseOptionalIntFlag(readOptionalStringFlag(mergedFlags, 'video-duration')),
    videoAspectRatio: readOptionalStringFlag(mergedFlags, 'video-aspect-ratio'),
    videoResolution: readOptionalStringFlag(mergedFlags, 'video-resolution'),
    videoMode: readOptionalStringFlag(mergedFlags, 'video-mode'),
    videoInputImage: readOptionalStringFlag(mergedFlags, 'video-input-image'),
    videoLastFrame: readOptionalStringFlag(mergedFlags, 'video-last-frame'),
    videoReferenceImages: readOptionalStringListFlag(mergedFlags, 'video-reference-image'),
    videoInputVideo: readOptionalStringFlag(mergedFlags, 'video-input-video'),
    videoGenerateAudio: readOptionalBooleanFlag(mergedFlags, 'video-generate-audio'),
    videoReferenceVideos: readOptionalStringListFlag(mergedFlags, 'video-reference-video'),
    videoReferenceAudios: readOptionalStringListFlag(mergedFlags, 'video-reference-audio'),
    replicateVideoSeed: parseOptionalNumberFlag(readOptionalStringFlag(mergedFlags, 'replicate-video-seed'), 'replicate-video-seed', {
      min: 0,
      max: 2147483647,
      integer: true
    }),
    replicateVideoNegativePrompt: readOptionalStringFlag(mergedFlags, 'replicate-video-negative-prompt'),
    replicateVideoMultiPrompt: readOptionalStringFlag(mergedFlags, 'replicate-video-multi-prompt'),
    replicateVideoMultiClip: readOptionalBooleanFlag(mergedFlags, 'replicate-video-multi-clip')
  }
}
