import type { BflImageModel, ImageGenOptions, ImageTarget } from '~/types'
import { validateBflImageModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureBflImageGenSetup } from './bfl-image-gen'
import { normalizeBflImageOutputFormat, normalizeBflImageSize, runBflImageGen } from './run-bfl-image-gen'
import { unsupportedFlagError } from '../../image-utils/image-target-validation'
import {
  BFL_IMAGE_INPUT_MIME_TYPES,
  validateImageInputReferences
} from '../../image-utils/image-inputs'

export const collectBflImageTargets = (options: ImageGenOptions): ImageTarget[] => {
  const models = options.bflImageModels ?? (options.bflImageModel ? [options.bflImageModel] : [])
  return models.flatMap((rawModel) => {
    const model: BflImageModel = validateBflImageModel(rawModel)
    const unsupported: string[] = []
    if (options.imageAspectRatio) unsupported.push('--image-aspect-ratio')
    if (options.imageQuality) unsupported.push('--image-quality')
    if (options.imageBackground) unsupported.push('--image-background')
    if (options.imageCount !== undefined) unsupported.push('--image-count')
    if (options.imageMask !== undefined) unsupported.push('--image-mask')
    if (options.imageResponseMode !== undefined) unsupported.push('--image-response-mode')
    if (options.geminiSearchGrounding === true) unsupported.push('--gemini-search-grounding')
    if (options.imageCompression !== undefined) unsupported.push('--image-compression')
    if (unsupported.length > 0) {
      throw unsupportedFlagError('BFL', model, unsupported, 'Use --image-size WIDTHxHEIGHT for BFL dimensions, --image-format jpeg|png|webp for output format, and --image-input references.')
    }
    validateImageInputReferences(options.imageInputs, {
      provider: 'BFL',
      model,
      allowedMimeTypes: BFL_IMAGE_INPUT_MIME_TYPES,
      maxInputs: 8
    })
    normalizeBflImageSize(options.imageSize)
    normalizeBflImageOutputFormat(options.imageFormat)

    return [{
      service: 'bfl',
      model,
      run: async (prompt, outputDir) => {
        await ensureBflImageGenSetup()
        return await runBflImageGen(prompt, outputDir, {
          model,
          imageSize: options.imageSize,
          outputFormat: options.imageFormat,
          inputs: options.imageInputs
        })
      }
    }]
  })
}
