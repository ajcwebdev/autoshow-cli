import type { FalImageModel, ImageGenOptions, ImageTarget } from '~/types'
import { validateFalImageModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { assertNoUnsupportedFlags } from '../../image-utils/image-target-validation'
import { validateImageInputReferences, REPLICATE_SEEDREAM_IMAGE_INPUT_MIME_TYPES } from '../../image-utils/image-inputs'
import { FAL_IMAGE_COUNT_RANGE, normalizeFalImageAspectRatio, runFalImageGen } from './run-fal-image-gen'
import { UsageError } from '~/utils/error-handler'

export const collectFalImageTargets = (options: ImageGenOptions): ImageTarget[] => {
  const models = options.falImageModels ?? []
  return models.map((rawModel) => {
    const model: FalImageModel = validateFalImageModel(rawModel)
    assertNoUnsupportedFlags(options, [
      'imageQuality',
      'imageBackground',
      { key: 'imageMask', when: Boolean },
      { key: 'imageResponseMode', when: Boolean },
      { key: 'geminiSearchGrounding', when: Boolean },
      'imageCompression'
    ], {
      provider: 'fal.ai',
      model,
      hint: 'fal.ai image support varies by model: common controls are --format and --count; MAI and Reve use --aspect-ratio, while HiDream and Qwen use --size.'
    })
    if (options.imageCount !== undefined && (!Number.isInteger(options.imageCount) || options.imageCount < FAL_IMAGE_COUNT_RANGE[0] || options.imageCount > FAL_IMAGE_COUNT_RANGE[1])) {
      throw UsageError(`Invalid --count value "${String(options.imageCount)}" for fal.ai/${model}. Supported range: 1-4.`)
    }
    if (options.imageAspectRatio && (model.startsWith('microsoft/') || model === 'reve/2.1')) normalizeFalImageAspectRatio(model, options.imageAspectRatio)
    if (options.imageAspectRatio && (model === 'fal-ai/hidream-o1-image' || model === 'alibaba/qwen-image-3')) throw UsageError(`--aspect-ratio is not supported by fal.ai/${model}; use --size WIDTHxHEIGHT.`)
    const maxInputs = model === 'alibaba/qwen-image-3' ? 3 : model === 'reve/2.1' ? 1 : model.startsWith('microsoft/') ? 0 : 9
    validateImageInputReferences(options.imageInputs, { provider: 'fal.ai', model, allowedMimeTypes: REPLICATE_SEEDREAM_IMAGE_INPUT_MIME_TYPES, maxInputs })
    return {
      service: 'fal' as const,
      model,
      run: async (prompt, outputDir) => await runFalImageGen(prompt, outputDir, { model, inputs: options.imageInputs, imageSize: options.imageSize, aspectRatio: options.imageAspectRatio, count: options.imageCount, outputFormat: options.imageFormat })
    }
  })
}
