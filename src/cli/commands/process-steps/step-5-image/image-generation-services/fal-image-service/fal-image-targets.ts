import type { FalImageModel, ImageGenOptions, ImageTarget } from '~/types'
import { validateFalImageModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { unsupportedFlagError } from '../../image-utils/image-target-validation'
import { validateImageInputReferences, REPLICATE_SEEDREAM_IMAGE_INPUT_MIME_TYPES } from '../../image-utils/image-inputs'
import { FAL_IMAGE_COUNT_RANGE, normalizeFalImageAspectRatio, runFalImageGen } from './run-fal-image-gen'
import { CLIUsageError } from '~/utils/error-handler'

export const collectFalImageTargets = (options: ImageGenOptions): ImageTarget[] => {
  const models = options.falImageModels ?? (options.falImageModel ? [options.falImageModel] : [])
  return models.map((rawModel) => {
    const model: FalImageModel = validateFalImageModel(rawModel)
    const unsupported: string[] = []
    if (options.imageQuality) unsupported.push('--image-quality')
    if (options.imageBackground) unsupported.push('--image-background')
    if (options.imageMask) unsupported.push('--image-mask')
    if (options.imageResponseMode) unsupported.push('--image-response-mode')
    if (options.geminiSearchGrounding) unsupported.push('--image-search-grounding')
    if (options.imageCompression !== undefined) unsupported.push('--image-compression')
    if (unsupported.length) throw unsupportedFlagError('fal.ai', model, unsupported, 'fal.ai image support varies by model: common controls are --image-format and --image-count; MAI and Reve use --image-aspect-ratio, while HiDream and Qwen use --image-size.')
    if (options.imageCount !== undefined && (!Number.isInteger(options.imageCount) || options.imageCount < FAL_IMAGE_COUNT_RANGE[0] || options.imageCount > FAL_IMAGE_COUNT_RANGE[1])) {
      throw CLIUsageError(`Invalid --image-count value "${String(options.imageCount)}" for fal.ai/${model}. Supported range: 1-4.`)
    }
    if (options.imageAspectRatio && (model.startsWith('microsoft/') || model === 'reve/2.1')) normalizeFalImageAspectRatio(model, options.imageAspectRatio)
    if (options.imageAspectRatio && (model === 'fal-ai/hidream-o1-image' || model === 'alibaba/qwen-image-3')) throw CLIUsageError(`--image-aspect-ratio is not supported by fal.ai/${model}; use --image-size WIDTHxHEIGHT.`)
    const maxInputs = model === 'alibaba/qwen-image-3' ? 3 : model === 'reve/2.1' ? 1 : model.startsWith('microsoft/') ? 0 : 9
    validateImageInputReferences(options.imageInputs, { provider: 'fal.ai', model, allowedMimeTypes: REPLICATE_SEEDREAM_IMAGE_INPUT_MIME_TYPES, maxInputs })
    return {
      service: 'fal' as const,
      model,
      run: async (prompt, outputDir) => await runFalImageGen(prompt, outputDir, { model, inputs: options.imageInputs, imageSize: options.imageSize, aspectRatio: options.imageAspectRatio, count: options.imageCount, outputFormat: options.imageFormat })
    }
  })
}
