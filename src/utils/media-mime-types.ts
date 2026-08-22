import { extname } from 'node:path'

export const OCR_IMAGE_MIME_TYPES: ReadonlyMap<string, string> = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp']
])

export const OCR_IMAGE_MIME_TYPES_WITH_TIFF: ReadonlyMap<string, string> = new Map([
  ...OCR_IMAGE_MIME_TYPES,
  ['.tif', 'image/tiff'],
  ['.tiff', 'image/tiff']
])

export const resolveMediaMimeType = (
  filePath: string,
  recognized: ReadonlyMap<string, string>,
  fallback = 'application/octet-stream'
): string => recognized.get(extname(filePath).toLowerCase()) ?? fallback
