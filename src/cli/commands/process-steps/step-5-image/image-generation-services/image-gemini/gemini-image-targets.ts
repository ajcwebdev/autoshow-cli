import type { GeminiImageModel, ImageGenOptions, ImageTarget } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { supportsGeminiImageSize, validateGeminiImageModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureGeminiImageGenSetup } from './gemini-image-gen'
import { runGeminiImageGen } from './run-gemini-image-gen'
import {
  collectUnsupportedCommonFlags,
  hasEditInputs,
  IMAGE_OPTION_LABELS,
  unsupportedFlagError,
  validateEnumOption
} from '../../image-utils/image-target-validation'
import {
  GEMINI_IMAGE_INPUT_MIME_TYPES,
  validateImageInputReferences
} from '../../image-utils/image-inputs'

export const GEMINI_NATIVE_ASPECT_RATIO_VALUES = ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'] as const
export const GEMINI_IMAGE_SIZE_VALUES = ['1K', '2K', '4K'] as const
export const GEMINI_IMAGE_RESPONSE_MODES = ['image', 'text-image'] as const

const GEMINI_NATIVE_ASPECT_RATIOS = new Set<string>(GEMINI_NATIVE_ASPECT_RATIO_VALUES)
const GEMINI_IMAGE_SIZES = new Set<string>(GEMINI_IMAGE_SIZE_VALUES)
const GEMINI_RESPONSE_MODES = new Set<string>(GEMINI_IMAGE_RESPONSE_MODES)

export const collectGeminiImageTargets = (options: ImageGenOptions): ImageTarget[] => {
  const models = options.geminiImageModels ?? (options.geminiImageModel ? [options.geminiImageModel] : [])
  return models.flatMap((rawModel) => {
    const model: GeminiImageModel = validateGeminiImageModel(rawModel)
    if (typeof options.imageSize === 'string' && options.imageSize.length > 0 && !supportsGeminiImageSize(model)) {
      throw CLIUsageError(`--image-size is not supported by Gemini/${model}. Supported alternatives: omit --image-size or use an image-size-capable Gemini image model.`)
    }
    validateEnumOption('Gemini', model, 'image-size', options.imageSize, GEMINI_IMAGE_SIZES)
    validateEnumOption('Gemini', model, 'image-response-mode', options.imageResponseMode, GEMINI_RESPONSE_MODES)
    validateEnumOption('Gemini', model, 'image-aspect-ratio', options.imageAspectRatio, GEMINI_NATIVE_ASPECT_RATIOS)
    if (options.imageCount !== undefined) {
      throw unsupportedFlagError('Gemini', model, ['--image-count'], 'Gemini native image generation returns one image per request; omit --image-count.')
    }
    if (options.imageMask !== undefined) {
      throw unsupportedFlagError('Gemini', model, ['--image-mask'], 'Gemini native image editing supports reference images via --image-input, not masks.')
    }
    validateImageInputReferences(options.imageInputs, {
      provider: 'Gemini',
      model,
      allowedMimeTypes: GEMINI_IMAGE_INPUT_MIME_TYPES
    })
    const unsupportedCommon = collectUnsupportedCommonFlags(options, ['imageQuality', 'imageFormat', 'imageBackground', 'imageCompression'], IMAGE_OPTION_LABELS)
    if (unsupportedCommon.length > 0) {
      throw unsupportedFlagError('Gemini', model, unsupportedCommon, 'Supported Gemini image options are --image-aspect-ratio, --image-size, --image-response-mode, --image-input references, and --gemini-search-grounding.')
    }

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
