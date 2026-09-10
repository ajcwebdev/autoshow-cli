import type { ExtractionResult, OcrResultBuilderInput } from '~/types'
import { ExtractionResultSchema } from '~/types'
import { validateData } from '~/utils/validate/validation'
import { buildCombinedText } from './office/native-text-extractors'

export type OcrResultSummary = {
  result: ExtractionResult
  totalPages: number
  ocrPages: number
  textPages: number
  processingTime: number
}

export const buildOcrResultSummary = (input: OcrResultBuilderInput): OcrResultSummary => {
  const text = input.opts.preparedMarkdown
    ? input.opts.preparedMarkdown.trim()
    : typeof input.canonicalText === 'string' && input.canonicalText.trim().length > 0
      ? input.canonicalText.trim()
      : buildCombinedText(input.pages, input.extractionMethod !== 'epub-text')
  const ocrPages = input.pages.filter((page) => page.method === 'ocr').length
  const textPages = input.pages.filter((page) => page.method === 'text').length
  const totalPages = typeof input.reportedTotalPages === 'number'
    ? input.reportedTotalPages
    : input.pages.length > 0
      ? input.pages.length
      : input.step1Metadata.pageCount
  const localProcessingTime = Date.now() - input.start
  const processingTime = typeof input.opts.preparedMarkdown === 'string'
    && input.opts.preparedMarkdown.trim().length > 0
    && typeof input.opts.htmlArticleProcessingTimeMs === 'number'
    ? input.opts.htmlArticleProcessingTimeMs + localProcessingTime
    : localProcessingTime
  const result = validateData(ExtractionResultSchema, {
    text,
    pages: input.pages,
    totalPages,
    ocrPages,
    textPages
  }, 'extraction result')
  return { result, totalPages, ocrPages, textPages, processingTime }
}
