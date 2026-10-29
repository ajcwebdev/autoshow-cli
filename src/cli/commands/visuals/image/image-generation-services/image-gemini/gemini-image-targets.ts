import type { GeminiImageModel, ImageGenOptions, ImageTarget } from '~/types'
import { validateGeminiImageModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { runGeminiImageGen } from './run-gemini-image-gen'
import {
  assertNoUnsupportedFlags,
  hasEditInputs,
  unsupportedFlagError,
  validateEnumOption
} from '../../image-utils/image-target-validation'
import {
  GEMINI_IMAGE_INPUT_MIME_TYPES,
  validateImageInputReferences
} from '../../image-utils/image-inputs'

export { GEMINI_IMAGE_SIZE_VALUES, GEMINI_IMAGE_RESPONSE_MODES, GEMINI_NATIVE_ASPECT_RATIO_VALUES } from './gemini-image-options'
import { GEMINI_IMAGE_RESPONSE_MODES, validateGeminiImageDimensions } from './gemini-image-options'
const GEMINI_RESPONSE_MODES = new Set<string>(GEMINI_IMAGE_RESPONSE_MODES)

export const collectGeminiImageTargets = (options: ImageGenOptions): ImageTarget[] => {
  const models = options.geminiImageModels ?? []
  return models.flatMap((rawModel) => {
    const model: GeminiImageModel = validateGeminiImageModel(rawModel)
    validateGeminiImageDimensions(model, options)
    validateEnumOption('Gemini', model, 'response-mode', options.imageResponseMode, GEMINI_RESPONSE_MODES)
    if (options.imageCount !== undefined) {
      throw unsupportedFlagError('Gemini', model, ['--count'], 'Gemini native image generation returns one image per request; omit --count.')
    }
    if (options.imageMask !== undefined) {
      throw unsupportedFlagError('Gemini', model, ['--mask'], 'Gemini native image editing supports reference images via --input, not masks.')
    }
    validateImageInputReferences(options.imageInputs, {
      provider: 'Gemini',
      model,
      allowedMimeTypes: GEMINI_IMAGE_INPUT_MIME_TYPES
    })
    assertNoUnsupportedFlags(options, ['imageQuality', 'imageFormat', 'imageBackground', 'imageCompression'], {
      provider: 'Gemini',
      model,
      hint: 'Supported Gemini image options are --aspect-ratio, --size (Lite: 1K; Nano Banana 2.1: 1K|2K|4K), --response-mode, and --input references.'
    })

    const request = {
      model,
      mode: hasEditInputs(options) ? 'edit' as const : 'generation' as const,
      inputs: options.imageInputs,
      aspectRatio: options.imageAspectRatio,
      imageSize: options.imageSize,
      responseMode: options.imageResponseMode === 'text-image' ? 'text-image' as const : 'image' as const
    }
    return [{
      service: 'gemini',
      model,
      requestSettings: request,
      run: async (prompt, outputDir) => await runGeminiImageGen(prompt, outputDir, request)
    }]
  })
}
