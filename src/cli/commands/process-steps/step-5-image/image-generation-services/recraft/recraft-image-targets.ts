import type { ImageGenOptions, ImageTarget, RecraftImageModel } from '~/types'
import { validateRecraftImageModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureRecraftImageGenSetup } from './recraft-image-gen'
import { normalizeRecraftImageSize, RECRAFT_IMAGE_COUNT_RANGE, runRecraftImageGen } from './run-recraft-image-gen'
import {
  collectUnsupportedCommonFlags,
  IMAGE_OPTION_LABELS,
  unsupportedFlagError,
  validateImageCount
} from '../../image-utils/image-target-validation'

export const collectRecraftImageTargets = (options: ImageGenOptions): ImageTarget[] => {
  const models = options.recraftImageModels ?? (options.recraftImageModel ? [options.recraftImageModel] : [])
  return models.flatMap((rawModel) => {
    const model: RecraftImageModel = validateRecraftImageModel(rawModel)
    validateImageCount('Recraft', model, options.imageCount, ...RECRAFT_IMAGE_COUNT_RANGE)
    normalizeRecraftImageSize(model, options.imageSize, options.imageAspectRatio)
    const unsupported = collectUnsupportedCommonFlags(options, [
      'imageQuality',
      'imageFormat',
      'imageBackground',
      'imageResponseMode',
      'imageCompression'
    ], IMAGE_OPTION_LABELS)
    if ((options.imageInputs?.length ?? 0) > 0) unsupported.push('--image-input')
    if (options.imageMask !== undefined) unsupported.push('--image-mask')
    if (options.geminiSearchGrounding === true) unsupported.push('--image-search-grounding')
    if (unsupported.length > 0) {
      throw unsupportedFlagError('Recraft', model, unsupported, `Supported Recraft image options: --image-count ${RECRAFT_IMAGE_COUNT_RANGE[0]}-${RECRAFT_IMAGE_COUNT_RANGE[1]} and either --image-size or --image-aspect-ratio using Recraft-supported values.`)
    }

    return [{
      service: 'recraft',
      model,
      run: async (prompt, outputDir) => {
        await ensureRecraftImageGenSetup()
        return await runRecraftImageGen(prompt, outputDir, {
          model,
          count: options.imageCount,
          imageSize: options.imageSize,
          aspectRatio: options.imageAspectRatio
        })
      }
    }]
  })
}
