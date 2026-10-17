import type { ResolvedFlagContext, VideoRuntimeOptions } from '~/types'
import { VIDEO_PRICING_MODEL_KEYS } from '~/cli/commands/visuals/video/video-utils/video-pricing'
import {
  parseOptionalIntFlag,
  parseOptionalNumberFlag,
  readOptionalBooleanFlag,
  readOptionalStringFlag,
  readOptionalStringListFlag
} from './flag-readers'
import { resolveProviderConcurrency } from './concurrency'
import { pick } from '~/utils/cli-utils'
import { UsageError } from '~/utils/error-handler'

const resolveVideoControlName = (ctx: ResolvedFlagContext, name: string, alias: string): string => {
  const supplied = (flagName: string): boolean =>
    ctx.explicitFlags.has(flagName) || (Object.hasOwn(ctx.mergedFlags, flagName) && !ctx.configuredFlags.has(flagName))
  if (supplied(name) && supplied(alias)) {
    throw UsageError(`Do not combine --${name} with its --${alias} compatibility alias.`)
  }
  if (supplied(name)) return name
  if (supplied(alias)) return alias
  return Object.hasOwn(ctx.mergedFlags, name) ? name : alias
}

export const buildVideoOptions = (ctx: ResolvedFlagContext): VideoRuntimeOptions => {
  const { mergedFlags, explicitFlags, configuredFlags, allShortcutFlags, modelOptions } = ctx
  const seedFlag = resolveVideoControlName(ctx, 'seed', 'replicate-video-seed')
  const negativePromptFlag = resolveVideoControlName(ctx, 'negative-prompt', 'replicate-video-negative-prompt')
  const multiClipFlag = resolveVideoControlName(ctx, 'multi-clip', 'replicate-video-multi-clip')

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
    videoReferenceAudios: readOptionalStringListFlag(mergedFlags, 'reference-audio'),
    replicateVideoSeed: parseOptionalNumberFlag(readOptionalStringFlag(mergedFlags, seedFlag), seedFlag, {
      min: 0,
      max: 2147483647,
      integer: true
    }),
    replicateVideoNegativePrompt: readOptionalStringFlag(mergedFlags, negativePromptFlag),
    replicateVideoMultiClip: readOptionalBooleanFlag(mergedFlags, multiClipFlag)
  }
}
