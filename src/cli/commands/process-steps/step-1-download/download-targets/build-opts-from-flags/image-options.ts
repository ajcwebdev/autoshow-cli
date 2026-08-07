import type { BuildDomainOptionsContext, ImageRuntimeOptionKey, RuntimeOptions } from '~/types'
import {
  parseOptionalNumberFlag,
  parseOptionalPositiveIntFlag,
  readBooleanFlag,
  readOptionalStringFlag,
  readOptionalStringListFlag
} from '../options/flag-readers'
import { resolveLocalConcurrency, resolveProviderConcurrency } from './concurrency'

export const buildImageOptions = (ctx: BuildDomainOptionsContext): Pick<RuntimeOptions, ImageRuntimeOptionKey> => {
  const { mergedFlags, explicitFlags, configuredFlags, allShortcutFlags, modelOptions, targetCounts } = ctx
  const {
    geminiImageModels,
    geminiImageModel,
    openaiImageModels,
    openaiImageModel,
    grokImageModels,
    grokImageModel,
    bflImageModels,
    bflImageModel,
    recraftImageModels,
    recraftImageModel,
    replicateImageModels,
    replicateImageModel,
    lumalabsImageModels,
    lumalabsImageModel,
    falImageModels,
    falImageModel,
  } = modelOptions

  return {
    imageProviderConcurrency: resolveProviderConcurrency(mergedFlags, 'image-provider-concurrency', allShortcutFlags['all-image'], targetCounts.hostedImageTargetCount, explicitFlags, configuredFlags),
    imageLocalConcurrency: resolveLocalConcurrency(mergedFlags, 'image-local-concurrency', explicitFlags, configuredFlags),
    geminiImageModels,
    geminiImageModel,
    openaiImageModels,
    openaiImageModel,
    grokImageModels,
    grokImageModel,
    bflImageModels,
    bflImageModel,
    recraftImageModels,
    recraftImageModel,
    replicateImageModels,
    replicateImageModel,
    lumalabsImageModels,
    lumalabsImageModel,
    falImageModels,
    falImageModel,
    imageAspectRatio: readOptionalStringFlag(mergedFlags, 'image-aspect-ratio'),
    imageSize: readOptionalStringFlag(mergedFlags, 'image-size'),
    imageQuality: readOptionalStringFlag(mergedFlags, 'image-quality'),
    imageFormat: readOptionalStringFlag(mergedFlags, 'image-format'),
    imageBackground: readOptionalStringFlag(mergedFlags, 'image-background'),
    imageCount: parseOptionalPositiveIntFlag(readOptionalStringFlag(mergedFlags, 'image-count'), 'image-count'),
    imageInputs: readOptionalStringListFlag(mergedFlags, 'image-input'),
    imageMask: readOptionalStringFlag(mergedFlags, 'image-mask'),
    imageResponseMode: readOptionalStringFlag(mergedFlags, 'image-response-mode'),
    geminiSearchGrounding: readBooleanFlag(mergedFlags, 'image-search-grounding') ? true : undefined,
    imageCompression: parseOptionalNumberFlag(readOptionalStringFlag(mergedFlags, 'image-compression'), 'image-compression', {
      min: 0,
      max: 100,
      integer: true
    }),
  }
}
