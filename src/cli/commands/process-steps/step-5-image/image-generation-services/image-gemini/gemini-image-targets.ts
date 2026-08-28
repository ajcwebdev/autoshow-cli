import type { GeminiImageModel, ImageGenOptions, ImageTarget } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { validateGeminiImageModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureGeminiImageGenSetup } from './gemini-image-gen'
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

const GEMINI_STANDARD_ASPECT_RATIO_VALUES = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const
export const GEMINI_NATIVE_ASPECT_RATIO_VALUES = [...GEMINI_STANDARD_ASPECT_RATIO_VALUES, '1:4', '4:1', '1:8', '8:1'] as const
export const GEMINI_IMAGE_SIZE_VALUES = ['1K', '2K', '4K'] as const
export const GEMINI_IMAGE_RESPONSE_MODES = ['image', 'text-image'] as const

const GEMINI_NATIVE_ASPECT_RATIOS = new Set<string>(GEMINI_NATIVE_ASPECT_RATIO_VALUES)
const GEMINI_STANDARD_ASPECT_RATIOS = new Set<string>(GEMINI_STANDARD_ASPECT_RATIO_VALUES)
const GEMINI_IMAGE_SIZES = new Set<string>(GEMINI_IMAGE_SIZE_VALUES)
const GEMINI_RESPONSE_MODES = new Set<string>(GEMINI_IMAGE_RESPONSE_MODES)

export const collectGeminiImageTargets = (options: ImageGenOptions): ImageTarget[] => {
  const models = options.geminiImageModels ?? []
  return models.flatMap((rawModel) => {
    const model: GeminiImageModel = validateGeminiImageModel(rawModel)
    validateEnumOption('Gemini', model, 'size', options.imageSize, GEMINI_IMAGE_SIZES)
    if (model === 'gemini-3.1-flash-lite-image' && options.imageSize !== undefined && options.imageSize !== '1K') {
      throw UsageError(`--size ${options.imageSize} is not supported by Gemini/${model}. Supported value: 1K.`)
    }
    validateEnumOption('Gemini', model, 'response-mode', options.imageResponseMode, GEMINI_RESPONSE_MODES)
    validateEnumOption(
      'Gemini',
      model,
      'aspect-ratio',
      options.imageAspectRatio,
      model === 'gemini-3.1-flash-image' ? GEMINI_NATIVE_ASPECT_RATIOS : GEMINI_STANDARD_ASPECT_RATIOS
    )
    if (options.imageCount !== undefined) {
      throw unsupportedFlagError('Gemini', model, ['--count'], 'Gemini native image generation returns one image per request; omit --count.')
    }
    if (options.imageMask !== undefined) {
      throw unsupportedFlagError('Gemini', model, ['--mask'], 'Gemini native image editing supports reference images via --input, not masks.')
    }
    if (model === 'gemini-3.1-flash-lite-image' && options.geminiSearchGrounding === true) {
      throw unsupportedFlagError('Gemini', model, ['--search-grounding'], 'Use gemini-3.1-flash-image or gemini-3-pro-image for Search-grounded image generation.')
    }
    validateImageInputReferences(options.imageInputs, {
      provider: 'Gemini',
      model,
      allowedMimeTypes: GEMINI_IMAGE_INPUT_MIME_TYPES
    })
    assertNoUnsupportedFlags(options, ['imageQuality', 'imageFormat', 'imageBackground', 'imageCompression'], {
      provider: 'Gemini',
      model,
      hint: 'Supported Gemini image options are --aspect-ratio, --size, --response-mode, --input references, and --search-grounding.'
    })

    return [{
      service: 'gemini',
      model,
      run: async (prompt, outputDir) => {
        await ensureGeminiImageGenSetup()
        return await runGeminiImageGen(prompt, outputDir, {
          model,
          mode: hasEditInputs(options) ? 'edit' : 'generation',
          inputs: options.imageInputs,
          aspectRatio: options.imageAspectRatio,
          imageSize: options.imageSize,
          responseMode: options.imageResponseMode === 'text-image' ? 'text-image' : 'image',
          searchGrounding: options.geminiSearchGrounding
        })
      }
    }]
  })
}
