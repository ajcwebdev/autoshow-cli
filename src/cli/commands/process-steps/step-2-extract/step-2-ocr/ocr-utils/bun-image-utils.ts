import { extname } from 'node:path'
import type { BunImageReaderConstructor } from '~/types'
import { InternalError } from '~/utils/error-handler'

const BUN_IMAGE_PNG_NORMALIZABLE_FORMATS = new Set(['bmp', 'gif', 'webp'])

const getBunImageConstructor = (): BunImageReaderConstructor => {
  const imageConstructor = (Bun as unknown as { Image?: BunImageReaderConstructor }).Image
  if (!imageConstructor) {
    throw InternalError('Bun.Image is required for OCR image normalization', { stage: 'ocr:bun-image' })
  }
  return imageConstructor
}

const getPathFormat = (imagePath: string): string =>
  extname(imagePath).replace(/^\./, '').toLowerCase()

export const isBunImagePngNormalizableFormat = (format: string): boolean =>
  BUN_IMAGE_PNG_NORMALIZABLE_FORMATS.has(format.toLowerCase())

export const normalizeImageToPngWithBun = async (
  imagePath: string,
  pngPath: string
): Promise<void> => {
  const format = getPathFormat(imagePath)
  if (!isBunImagePngNormalizableFormat(format)) {
    throw InternalError(`Bun.Image PNG normalization is not enabled for ${format || 'unknown'} images`, { stage: 'ocr:bun-image' })
  }

  const Image = getBunImageConstructor()
  const pngBytes = await new Image(await Bun.file(imagePath).arrayBuffer()).png().bytes()
  await Bun.write(pngPath, pngBytes)
}
