import { UsageError } from '~/utils/error-handler'
import type { ImageGenOptions, OpenAIImageModel } from '~/types'
import { isOpenAIImage25Model, supportsOpenAIFlexibleImageSize } from '~/cli/commands/setup-and-utilities/models/image-models'
import { validateEnumOption } from '../../image-utils/image-target-validation'

const parseImageDimensions = (size: string): { width: number, height: number } | undefined => {
  const match = size.match(/^(\d+)x(\d+)$/i)
  if (!match) return undefined

  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)) return undefined
  return { width, height }
}

export const validateOpenAIFlexibleImageSize = (model: string, size: string | undefined): void => {
  if (size === undefined || size.toLowerCase() === 'auto') {
    return
  }

  const dimensions = parseImageDimensions(size)
  if (!dimensions) {
    throw UsageError(`Invalid --size value "${size}" for ${model}. Expected auto or WIDTHxHEIGHT.`)
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
    throw UsageError(
      `Invalid --size value "${size}" for ${model}. Width and height must be multiples of 16, max edge <= 3840, aspect ratio <= 3:1, and total pixels between 655,360 and 8,294,400.`
    )
  }
}

export const OPENAI_FIXED_IMAGE_SIZE_VALUES = ['auto', '1024x1024', '1536x1024', '1024x1536'] as const
const OPENAI_IMAGE_QUALITY_VALUES = ['auto', 'low', 'medium', 'high'] as const
const OPENAI_IMAGE_25_QUALITY_VALUES = [...OPENAI_IMAGE_QUALITY_VALUES, 'xhigh', 'max'] as const
export const OPENAI_IMAGE_FORMAT_VALUES = ['png', 'jpeg', 'webp'] as const
export const OPENAI_IMAGE_BACKGROUND_VALUES = ['auto', 'transparent', 'opaque'] as const
export const OPENAI_IMAGE_COUNT_RANGE = [1, 10] as const
export const OPENAI_IMAGE_COMPRESSION_RANGE = [0, 100] as const

const OPENAI_FIXED_IMAGE_SIZES = new Set<string>(OPENAI_FIXED_IMAGE_SIZE_VALUES)
const OPENAI_IMAGE_QUALITIES = new Set<string>(OPENAI_IMAGE_QUALITY_VALUES)
const OPENAI_IMAGE_25_QUALITIES = new Set<string>(OPENAI_IMAGE_25_QUALITY_VALUES)
const OPENAI_IMAGE_FORMATS = new Set<string>(OPENAI_IMAGE_FORMAT_VALUES)
const OPENAI_IMAGE_BACKGROUNDS = new Set<string>(OPENAI_IMAGE_BACKGROUND_VALUES)

const validateFixedOpenAIImageSize = (model: OpenAIImageModel, size: string | undefined): void => {
  if (size === undefined || OPENAI_FIXED_IMAGE_SIZES.has(size.toLowerCase())) {
    return
  }

  throw UsageError(`Invalid --size value "${size}" for ${model}. Expected auto, 1024x1024, 1536x1024, or 1024x1536.`)
}

export const validateOpenAIImageOptions = (
  model: OpenAIImageModel,
  options: Pick<ImageGenOptions, 'imageSize' | 'imageQuality' | 'imageFormat' | 'imageBackground' | 'imageCompression'>
): void => {
  validateEnumOption('OpenAI', model, 'quality', options.imageQuality, isOpenAIImage25Model(model) ? OPENAI_IMAGE_25_QUALITIES : OPENAI_IMAGE_QUALITIES)
  validateEnumOption('OpenAI', model, 'format', options.imageFormat, OPENAI_IMAGE_FORMATS)
  validateEnumOption('OpenAI', model, 'background', options.imageBackground, OPENAI_IMAGE_BACKGROUNDS)
  if (options.imageCompression !== undefined) {
    const format = options.imageFormat ?? 'png'
    if (format !== 'jpeg' && format !== 'webp') {
      throw UsageError(`--compression is only supported by OpenAI/${model} with --format jpeg or webp.`)
    }
  }

  if (options.imageBackground?.toLowerCase() === 'transparent') {
    if (!isOpenAIImage25Model(model)) {
      throw UsageError(`--background transparent is not supported by OpenAI/${model}. Supported alternatives: opaque or auto.`)
    }
    if (options.imageFormat?.toLowerCase() === 'jpeg') {
      throw UsageError(`--background transparent requires --format png or webp for OpenAI/${model}.`)
    }
  }

  if (supportsOpenAIFlexibleImageSize(model)) {
    validateOpenAIFlexibleImageSize(model, options.imageSize)
    return
  }

  validateFixedOpenAIImageSize(model, options.imageSize)
}
