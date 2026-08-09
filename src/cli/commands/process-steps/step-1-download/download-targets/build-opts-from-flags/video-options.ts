import type { BuildDomainOptionsContext, RuntimeOptions, VideoRuntimeOptionKey } from '~/types'
import {
  parseOptionalIntFlag,
  parseOptionalNumberFlag,
  readOptionalBooleanFlag,
  readOptionalStringFlag,
  readOptionalStringListFlag
} from '../options/flag-readers'
import { resolveLocalConcurrency, resolveProviderConcurrency } from './concurrency'
import { pick } from '~/utils/cli-utils'

const VIDEO_MODEL_KEYS = [
  'geminiVideoModels', 'geminiVideoModel', 'minimaxVideoModels', 'minimaxVideoModel',
  'glmVideoModels', 'glmVideoModel', 'grokVideoModels', 'grokVideoModel',
  'runwayVideoModels', 'runwayVideoModel', 'ltxVideoModels', 'ltxVideoModel',
  'replicateVideoModels', 'replicateVideoModel', 'lumalabsVideoModels', 'lumalabsVideoModel',
  'falVideoModels', 'falVideoModel',
] as const satisfies readonly VideoRuntimeOptionKey[]

export const buildVideoOptions = (ctx: BuildDomainOptionsContext): Pick<RuntimeOptions, VideoRuntimeOptionKey> => {
  const { mergedFlags, explicitFlags, configuredFlags, allShortcutFlags, modelOptions, targetCounts } = ctx

  return {
    ...pick(modelOptions, VIDEO_MODEL_KEYS),
    videoProviderConcurrency: resolveProviderConcurrency(mergedFlags, 'video-provider-concurrency', allShortcutFlags['all-video'], targetCounts.hostedVideoTargetCount, explicitFlags, configuredFlags),
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
    replicateVideoAudio: readOptionalStringFlag(mergedFlags, 'replicate-video-audio'),
    replicateVideoPromptExpansion: readOptionalBooleanFlag(mergedFlags, 'replicate-video-prompt-expansion'),
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
