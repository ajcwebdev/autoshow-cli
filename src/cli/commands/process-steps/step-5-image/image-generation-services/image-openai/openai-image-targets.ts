import type { ImageGenOptions, ImageTarget, OpenAIImageModel } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { validateOpenAIImageModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureOpenAIImageGenSetup } from './openai-image-gen'
import { runOpenAIImageGen } from './run-openai-image-gen'
import {
  hasEditInputs,
  unsupportedFlagError,
  validateEnumOption,
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

export const OPENAI_FIXED_IMAGE_SIZE_VALUES = ['auto', '1024x1024', '1536x1024', '1024x1536'] as const
export const OPENAI_IMAGE_QUALITY_VALUES = ['auto', 'low', 'medium', 'high'] as const
export const OPENAI_IMAGE_FORMAT_VALUES = ['png', 'jpeg', 'webp'] as const
export const OPENAI_IMAGE_BACKGROUND_VALUES = ['auto', 'transparent', 'opaque'] as const
export const OPENAI_IMAGE_COUNT_RANGE = [1, 10] as const
export const OPENAI_IMAGE_COMPRESSION_RANGE = [0, 100] as const

const OPENAI_FIXED_IMAGE_SIZES = new Set<string>(OPENAI_FIXED_IMAGE_SIZE_VALUES)
const OPENAI_IMAGE_QUALITIES = new Set<string>(OPENAI_IMAGE_QUALITY_VALUES)
const OPENAI_IMAGE_FORMATS = new Set<string>(OPENAI_IMAGE_FORMAT_VALUES)
const OPENAI_IMAGE_BACKGROUNDS = new Set<string>(OPENAI_IMAGE_BACKGROUND_VALUES)

const parseImageDimensions = (size: string): { width: number, height: number } | undefined => {
  const match = size.match(/^(\d+)x(\d+)$/i)
  if (!match) return undefined

  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)) return undefined
  return { width, height }
}

const validateGptImage2Size = (size: string | undefined): void => {
  if (size === undefined || size.toLowerCase() === 'auto') {
    return
  }

  const dimensions = parseImageDimensions(size)
  if (!dimensions) {
    throw CLIUsageError(`Invalid --image-size value "${size}" for gpt-image-2. Expected auto or WIDTHxHEIGHT.`)
  }

  const { width, height } = dimensions
  const longEdge = Math.max(width, height)
  const shortEdge = Math.min(width, height)
  const totalPixels = width * height

  if (
    longEdge > 3840
    || width % 16 !== 0
    || height % 16 !== 0
    || longEdge / shortEdge > 3
    || totalPixels < 655_360
    || totalPixels > 8_294_400
  ) {
    throw CLIUsageError(
      `Invalid --image-size value "${size}" for gpt-image-2. Width and height must be multiples of 16, max edge <= 3840, aspect ratio <= 3:1, and total pixels between 655,360 and 8,294,400.`
    )
  }
}

const validateFixedOpenAIImageSize = (model: OpenAIImageModel, size: string | undefined): void => {
  if (size === undefined || OPENAI_FIXED_IMAGE_SIZES.has(size.toLowerCase())) {
    return
  }

  throw CLIUsageError(`Invalid --image-size value "${size}" for ${model}. Expected auto, 1024x1024, 1536x1024, or 1024x1536.`)
}

const validateOpenAIImageOptions = (
  model: OpenAIImageModel,
  options: Pick<ImageGenOptions, 'imageSize' | 'imageQuality' | 'imageFormat' | 'imageBackground' | 'imageCompression'>
): void => {
  validateEnumOption('OpenAI', model, 'image-quality', options.imageQuality, OPENAI_IMAGE_QUALITIES)
  validateEnumOption('OpenAI', model, 'image-format', options.imageFormat, OPENAI_IMAGE_FORMATS)
  validateEnumOption('OpenAI', model, 'image-background', options.imageBackground, OPENAI_IMAGE_BACKGROUNDS)
  if (options.imageCompression !== undefined) {
    const format = options.imageFormat ?? 'png'
    if (format !== 'jpeg' && format !== 'webp') {
      throw CLIUsageError(`--image-compression is only supported by OpenAI/${model} with --image-format jpeg or webp.`)
    }
  }

  if (model === 'gpt-image-2') {
    validateGptImage2Size(options.imageSize)
    if (options.imageBackground?.toLowerCase() === 'transparent') {
      throw CLIUsageError('--image-background transparent is not supported by OpenAI/gpt-image-2. Supported alternatives: opaque or auto.')
    }
    return
  }

  validateFixedOpenAIImageSize(model, options.imageSize)
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
      throw unsupportedFlagError('OpenAI', model, ['--image-aspect-ratio'], 'Use --image-size for OpenAI dimensions.')
    }
    if (options.imageResponseMode !== undefined || options.geminiSearchGrounding === true) {
      const unsupported: string[] = []
      if (options.imageResponseMode !== undefined) unsupported.push('--image-response-mode')
      if (options.geminiSearchGrounding === true) unsupported.push('--image-search-grounding')
      throw unsupportedFlagError('OpenAI', model, unsupported, 'These flags are Gemini-only.')
    }
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
