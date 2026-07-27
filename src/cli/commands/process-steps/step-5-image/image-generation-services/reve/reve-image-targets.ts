import type { ImageGenOptions, ImageTarget, ReveImageModel } from '~/types'
import { validateReveImageModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureReveImageGenSetup } from './reve-image-gen'
import { normalizeReveImageAspectRatio, normalizeReveImageOutputFormat, normalizeReveImageSize, runReveImageGen } from './run-reve-image-gen'
import { unsupportedFlagError } from '../../image-utils/image-target-validation'
import {
  REVE_IMAGE_INPUT_MIME_TYPES,
  validateImageInputReferences
} from '../../image-utils/image-inputs'

export const collectReveImageTargets = (options: ImageGenOptions): ImageTarget[] => {
  const models = options.reveImageModels ?? (options.reveImageModel ? [options.reveImageModel] : [])
  return models.flatMap((rawModel) => {
    const model: ReveImageModel = validateReveImageModel(rawModel)
    normalizeReveImageAspectRatio(options.imageAspectRatio)
    normalizeReveImageSize(options.imageSize)
    normalizeReveImageOutputFormat(options.imageFormat)
    const unsupported: string[] = []
    if (options.imageQuality) unsupported.push('--image-quality')
    if (options.imageBackground) unsupported.push('--image-background')
    if (options.imageCount !== undefined) unsupported.push('--image-count')
    if (options.imageMask !== undefined) unsupported.push('--image-mask')
    if (options.imageResponseMode !== undefined) unsupported.push('--image-response-mode')
    if (options.geminiSearchGrounding === true) unsupported.push('--gemini-search-grounding')
    if (options.imageCompression !== undefined) unsupported.push('--image-compression')
    if (unsupported.length > 0) {
      throw unsupportedFlagError('Reve', model, unsupported, 'Supported Reve image options: --image-aspect-ratio, --image-size WIDTHxHEIGHT fit-within resizing, --image-format png|jpeg|webp, and up to six --image-input references.')
    }
    if ((options.imageInputs?.length ?? 0) > 0 && model === 'reve-create@20250915') {
      throw unsupportedFlagError('Reve', model, ['--image-input'], 'Use --reve latest for Reve edit/remix workflows.')
    }
    validateImageInputReferences(options.imageInputs, {
      provider: 'Reve',
      model,
      allowedMimeTypes: REVE_IMAGE_INPUT_MIME_TYPES,
      maxInputs: 6
    })

    return [{
      service: 'reve',
      model,
      run: async (prompt, outputDir) => {
        await ensureReveImageGenSetup()
        return await runReveImageGen(prompt, outputDir, {
          model,
          inputs: options.imageInputs,
          aspectRatio: options.imageAspectRatio,
          imageSize: options.imageSize,
          outputFormat: options.imageFormat
        })
      }
    }]
  })
}
