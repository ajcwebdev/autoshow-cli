import type { GrokImageModel, ImageGenOptions } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { GROK_IMAGE_INPUT_MIME_TYPES, validateImageInputReferences } from '../../image-utils/image-inputs'
import { validateEnumOption, validateImageCount } from '../../image-utils/image-target-validation'

const LEGACY_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '2:1', '1:2', '19.5:9', '9:19.5', '20:9', '9:20', 'auto'] as const
export const GROK_IMAGE_ASPECT_RATIO_VALUES = [...LEGACY_ASPECT_RATIOS, '21:9', '5:2'] as const
export const GROK_IMAGE_SIZE_VALUES = ['1K', '2K'] as const
export const GROK_IMAGE_COUNT_RANGE = [1, 10] as const

export const normalizeGrokImageResolution = (size: string | undefined): '1k' | '2k' | undefined => {
  if (size === undefined || size.length === 0) return undefined
  const normalized = size.toLowerCase()
  if (normalized === '1k' || normalized === '2k') return normalized
  throw UsageError(`Invalid --size value "${size}" for Grok. Expected 1K or 2K.`)
}

// Shared by preflight, pricing and transport so automatic provider defaults cannot change the quote.
export const resolveGrokImageOptions = (
  model: GrokImageModel,
  options: Pick<ImageGenOptions, 'imageSize' | 'imageQuality' | 'imageInputs' | 'imageCount' | 'imageAspectRatio'>
) => {
  const isV2 = model === 'grok-imagine-image-2.0'
  const imageCount = validateImageCount('Grok', model, options.imageCount, ...GROK_IMAGE_COUNT_RANGE)
  validateEnumOption('Grok', model, 'aspect-ratio', options.imageAspectRatio, new Set<string>(isV2 ? GROK_IMAGE_ASPECT_RATIO_VALUES : LEGACY_ASPECT_RATIOS))
  validateImageInputReferences(options.imageInputs, {
    provider: 'Grok', model, allowedMimeTypes: GROK_IMAGE_INPUT_MIME_TYPES, maxInputs: isV2 ? 5 : 3
  })
  const mode = options.imageInputs?.length ? 'edit' : 'generation'
  const normalizedResolution = normalizeGrokImageResolution(options.imageSize)
  let quality: 'low' | 'medium' | undefined
  if (isV2) {
    const requested = options.imageQuality?.toLowerCase() ?? 'auto'
    if (requested !== 'low' && requested !== 'medium' && requested !== 'auto') {
      throw UsageError(`Invalid --quality value "${options.imageQuality}" for Grok/${model}. Expected low, medium or auto.`)
    }
    quality = requested === 'auto' ? (mode === 'edit' ? 'medium' : 'low') : requested
  } else if (options.imageQuality !== undefined) {
    throw UsageError(`--quality is not supported by Grok/${model}. Use grok-imagine-image-2.0 for quality control.`)
  }
  return {
    mode,
    imageCount,
    resolution: normalizedResolution ?? (isV2 ? '1k' : undefined),
    quality
  } as const
}

export const GROK_IMAGE_2_OUTPUT_PRICE_CENTS = {
  low: { '1k': 4, '2k': 6 },
  medium: { '1k': 6, '2k': 8 }
} as const
export const GROK_IMAGE_2_INPUT_PRICE_CENTS = 1
