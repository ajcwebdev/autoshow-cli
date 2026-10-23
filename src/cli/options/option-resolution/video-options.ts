import type { ResolvedFlagContext, VideoRuntimeOptions } from '~/types'
import { VIDEO_PRICING_MODEL_KEYS } from '~/cli/commands/visuals/video/video-utils/video-pricing'
import {
  parseOptionalIntFlag,
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
    videoPreviousInteractionId: readOptionalStringFlag(mergedFlags, 'previous-interaction-id'),
    videoGenerateAudio: readOptionalBooleanFlag(mergedFlags, 'generate-audio'),
    videoReferenceVideos: readOptionalStringListFlag(mergedFlags, 'reference-video'),
    videoReferenceAudios: readOptionalStringListFlag(mergedFlags, 'reference-audio')
  }
}
