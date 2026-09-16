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

export const GEMINI_NATIVE_ASPECT_RATIO_VALUES = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const
export const GEMINI_IMAGE_SIZE_VALUES = ['1K'] as const
export const GEMINI_IMAGE_RESPONSE_MODES = ['image', 'text-image'] as const

const GEMINI_NATIVE_ASPECT_RATIOS = new Set<string>(GEMINI_NATIVE_ASPECT_RATIO_VALUES)
const GEMINI_IMAGE_SIZES = new Set<string>(GEMINI_IMAGE_SIZE_VALUES)
const GEMINI_RESPONSE_MODES = new Set<string>(GEMINI_IMAGE_RESPONSE_MODES)

export const collectGeminiImageTargets = (options: ImageGenOptions): ImageTarget[] => {
  const models = options.geminiImageModels ?? []
  return models.flatMap((rawModel) => {
    const model: GeminiImageModel = validateGeminiImageModel(rawModel)
    validateEnumOption('Gemini', model, 'size', options.imageSize, GEMINI_IMAGE_SIZES)
    validateEnumOption('Gemini', model, 'response-mode', options.imageResponseMode, GEMINI_RESPONSE_MODES)
    validateEnumOption('Gemini', model, 'aspect-ratio', options.imageAspectRatio, GEMINI_NATIVE_ASPECT_RATIOS)
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
      hint: 'Supported Gemini image options are --aspect-ratio, --size 1K, --response-mode, and --input references.'
    })

    return [{
      service: 'gemini',
      model,
      run: async (prompt, outputDir) => {
        return await runGeminiImageGen(prompt, outputDir, {
          model,
          mode: hasEditInputs(options) ? 'edit' : 'generation',
          inputs: options.imageInputs,
          aspectRatio: options.imageAspectRatio,
          imageSize: options.imageSize,
          responseMode: options.imageResponseMode === 'text-image' ? 'text-image' : 'image'
        })
      }
    }]
  })
}
