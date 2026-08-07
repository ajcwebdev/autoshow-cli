import type { ImageGenOptions, ImageTarget, ReplicateImageModel } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { validateReplicateImageModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureReplicateImageGenSetup } from './replicate-image-gen'
import {
  isReplicateErnieModel,
  isReplicateIdeogramModel,
  isReplicateQwenModel,
  isReplicateSeedreamModel,
  isReplicateWanModel,
  normalizeReplicateImageCount,
  normalizeReplicateImageOutputFormat,
  normalizeReplicateErnieSize,
  normalizeReplicateIdeogramSize,
  normalizeReplicateQwenAspectRatio,
  normalizeReplicateSeedreamAspectRatio,
  normalizeReplicateSeedreamSize,
  normalizeReplicateWanSize,
  runReplicateImageGen
} from './run-replicate-image-gen'
import {
  collectUnsupportedCommonFlags,
  IMAGE_OPTION_LABELS,
  unsupportedFlagError
} from '../../image-utils/image-target-validation'
import {
  REPLICATE_QWEN_IMAGE_INPUT_MIME_TYPES,
  REPLICATE_SEEDREAM_IMAGE_INPUT_MIME_TYPES,
  REPLICATE_WAN_IMAGE_INPUT_MIME_TYPES,
  validateImageInputReferences
} from '../../image-utils/image-inputs'

export const collectReplicateImageTargets = (options: ImageGenOptions): ImageTarget[] => {
  const models = options.replicateImageModels ?? []
  return models.flatMap((rawModel) => {
    const model: ReplicateImageModel = validateReplicateImageModel(rawModel)
    const unsupported = collectUnsupportedCommonFlags(options, [
      'imageQuality',
      'imageBackground',
      'imageResponseMode',
      'imageCompression'
    ], IMAGE_OPTION_LABELS)
    if (options.imageMask !== undefined) unsupported.push('--image-mask')
    if (options.geminiSearchGrounding === true) unsupported.push('--image-search-grounding')
    if (unsupported.length > 0) {
      throw unsupportedFlagError(
        'Replicate',
        model,
        unsupported,
        'Supported Replicate image options vary by model family: Seedream uses --image-size, --image-aspect-ratio, optional --image-format on Seedream 5, and --image-input; Ideogram uses --image-size WIDTHxHEIGHT; ERNIE uses --image-size WIDTHxHEIGHT, --image-count 1-4, and --image-format; Qwen uses --image-aspect-ratio and one --image-input; Wan uses --image-size, --image-count 1-4, and --image-input references.'
      )
    }

    if (isReplicateSeedreamModel(model)) {
      normalizeReplicateSeedreamSize(model, options.imageSize)
      normalizeReplicateSeedreamAspectRatio(model, options.imageAspectRatio)
      normalizeReplicateImageOutputFormat(model, options.imageFormat)
      normalizeReplicateImageCount(model, options.imageCount)
      validateImageInputReferences(options.imageInputs, {
        provider: 'Replicate',
        model,
        allowedMimeTypes: REPLICATE_SEEDREAM_IMAGE_INPUT_MIME_TYPES,
        maxInputs: model === 'bytedance/seedream-5-pro' ? 10 : 14
      })
    } else if (isReplicateQwenModel(model)) {
      if (options.imageSize !== undefined) {
        throw unsupportedFlagError('Replicate', model, ['--image-size'], 'Use --image-aspect-ratio for Replicate Qwen image dimensions.')
      }
      normalizeReplicateQwenAspectRatio(model, options.imageAspectRatio)
      normalizeReplicateImageOutputFormat(model, options.imageFormat)
      normalizeReplicateImageCount(model, options.imageCount)
      validateImageInputReferences(options.imageInputs, {
        provider: 'Replicate',
        model,
        allowedMimeTypes: REPLICATE_QWEN_IMAGE_INPUT_MIME_TYPES,
        maxInputs: 1
      })
    } else if (isReplicateIdeogramModel(model)) {
      if (options.imageAspectRatio !== undefined) {
        throw unsupportedFlagError('Replicate', model, ['--image-aspect-ratio'], 'Use --image-size WIDTHxHEIGHT or omit it for automatic Ideogram sizing.')
      }
      if ((options.imageInputs?.length ?? 0) > 0) {
        throw unsupportedFlagError('Replicate', model, ['--image-input'], 'Replicate Ideogram V4 endpoints are text-to-image only.')
      }
      normalizeReplicateIdeogramSize(model, options.imageSize)
      normalizeReplicateImageOutputFormat(model, options.imageFormat)
      normalizeReplicateImageCount(model, options.imageCount)
    } else if (isReplicateErnieModel(model)) {
      if (options.imageAspectRatio !== undefined) {
        throw unsupportedFlagError('Replicate', model, ['--image-aspect-ratio'], 'Use --image-size WIDTHxHEIGHT for Replicate ERNIE dimensions.')
      }
      if ((options.imageInputs?.length ?? 0) > 0) {
        throw unsupportedFlagError('Replicate', model, ['--image-input'], 'Replicate ERNIE Image endpoints are text-to-image only.')
      }
      normalizeReplicateErnieSize(model, options.imageSize)
      normalizeReplicateImageOutputFormat(model, options.imageFormat)
      normalizeReplicateImageCount(model, options.imageCount)
    } else if (isReplicateWanModel(model)) {
      if (options.imageAspectRatio !== undefined) {
        throw unsupportedFlagError('Replicate', model, ['--image-aspect-ratio'], 'Use --image-size 1K|2K|4K or WIDTHxHEIGHT for Replicate Wan dimensions.')
      }
      normalizeReplicateWanSize(model, options.imageSize, (options.imageInputs?.length ?? 0) > 0)
      normalizeReplicateImageOutputFormat(model, options.imageFormat)
      normalizeReplicateImageCount(model, options.imageCount)
      validateImageInputReferences(options.imageInputs, {
        provider: 'Replicate',
        model,
        allowedMimeTypes: REPLICATE_WAN_IMAGE_INPUT_MIME_TYPES,
        maxInputs: 9
      })
    } else {
      throw CLIUsageError(`Unsupported Replicate image model "${model}".`)
    }

    return [{
      service: 'replicate',
      model,
      run: async (prompt, outputDir) => {
        await ensureReplicateImageGenSetup()
        return await runReplicateImageGen(prompt, outputDir, {
          model,
          inputs: options.imageInputs,
          imageSize: options.imageSize,
          aspectRatio: options.imageAspectRatio,
          count: options.imageCount,
          outputFormat: options.imageFormat
        })
      }
    }]
  })
}
