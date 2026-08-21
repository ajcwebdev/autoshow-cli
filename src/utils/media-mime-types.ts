import { extname } from 'node:path'

/**
 * Extension-to-MIME lookup shared by the OCR adapters that inline a source document as
 * a data URL. Each adapter passes the set it actually declares support for, so adding a
 * format here does not silently widen another provider's accepted inputs.
 */
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
