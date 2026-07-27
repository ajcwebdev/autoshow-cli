import {
  IMAGE_GENERATION_SIZES,
} from '~/types'
import { ValidationError } from '~/utils/error-handler'
import type { ImageGenerationModel, ImageGenerationSize } from '~/types'

// Comic's default image model and the only model that accepts custom WIDTHxHEIGHT
// sizes. Both are validated against the central image registry at parse time;
// these constants name the registry ids comic defaults to.
export const DEFAULT_IMAGE_MODEL: ImageGenerationModel = 'gpt-image-2'
const GPT_IMAGE_2_MODEL = 'gpt-image-2'

const IMAGE_SIZE_OPTIONS = new Set<string>(IMAGE_GENERATION_SIZES)
const CUSTOM_IMAGE_SIZE_PATTERN = /^(\d+)x(\d+)$/
const MIN_CUSTOM_IMAGE_PIXELS = 655_360
const MAX_CUSTOM_IMAGE_PIXELS = 8_294_400
const MAX_CUSTOM_IMAGE_EDGE = 3_840
const MAX_CUSTOM_IMAGE_ASPECT_RATIO = 3

export const IMAGE_SIZE_HELP = `${IMAGE_GENERATION_SIZES.join(', ')}, or a custom WIDTHxHEIGHT size for ${GPT_IMAGE_2_MODEL}`

const isPresetImageGenerationSize = (
  value: string
): value is (typeof IMAGE_GENERATION_SIZES)[number] => {
  return IMAGE_SIZE_OPTIONS.has(value)
}

const parseCustomImageSize = (size: string): { width: number; height: number } | null => {
  const match = size.match(CUSTOM_IMAGE_SIZE_PATTERN)
  const width = match?.[1] ? Number(match[1]) : 0
  const height = match?.[2] ? Number(match[2]) : 0

  return match ? { width, height } : null
}

const validateCustomImageDimensions = (
  size: string,
  dimensions: { width: number; height: number }
): void => {
  const { width, height } = dimensions

  if (width <= 0 || height <= 0) {
    throw ValidationError(`Invalid custom size "${size}". Width and height must be positive integers.`, { stage: 'comic:image-size' })
  }

  if (width % 16 !== 0 || height % 16 !== 0) {
    throw ValidationError(`Invalid custom size "${size}". Both width and height must be multiples of 16.`, { stage: 'comic:image-size' })
  }

  if (Math.max(width, height) > MAX_CUSTOM_IMAGE_EDGE) {
    throw ValidationError(`Invalid custom size "${size}". Maximum edge length is ${MAX_CUSTOM_IMAGE_EDGE}px.`, { stage: 'comic:image-size' })
  }

  if (Math.max(width, height) / Math.min(width, height) > MAX_CUSTOM_IMAGE_ASPECT_RATIO) {
    throw ValidationError(`Invalid custom size "${size}". Aspect ratio must not exceed 3:1.`, { stage: 'comic:image-size' })
  }

  const pixels = width * height
  if (pixels < MIN_CUSTOM_IMAGE_PIXELS || pixels > MAX_CUSTOM_IMAGE_PIXELS) {
    throw ValidationError(
      `Invalid custom size "${size}". Total pixels must be between ` +
      `${MIN_CUSTOM_IMAGE_PIXELS.toLocaleString()} and ${MAX_CUSTOM_IMAGE_PIXELS.toLocaleString()}.`,
      { stage: 'comic:image-size' }
    )
  }
}

export const validateImageSizeForModels = (
  size: ImageGenerationSize | string | undefined,
  models: readonly ImageGenerationModel[] | undefined
): void => {
  if (!size || isPresetImageGenerationSize(size)) {
    return
  }

  const dimensions = parseCustomImageSize(size)
  if (!dimensions) {
    throw ValidationError(`Invalid size "${size}". Expected one of: ${IMAGE_SIZE_HELP}`, { stage: 'comic:image-size' })
  }

  validateCustomImageDimensions(size, dimensions)

  const selectedModels = models && models.length > 0 ? models : [DEFAULT_IMAGE_MODEL]
  if (!selectedModels.every(model => model === GPT_IMAGE_2_MODEL)) {
    throw ValidationError(
      `Custom size "${size}" requires every selected image model to be ${GPT_IMAGE_2_MODEL}; ` +
      `selected models: ${selectedModels.join(', ')}`,
      { stage: 'comic:image-size' }
    )
  }
}
