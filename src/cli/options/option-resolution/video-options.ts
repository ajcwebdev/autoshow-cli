import type { ResolvedFlagContext, VideoRuntimeOptions } from '~/types'
import { VIDEO_PRICING_MODEL_KEYS } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import {
  parseOptionalIntFlag,
  parseOptionalNumberFlag,
  readOptionalBooleanFlag,
  readOptionalStringFlag,
  readOptionalStringListFlag
} from './flag-readers'
import { resolveProviderConcurrency } from './concurrency'
import { pick } from '~/utils/cli-utils'

export const buildVideoOptions = (ctx: ResolvedFlagContext): VideoRuntimeOptions => {
  const { mergedFlags, explicitFlags, configuredFlags, allShortcutFlags, modelOptions } = ctx

  return {
    ...pick(modelOptions, VIDEO_PRICING_MODEL_KEYS),
    videoProviderConcurrency: resolveProviderConcurrency(mergedFlags, 'video-provider-concurrency', allShortcutFlags['all-video'], explicitFlags, configuredFlags),
    allVideo: allShortcutFlags['all-video'],
    videoDuration: parseOptionalIntFlag(readOptionalStringFlag(mergedFlags, 'duration')),
    videoAspectRatio: readOptionalStringFlag(mergedFlags, 'aspect-ratio'),
    videoResolution: readOptionalStringFlag(mergedFlags, 'resolution'),
    videoMode: readOptionalStringFlag(mergedFlags, 'mode'),
    videoInputImage: readOptionalStringFlag(mergedFlags, 'input-image'),
    videoLastFrame: readOptionalStringFlag(mergedFlags, 'last-frame'),
    videoReferenceImages: readOptionalStringListFlag(mergedFlags, 'reference-image'),
    videoInputVideo: readOptionalStringFlag(mergedFlags, 'input-video'),
    videoGenerateAudio: readOptionalBooleanFlag(mergedFlags, 'generate-audio'),
    videoReferenceVideos: readOptionalStringListFlag(mergedFlags, 'reference-video'),
    videoReferenceAudios: readOptionalStringListFlag(mergedFlags, 'reference-audio'),
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
