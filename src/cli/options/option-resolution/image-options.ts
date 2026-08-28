import type { ImageRuntimeOptions, ResolvedFlagContext } from '~/types'
import { IMAGE_PRICING_MODEL_KEYS } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import {
  parseOptionalNumberFlag,
  parseOptionalPositiveIntFlag,
  readBooleanFlag,
  readOptionalStringFlag,
  readOptionalStringListFlag
} from './flag-readers'
import { resolveProviderConcurrency } from './concurrency'
import { pick } from '~/utils/cli-utils'

export const buildImageOptions = (ctx: ResolvedFlagContext): ImageRuntimeOptions => {
  const { mergedFlags, explicitFlags, configuredFlags, allShortcutFlags, modelOptions } = ctx

  return {
    ...pick(modelOptions, IMAGE_PRICING_MODEL_KEYS),
    imageProviderConcurrency: resolveProviderConcurrency(mergedFlags, 'image-provider-concurrency', allShortcutFlags['all-image'], explicitFlags, configuredFlags),
    imageAspectRatio: readOptionalStringFlag(mergedFlags, 'aspect-ratio'),
    imageSize: readOptionalStringFlag(mergedFlags, 'size'),
    imageQuality: readOptionalStringFlag(mergedFlags, 'quality'),
    imageFormat: readOptionalStringFlag(mergedFlags, 'format'),
    imageBackground: readOptionalStringFlag(mergedFlags, 'background'),
    imageCount: parseOptionalPositiveIntFlag(readOptionalStringFlag(mergedFlags, 'count'), 'count'),
    imageInputs: readOptionalStringListFlag(mergedFlags, 'input'),
    imageMask: readOptionalStringFlag(mergedFlags, 'mask'),
    imageResponseMode: readOptionalStringFlag(mergedFlags, 'response-mode'),
    geminiSearchGrounding: readBooleanFlag(mergedFlags, 'search-grounding') ? true : undefined,
    imageCompression: parseOptionalNumberFlag(readOptionalStringFlag(mergedFlags, 'compression'), 'compression', {
      min: 0,
      max: 100,
      integer: true
    }),
  }
}
