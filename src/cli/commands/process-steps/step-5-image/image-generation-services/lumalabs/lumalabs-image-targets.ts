import type { ImageGenOptions, ImageTarget, LumalabsImageModel } from '~/types'
import { validateLumalabsImageModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureLumalabsImageGenSetup } from './lumalabs-image-gen'
import { normalizeLumalabsAspectRatio, normalizeLumalabsImageOutputFormat, runLumalabsImageGen } from './run-lumalabs-image-gen'
import { unsupportedFlagError } from '../../image-utils/image-target-validation'
import {
  LUMALABS_IMAGE_INPUT_MIME_TYPES,
  validateImageInputReferences
} from '../../image-utils/image-inputs'

export const LUMALABS_MAX_IMAGE_INPUTS = 9

export const collectLumalabsImageTargets = (options: ImageGenOptions): ImageTarget[] => {
  const models = options.lumalabsImageModels ?? (options.lumalabsImageModel ? [options.lumalabsImageModel] : [])
  return models.flatMap((rawModel) => {
    const model: LumalabsImageModel = validateLumalabsImageModel(rawModel)
    normalizeLumalabsAspectRatio(options.imageAspectRatio)
    normalizeLumalabsImageOutputFormat(options.imageFormat)
    const unsupported: string[] = []
    if (options.imageSize) unsupported.push('--image-size')
    if (options.imageQuality) unsupported.push('--image-quality')
    if (options.imageBackground) unsupported.push('--image-background')
    if (options.imageCount !== undefined) unsupported.push('--image-count')
    if (options.imageMask !== undefined) unsupported.push('--image-mask')
    if (options.imageResponseMode !== undefined) unsupported.push('--image-response-mode')
    if (options.geminiSearchGrounding === true) unsupported.push('--image-search-grounding')
    if (options.imageCompression !== undefined) unsupported.push('--image-compression')
    if (unsupported.length > 0) {
      throw unsupportedFlagError('Luma Labs', model, unsupported, 'Supported Luma Labs image options: --image-aspect-ratio, --image-format png|jpeg, and up to nine --image-input references.')
    }
    validateImageInputReferences(options.imageInputs, {
      provider: 'Luma Labs',
      model,
      allowedMimeTypes: LUMALABS_IMAGE_INPUT_MIME_TYPES,
      maxInputs: LUMALABS_MAX_IMAGE_INPUTS
    })

    return [{
      service: 'lumalabs',
      model,
      run: async (prompt, outputDir) => {
        await ensureLumalabsImageGenSetup()
        return await runLumalabsImageGen(prompt, outputDir, {
          model,
          aspectRatio: options.imageAspectRatio,
          outputFormat: options.imageFormat,
          inputs: options.imageInputs
        })
      }
    }]
  })
}
