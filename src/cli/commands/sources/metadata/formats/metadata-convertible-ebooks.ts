import { extname } from 'node:path'
import type { ConvertibleEbookFormat } from '~/types'

export const CONVERTIBLE_EBOOK_FORMATS = ['mobi', 'azw3', 'fb2', 'lit'] as const
export const CONVERTIBLE_EBOOK_EXTENSIONS = ['.mobi', '.prc', '.azw', '.azw3', '.fb2', '.lit'] as const

export const CONVERTIBLE_EBOOK_FORMAT_LABEL = 'MOBI/AZW/AZW3/FB2/LIT/PRC'

const CONVERTIBLE_EBOOK_FORMAT_SET = new Set<string>(CONVERTIBLE_EBOOK_FORMATS)

const EXTENSION_FORMATS: Record<typeof CONVERTIBLE_EBOOK_EXTENSIONS[number], ConvertibleEbookFormat> = {
  '.mobi': 'mobi',
  '.prc': 'mobi',
  '.azw': 'azw3',
  '.azw3': 'azw3',
  '.fb2': 'fb2',
  '.lit': 'lit'
}

export const isConvertibleEbookFormat = (
  value: string | null | undefined
): value is ConvertibleEbookFormat =>
  typeof value === 'string' && CONVERTIBLE_EBOOK_FORMAT_SET.has(value)

export const resolveConvertibleEbookFormatFromExtension = (
  filePath: string
): ConvertibleEbookFormat | undefined => {
  const extension = extname(filePath).toLowerCase()
  return Object.hasOwn(EXTENSION_FORMATS, extension)
    ? EXTENSION_FORMATS[extension as keyof typeof EXTENSION_FORMATS]
    : undefined
}
