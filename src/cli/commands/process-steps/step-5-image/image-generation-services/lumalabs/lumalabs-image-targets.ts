import type { ImageGenOptions, ImageTarget, LumalabsImageModel } from '~/types'
import { validateLumalabsImageModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureLumalabsImageGenSetup } from './lumalabs-image-gen'
import { normalizeLumalabsAspectRatio, normalizeLumalabsImageOutputFormat, runLumalabsImageGen } from './run-lumalabs-image-gen'
import { assertNoUnsupportedFlags } from '../../image-utils/image-target-validation'
import {
  LUMALABS_IMAGE_INPUT_MIME_TYPES,
  validateImageInputReferences
} from '../../image-utils/image-inputs'

export const LUMALABS_MAX_IMAGE_INPUTS = 9

export const collectLumalabsImageTargets = (options: ImageGenOptions): ImageTarget[] => {
  const models = options.lumalabsImageModels ?? []
  return models.flatMap((rawModel) => {
    const model: LumalabsImageModel = validateLumalabsImageModel(rawModel)
    normalizeLumalabsAspectRatio(options.imageAspectRatio)
    normalizeLumalabsImageOutputFormat(options.imageFormat)
    assertNoUnsupportedFlags(options, [
      'imageSize',
      'imageQuality',
      'imageBackground',
      'imageCount',
      'imageMask',
      'imageResponseMode',
      { key: 'geminiSearchGrounding', when: value => value === true },
      'imageCompression'
    ], {
      provider: 'Luma Labs',
      model,
      hint: 'Supported Luma Labs image options: --aspect-ratio, --format png|jpeg, and up to nine --input references.'
    })
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
