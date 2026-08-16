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
    videoSize: readOptionalStringFlag(mergedFlags, 'video-size'),
    videoAspectRatio: readOptionalStringFlag(mergedFlags, 'video-aspect-ratio'),
    videoResolution: readOptionalStringFlag(mergedFlags, 'video-resolution'),
    videoMode: readOptionalStringFlag(mergedFlags, 'video-mode'),
    videoInputImage: readOptionalStringFlag(mergedFlags, 'video-input-image'),
    videoLastFrame: readOptionalStringFlag(mergedFlags, 'video-last-frame'),
    videoReferenceImages: readOptionalStringListFlag(mergedFlags, 'video-reference-image'),
    videoInputVideo: readOptionalStringFlag(mergedFlags, 'video-input-video'),
    replicateVideoSeed: parseOptionalNumberFlag(readOptionalStringFlag(mergedFlags, 'replicate-video-seed'), 'replicate-video-seed', {
      min: 0,
      max: 2147483647,
      integer: true
    }),
    replicateVideoGenerateAudio: readOptionalBooleanFlag(mergedFlags, 'replicate-video-generate-audio'),
    replicateVideoReferenceVideos: readOptionalStringListFlag(mergedFlags, 'replicate-video-reference-video'),
    replicateVideoReferenceAudios: readOptionalStringListFlag(mergedFlags, 'replicate-video-reference-audio'),
    replicateVideoNegativePrompt: readOptionalStringFlag(mergedFlags, 'replicate-video-negative-prompt'),
    replicateVideoMultiPrompt: readOptionalStringFlag(mergedFlags, 'replicate-video-multi-prompt'),
    replicateVideoMultiClip: readOptionalBooleanFlag(mergedFlags, 'replicate-video-multi-clip'),
    falVideoGenerateAudio: readOptionalBooleanFlag(mergedFlags, 'fal-video-generate-audio'),
    falVideoReferenceVideos: readOptionalStringListFlag(mergedFlags, 'fal-video-reference-video'),
    falVideoReferenceAudios: readOptionalStringListFlag(mergedFlags, 'fal-video-reference-audio'),
    grokVideoStorageFilename: readOptionalStringFlag(mergedFlags, 'grok-video-storage-filename'),
    grokVideoStorageExpiresAfter: parseOptionalNumberFlag(readOptionalStringFlag(mergedFlags, 'grok-video-storage-expires-after'), 'grok-video-storage-expires-after', {
      min: 1,
      max: 2592000,
      integer: true
    }),
  }
}
