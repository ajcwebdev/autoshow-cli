import type { DocumentMetadata, ExtractionOptions, OcrInputAdapter } from '~/types'
import { IMAGE_FORMATS } from './image/image-ocr'
import { isZipXmlFormat } from './office/native-text-extractors'

export const hasPreparedMarkdownInput = (
  options: Pick<ExtractionOptions, 'preparedMarkdown'>
): boolean =>
  typeof options.preparedMarkdown === 'string' && options.preparedMarkdown.trim().length > 0

export const resolveOcrInputAdapter = (
  format: DocumentMetadata['format'],
  options: Pick<ExtractionOptions, 'preparedMarkdown'>
): OcrInputAdapter => {
  if (hasPreparedMarkdownInput(options)) return { family: 'html' }
  if (format === 'epub') return { family: 'epub' }
  if (isZipXmlFormat(format)) return { family: 'office' }
  if (format === 'rtf') return { family: 'rtf' }
  if (format === 'csv') return { family: 'csv' }
  if (format === 'cbz') return { family: 'cbz' }
  if (IMAGE_FORMATS.has(format)) return { family: 'image' }
  return { family: 'pdf' }
}
