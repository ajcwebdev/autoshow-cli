import type { ImageGenOptions, ImageTarget, ReplicateImageModel } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { validateReplicateImageModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureReplicateImageGenSetup } from './replicate-image-gen'
import {
  isReplicateQwenModel,
  isReplicateSeedreamModel,
  isReplicateWanModel,
  normalizeReplicateImageCount,
  normalizeReplicateImageOutputFormat,
  normalizeReplicateQwenAspectRatio,
  normalizeReplicateSeedreamAspectRatio,
  normalizeReplicateSeedreamSize,
  normalizeReplicateWanSize,
  runReplicateImageGen
} from './run-replicate-image-gen'
import {
  assertNoUnsupportedFlags,
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
    assertNoUnsupportedFlags(options, [
      'imageQuality',
      'imageBackground',
      'imageResponseMode',
      'imageCompression',
      'imageMask',
      { key: 'geminiSearchGrounding', when: value => value === true }
    ], {
      provider: 'Replicate',
      model,
      hint: 'Supported Replicate image options vary by model family: Seedream uses --size, --aspect-ratio, optional --format on Seedream 5, and --input; Qwen uses --aspect-ratio and one --input; Wan uses --size, --count 1-4, and --input references.'
    })

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
        throw unsupportedFlagError('Replicate', model, ['--size'], 'Use --aspect-ratio for Replicate Qwen image dimensions.')
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
    } else if (isReplicateWanModel(model)) {
      if (options.imageAspectRatio !== undefined) {
        throw unsupportedFlagError('Replicate', model, ['--aspect-ratio'], 'Use --size 1K|2K|4K or WIDTHxHEIGHT for Replicate Wan dimensions.')
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
      throw UsageError(`Unsupported Replicate image model "${model}".`)
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
