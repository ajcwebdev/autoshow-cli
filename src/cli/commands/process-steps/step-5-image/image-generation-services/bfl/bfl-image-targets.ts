import type { BflImageModel, ImageGenOptions, ImageTarget } from '~/types'
import { validateBflImageModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureBflImageGenSetup } from './bfl-image-gen'
import { normalizeBflImageOutputFormat, normalizeBflImageSize, runBflImageGen } from './run-bfl-image-gen'
import { assertNoUnsupportedFlags } from '../../image-utils/image-target-validation'
import {
  BFL_IMAGE_INPUT_MIME_TYPES,
  validateImageInputReferences
} from '../../image-utils/image-inputs'

export const collectBflImageTargets = (options: ImageGenOptions): ImageTarget[] => {
  const models = options.bflImageModels ?? []
  return models.flatMap((rawModel) => {
    const model: BflImageModel = validateBflImageModel(rawModel)
    assertNoUnsupportedFlags(options, [
      'imageAspectRatio',
      'imageQuality',
      'imageBackground',
      'imageCount',
      'imageMask',
      'imageResponseMode',
      { key: 'geminiSearchGrounding', when: value => value === true },
      'imageCompression'
    ], {
      provider: 'BFL',
      model,
      hint: 'Use --size WIDTHxHEIGHT for BFL dimensions, --format jpeg|png|webp for output format, and --input references.'
    })
    validateImageInputReferences(options.imageInputs, {
      provider: 'BFL',
      model,
      allowedMimeTypes: BFL_IMAGE_INPUT_MIME_TYPES,
      maxInputs: model.startsWith('flux-2-klein-') ? 4 : 8
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
