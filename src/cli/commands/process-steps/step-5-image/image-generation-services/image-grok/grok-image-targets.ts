import type { GrokImageModel, ImageGenOptions, ImageTarget } from '~/types'
import { validateGrokImageModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureGrokImageGenSetup } from './grok-image-gen'
import { normalizeGrokImageResolution, runGrokImageGen } from './run-grok-image-gen'
import {
  collectUnsupportedCommonFlags,
  hasEditInputs,
  IMAGE_OPTION_LABELS,
  unsupportedFlagError,
  validateEnumOption,
  validateImageCount
} from '../../image-utils/image-target-validation'
import {
  GROK_IMAGE_INPUT_MIME_TYPES,
  validateImageInputReferences
} from '../../image-utils/image-inputs'

export const GROK_IMAGE_ASPECT_RATIO_VALUES = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '2:1', '1:2', '19.5:9', '9:19.5', '20:9', '9:20', 'auto'] as const
export const GROK_IMAGE_SIZE_VALUES = ['1K', '2K'] as const
export const GROK_IMAGE_COUNT_RANGE = [1, 10] as const

const GROK_ASPECT_RATIOS = new Set<string>(GROK_IMAGE_ASPECT_RATIO_VALUES)

export const collectGrokImageTargets = (options: ImageGenOptions): ImageTarget[] => {
  const models = options.grokImageModels ?? []
  return models.flatMap((rawModel) => {
    const model: GrokImageModel = validateGrokImageModel(rawModel)
    validateImageCount('Grok', model, options.imageCount, ...GROK_IMAGE_COUNT_RANGE)
    validateEnumOption('Grok', model, 'image-aspect-ratio', options.imageAspectRatio, GROK_ASPECT_RATIOS)
    normalizeGrokImageResolution(options.imageSize)
    const unsupported = collectUnsupportedCommonFlags(options, [
      'imageQuality',
      'imageFormat',
      'imageBackground',
      'imageResponseMode',
      'imageCompression'
    ], IMAGE_OPTION_LABELS)
    if (options.imageMask !== undefined) unsupported.push('--image-mask')
    if (options.geminiSearchGrounding === true) unsupported.push('--image-search-grounding')
    if (unsupported.length > 0) {
      throw unsupportedFlagError('Grok', model, unsupported, 'Supported Grok image options: --image-count, --image-aspect-ratio, --image-size 1K|2K, and up to three --image-input references.')
    }
    if (hasEditInputs(options) && model !== 'grok-imagine-image-quality') {
      throw unsupportedFlagError('Grok', model, ['--image-input'], 'xAI documents image editing for grok-imagine-image-quality; use --grok grok-imagine-image-quality for edit/reference inputs.')
    }
    validateImageInputReferences(options.imageInputs, {
      provider: 'Grok',
      model,
      allowedMimeTypes: GROK_IMAGE_INPUT_MIME_TYPES,
      maxInputs: 3
    })

    return [{
      service: 'grok',
      model,
      run: async (prompt, outputDir) => {
        await ensureGrokImageGenSetup()
        return await runGrokImageGen(prompt, outputDir, {
          model,
          mode: hasEditInputs(options) ? 'edit' : 'generation',
          inputs: options.imageInputs,
          count: options.imageCount,
          aspectRatio: options.imageAspectRatio,
          imageSize: options.imageSize
        })
      }
    }]
  })
}
