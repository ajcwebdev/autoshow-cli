import { isConvertibleEbookFormat } from '~/cli/commands/process-steps/step-0-metadata/formats/metadata-convertible-ebooks'
import type { DocumentMetadata, OcrSourceKind } from '~/types'

const IMAGE_FORMATS = new Set(['png', 'jpg', 'tif', 'webp', 'bmp', 'gif'])
const OFFICE_FORMATS = new Set(['docx', 'pptx', 'xlsx', 'odf'])

export const classifyOcrSourceKind = (
  metadata: Pick<DocumentMetadata, 'format'>,
  options?: {
    preparedMarkdown?: string | undefined
    forceOcr?: boolean | undefined
  }
): OcrSourceKind => {
  if (typeof options?.preparedMarkdown === 'string' && options.preparedMarkdown.trim().length > 0) {
    return 'article'
  }

  const epubClassInput = metadata.format === 'epub' || isConvertibleEbookFormat(metadata.format)

  if (epubClassInput) {
    return options?.forceOcr ? 'epub-pdf' : 'office-native'
  }

  if (metadata.format === 'pdf') {
    return 'pdf'
  }

  if (IMAGE_FORMATS.has(metadata.format)) {
    return 'image'
  }

  if (OFFICE_FORMATS.has(metadata.format)) {
    return 'office-native'
  }

  if (metadata.format === 'rtf') {
    return 'rtf-native'
  }

  if (metadata.format === 'cbz') {
    return 'cbz-images'
  }

  return 'pdf'
}
