import type { GeminiPart } from '~/types'
import { UsageError } from '~/utils/error-handler'
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
  flagName: '--input',
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
    maxInputsError: maxInputs => `--input supports at most ${maxInputs} reference images for ${options.provider}/${options.model}.`,
    missingFileError: value => `--input file "${value}" does not exist for ${options.provider}/${options.model}.`,
    unsupportedMimeError: value => unsupportedReferenceMessage('--input', value, options.provider, options.model, options.allowedMimeTypes)
  })
}

export const validateOpenAIImageMask = (mask: string | undefined, inputs: readonly string[] | undefined, model: string): void => {
  if (mask === undefined) return
  if (!inputs?.length) throw UsageError('--mask requires at least one --input reference image.')
  if (isHttpUrl(mask) || imageReferenceEngine.isDataUrl(mask)) {
    throw UsageError(`--mask must be a local image file for OpenAI/${model}.`)
  }
  imageReferenceEngine.validateReferences([mask], {
    allowedMimeTypes: ['image/png'],
    missingFileError: value => `--mask file "${value}" does not exist for OpenAI/${model}.`,
    unsupportedMimeError: () => `--mask must be a local PNG file for OpenAI/${model}.`
  })
  if (Bun.file(mask).size >= 4 * 1024 * 1024) throw UsageError('--mask must be smaller than 4 MB.')
}

const pngHasAlpha = (bytes: Uint8Array): boolean => {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (buffer[25] === 4 || buffer[25] === 6) return true // Grayscale + alpha or RGBA in IHDR.
  for (let offset = 8; offset + 12 <= buffer.length; offset += 12 + buffer.readUInt32BE(offset)) {
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    if (type === 'tRNS') return true
    if (type === 'IDAT') break
  }
  return false
}

export const appendOpenAIEditInputs = async (form: FormData, inputs: readonly string[], mask?: string): Promise<void> => {
  const fieldName = inputs.length > 1 ? 'image[]' : 'image'
  for (const [index, input] of inputs.entries()) {
    const { bytes, mimeType, fileName } = await imageReferenceEngine.resolveBytes(input)
    form.append(fieldName, new Blob([bytes], { type: mimeType }), fileName)
    if (index === 0 && mask !== undefined) {
      const { bytes: maskBytes, fileName: maskName } = await imageReferenceEngine.resolveBytes(mask)
      const maskImage = new Bun.Image(maskBytes)
      const [source, maskInfo] = await Promise.all([new Bun.Image(bytes).metadata(), maskImage.metadata()])
        .catch(() => { throw UsageError('Masked edits require a readable first input image and PNG mask.') })
      if (maskInfo.format !== 'png' || !pngHasAlpha(maskBytes)) throw UsageError('--mask must be a PNG with an alpha channel.')
      if (maskInfo.width !== source.width || maskInfo.height !== source.height) {
        throw UsageError(`--mask dimensions ${maskInfo.width}x${maskInfo.height} must match the first --input image (${source.width}x${source.height}).`)
      }
      await maskImage.resize(1, 1).png().bytes().catch(() => { throw UsageError('--mask must be a decodable PNG.') })
      form.append('mask', new Blob([maskBytes], { type: 'image/png' }), maskName)
    }
  }
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
export const GROK_IMAGE_INPUT_MIME_TYPES = ['image/png', 'image/jpeg'] as const
export const GEMINI_IMAGE_INPUT_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'] as const
