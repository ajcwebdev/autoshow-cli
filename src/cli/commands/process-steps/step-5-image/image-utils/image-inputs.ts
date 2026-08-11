import type { GeminiPart } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { createMediaReferenceEngine } from '~/utils/media-reference-engine'

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.heic': 'image/heic',
  '.heif': 'image/heif'
}

const EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/heic': 'heic',
  'image/heif': 'heif'
}

const IMAGE_REFERENCE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/heic', 'image/heif'] as const

const imageReferenceEngine = createMediaReferenceEngine({
  allowedMimeTypes: IMAGE_REFERENCE_MIME_TYPES,
  mimeByExtension: MIME_BY_EXTENSION,
  mimeAliases: {},
  dataUrlPattern: /^data:image\/[a-z0-9.+-]+;base64,/i,
  policy: { mode: 'lenient', contentTypePrefix: 'image/', fallbackMimeType: 'image/png' },
  accept: 'image/*,*/*;q=0.8',
  defaultFileName: mimeType => `image.${EXTENSION_BY_MIME[mimeType] ?? 'png'}`,
  errors: {
    download: (status, url) => `Image reference download failed (${status}): ${url}`,
    unsupportedLocal: value => `Unsupported local image input "${value}".`,
    unsupportedUrl: url => `Unsupported image URL "${url}".`,
    unsupportedDataUrl: () => 'Unsupported image data URL.'
  },
  downloadError: { stage: 'image:inputs' }
})

const prettyMimeList = (mimeTypes: readonly string[]): string =>
  mimeTypes.map((mimeType) => mimeType.replace(/^image\//, '')).join('|')

export const isHttpUrl = imageReferenceEngine.isHttpUrl

const unsupportedReferenceMessage = (
  flagName: '--image-input' | '--image-mask',
  value: string,
  provider: string,
  model: string,
  allowedMimeTypes: readonly string[]
): string => `Unsupported ${flagName} value "${value}" for ${provider}/${model}. Expected ${prettyMimeList(allowedMimeTypes)} image files or URLs.`

export const validateImageInputReferences = (
  inputs: readonly string[] | undefined,
  options: {
    provider: string
    model: string
    allowedMimeTypes: readonly string[]
    maxInputs?: number | undefined
  }
): void => {
  imageReferenceEngine.validateReferences(inputs, {
    allowedMimeTypes: options.allowedMimeTypes,
    maxInputs: options.maxInputs,
    maxInputsError: maxInputs => `--image-input supports at most ${maxInputs} reference images for ${options.provider}/${options.model}.`,
    missingFileError: value => `--image-input file "${value}" does not exist for ${options.provider}/${options.model}.`,
    unsupportedMimeError: value => unsupportedReferenceMessage('--image-input', value, options.provider, options.model, options.allowedMimeTypes)
  })
}

export const validateImageMaskReference = (
  mask: string | undefined,
  options: {
    provider: string
    model: string
    allowedMimeTypes: readonly string[]
  }
): void => {
  if (mask === undefined) return
  if (isHttpUrl(mask) || imageReferenceEngine.isDataUrl(mask)) {
    throw CLIUsageError(`--image-mask must be a local image file for ${options.provider}/${options.model}.`)
  }
  imageReferenceEngine.validateReferences([mask], {
    allowedMimeTypes: options.allowedMimeTypes,
    missingFileError: value => `--image-mask file "${value}" does not exist for ${options.provider}/${options.model}.`,
    unsupportedMimeError: value => unsupportedReferenceMessage('--image-mask', value, options.provider, options.model, options.allowedMimeTypes)
  })
}

export const appendImageReferenceToForm = async (
  form: FormData,
  fieldName: string,
  value: string
): Promise<void> => {
  const { bytes, mimeType, fileName } = await imageReferenceEngine.resolveBytes(value)
  form.append(fieldName, new Blob([bytes], { type: mimeType }), fileName)
}

export const imageReferenceToDataUrl = async (value: string): Promise<string> =>
  await imageReferenceEngine.referenceToUrlOrDataUrl(value)

export const imageReferenceToUrlOrDataUrl = imageReferenceToDataUrl

export const imageReferenceToInlineDataPart = async (value: string): Promise<GeminiPart> => {
  const { bytes, mimeType } = await imageReferenceEngine.resolveBytes(value)
  return {
    inlineData: {
      mimeType,
      data: Buffer.from(bytes).toString('base64')
    }
  }
}

export const OPENAI_IMAGE_INPUT_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const OPENAI_IMAGE_MASK_MIME_TYPES = ['image/png'] as const
export const GROK_IMAGE_INPUT_MIME_TYPES = ['image/png', 'image/jpeg'] as const
export const GEMINI_IMAGE_INPUT_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'] as const
export const BFL_IMAGE_INPUT_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const LUMALABS_IMAGE_INPUT_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const REPLICATE_SEEDREAM_IMAGE_INPUT_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const REPLICATE_QWEN_IMAGE_INPUT_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const REPLICATE_WAN_IMAGE_INPUT_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp'] as const
