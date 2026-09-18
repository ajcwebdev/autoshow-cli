import type { GrokImageModel, ImageGenOptions } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { GROK_IMAGE_INPUT_MIME_TYPES, validateImageInputReferences } from '../../image-utils/image-inputs'
import { validateEnumOption, validateImageCount } from '../../image-utils/image-target-validation'

export const GROK_IMAGE_ASPECT_RATIO_VALUES = [
  '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '2:1', '1:2',
  '19.5:9', '9:19.5', '20:9', '9:20', 'auto', '21:9', '5:2'
] as const
export const GROK_IMAGE_SIZE_VALUES = ['1K', '2K'] as const
export const GROK_IMAGE_COUNT_RANGE = [1, 10] as const

export const normalizeGrokImageResolution = (size: string | undefined): '1k' | '2k' | undefined => {
  if (size === undefined || size.length === 0) return undefined
  const normalized = size.toLowerCase()
  if (normalized === '1k' || normalized === '2k') return normalized
  throw UsageError(`Invalid --size value "${size}" for Grok. Expected 1K or 2K.`)
}

export const resolveGrokImageOptions = (
  model: GrokImageModel,
  options: Pick<ImageGenOptions, 'imageSize' | 'imageQuality' | 'imageInputs' | 'imageCount' | 'imageAspectRatio'>
) => {
  const imageCount = validateImageCount('Grok', model, options.imageCount, ...GROK_IMAGE_COUNT_RANGE)
  validateEnumOption('Grok', model, 'aspect-ratio', options.imageAspectRatio, new Set<string>(GROK_IMAGE_ASPECT_RATIO_VALUES))
  validateImageInputReferences(options.imageInputs, {
    provider: 'Grok', model, allowedMimeTypes: GROK_IMAGE_INPUT_MIME_TYPES, maxInputs: 5
  })
  const mode = options.imageInputs?.length ? 'edit' : 'generation'
  const normalizedResolution = normalizeGrokImageResolution(options.imageSize)
  const requested = options.imageQuality?.toLowerCase() ?? 'auto'
  if (requested !== 'low' && requested !== 'medium' && requested !== 'auto') {
    throw UsageError(`Invalid --quality value "${options.imageQuality}" for Grok/${model}. Expected low, medium or auto.`)
  }
  const quality = requested === 'auto' ? (mode === 'edit' ? 'medium' : 'low') : requested
  return {
    mode,
    imageCount,
    resolution: normalizedResolution ?? '1k',
    quality
  } as const
}
