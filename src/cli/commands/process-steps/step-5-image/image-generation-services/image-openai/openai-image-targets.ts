import type { ImageGenOptions, ImageTarget, OpenAIImageModel } from '~/types'
import { validateOpenAIImageModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureOpenAIImageGenSetup } from './openai-image-gen'
import { runOpenAIImageGen } from './run-openai-image-gen'
import { OPENAI_IMAGE_COUNT_RANGE, validateOpenAIImageOptions } from './openai-image-options'
export { OPENAI_FIXED_IMAGE_SIZE_VALUES, OPENAI_IMAGE_FORMAT_VALUES, OPENAI_IMAGE_BACKGROUND_VALUES, OPENAI_IMAGE_COUNT_RANGE, OPENAI_IMAGE_COMPRESSION_RANGE } from './openai-image-options'
import {
  assertNoUnsupportedFlags,
  hasEditInputs,
  unsupportedFlagError,
  validateImageCount
} from '../../image-utils/image-target-validation'
import {
  OPENAI_IMAGE_INPUT_MIME_TYPES,
  OPENAI_IMAGE_MASK_MIME_TYPES,
  validateImageInputReferences,
  validateImageMaskReference
} from '../../image-utils/image-inputs'

export const normalizeOpenAIImageExtension = (format: string | undefined): string => {
  if (format === 'jpeg') {
    return 'jpg'
  }
  return format ?? 'png'
}

export const collectOpenAIImageTargets = (options: ImageGenOptions): ImageTarget[] => {
  const models = options.openaiImageModels ?? []
  return models.flatMap((rawModel) => {
    const model: OpenAIImageModel = validateOpenAIImageModel(rawModel)
    validateImageCount('OpenAI', model, options.imageCount, ...OPENAI_IMAGE_COUNT_RANGE)
    validateOpenAIImageOptions(model, {
      imageSize: options.imageSize,
      imageQuality: options.imageQuality,
      imageFormat: options.imageFormat,
      imageBackground: options.imageBackground,
      imageCompression: options.imageCompression
    })
    if (options.imageAspectRatio !== undefined) {
      throw unsupportedFlagError('OpenAI', model, ['--aspect-ratio'], 'Use --size for OpenAI dimensions.')
    }
    assertNoUnsupportedFlags(options, [
      'imageResponseMode',
      { key: 'geminiSearchGrounding', when: value => value === true }
    ], { provider: 'OpenAI', model, hint: 'These flags are Gemini-only.' })
    validateImageInputReferences(options.imageInputs, {
      provider: 'OpenAI',
      model,
      allowedMimeTypes: OPENAI_IMAGE_INPUT_MIME_TYPES
    })
    validateImageMaskReference(options.imageMask, {
      provider: 'OpenAI',
      model,
      allowedMimeTypes: OPENAI_IMAGE_MASK_MIME_TYPES
    })

    return [{
      service: 'openai',
      model,
      run: async (prompt, outputDir) => {
        await ensureOpenAIImageGenSetup()
        return await runOpenAIImageGen(prompt, outputDir, {
          model,
          mode: hasEditInputs(options) ? 'edit' : 'generation',
          inputs: options.imageInputs,
          mask: options.imageMask,
          count: options.imageCount,
          size: options.imageSize,
          quality: options.imageQuality,
          outputFormat: options.imageFormat,
          background: options.imageBackground,
          compression: options.imageCompression
        })
      }
    }]
  })
}
