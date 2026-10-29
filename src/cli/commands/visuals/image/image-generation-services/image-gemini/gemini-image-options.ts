import type { GeminiImageModel, ImageGenOptions } from '~/types'
import { validateEnumOption } from '../../image-utils/image-target-validation'

const GEMINI_LITE_ASPECT_RATIO_VALUES = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const
export const GEMINI_NATIVE_ASPECT_RATIO_VALUES = [...GEMINI_LITE_ASPECT_RATIO_VALUES, '1:4', '4:1', '1:8', '8:1'] as const
export const GEMINI_IMAGE_SIZE_VALUES = ['1K', '2K', '4K'] as const
export const GEMINI_IMAGE_RESPONSE_MODES = ['image', 'text-image'] as const

const GEMINI_NATIVE_ASPECT_RATIOS = new Set<string>(GEMINI_NATIVE_ASPECT_RATIO_VALUES)
const GEMINI_IMAGE_SIZES = new Set<string>(GEMINI_IMAGE_SIZE_VALUES)
const GEMINI_LITE_SIZES = new Set<string>(['1K'])
const GEMINI_LITE_ASPECT_RATIOS = new Set<string>(GEMINI_LITE_ASPECT_RATIO_VALUES)

export const validateGeminiImageDimensions = (model: GeminiImageModel, options: Pick<ImageGenOptions, 'imageSize' | 'imageAspectRatio'>): void => {
  const highResolution = model === 'gemini-nano-banana-2.1'
  validateEnumOption('Gemini', model, 'size', options.imageSize, highResolution ? GEMINI_IMAGE_SIZES : GEMINI_LITE_SIZES)
  validateEnumOption('Gemini', model, 'aspect-ratio', options.imageAspectRatio, highResolution ? GEMINI_NATIVE_ASPECT_RATIOS : GEMINI_LITE_ASPECT_RATIOS)
}
