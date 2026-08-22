import type { DocumentMetadata, PageResult } from '~/types'
import { REPLICATE_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { ValidationError } from '~/utils/error-handler'
import { runReplicatePrediction } from '~/utils/replicate-client/replicate-prediction'
import { isRecord } from '~/utils/rest-client'
import { requireProviderKey } from '~/utils/validate/env-utils'
import { OCR_IMAGE_MIME_TYPES, resolveMediaMimeType } from '~/utils/media-mime-types'

const imageMimeType = (filePath: string): string =>
  resolveMediaMimeType(filePath, OCR_IMAGE_MIME_TYPES)

const pageText = (page: unknown): string | undefined => {
  if (!isRecord(page)) return undefined
  return typeof page['text'] === 'string' ? page['text'] : undefined
}

const isMarkerModel = (model: string): boolean => model === 'datalab-to/marker'
const isDeepSeekOcrModel = (model: string): boolean => model === 'lucataco/deepseek-ocr'

export const REPLICATE_DEEPSEEK_OCR_VERSION = 'cb3b474fbfc56b1664c8c7841550bccecbe7b74c30e45ce938ffca1180b4dff5'

export const runReplicateOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: string
): Promise<{ pages: PageResult[], extractionMethod: 'replicate-ocr', totalPages?: number }> => {
  const apiToken = requireProviderKey('replicate', 'ocr:replicate', 'Replicate OCR')
  const bytes = await Bun.file(filePath).arrayBuffer()
  const mimeType = step1Metadata.format === 'pdf' ? 'application/pdf' : imageMimeType(filePath)
  const deepSeekOcr = isDeepSeekOcrModel(model)
  const prediction = await runReplicatePrediction({
    apiToken,
    baseUrl: REPLICATE_DEFAULT_BASE_URL,
    model,
    ...(deepSeekOcr ? { version: REPLICATE_DEEPSEEK_OCR_VERSION } : {}),
    input: isMarkerModel(model)
      ? {
          file: `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`,
          mode: 'fast'
        }
      : deepSeekOcr
        ? {
            image: `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`,
            task_type: 'Convert to Markdown',
            reference_text: '',
            resolution_size: 'Gundam (Recommended)'
          }
      : {
          file: `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`,
          return_pages: true
        },
    operationName: 'Replicate OCR'
  })

  if (deepSeekOcr && typeof prediction.output === 'string' && prediction.output.trim().length > 0) {
    return {
      pages: [{ pageNumber: 0, method: 'ocr', text: prediction.output }],
      extractionMethod: 'replicate-ocr'
    }
  }
  if (!isRecord(prediction.output)) {
    throw ValidationError('Replicate OCR prediction completed without an object output', { stage: 'ocr:replicate:response' })
  }
  const outputPages = Array.isArray(prediction.output['pages']) ? prediction.output['pages'] : []
  const pages: PageResult[] = outputPages
    .map(pageText)
    .filter((text): text is string => text !== undefined)
    .map((text, index) => ({ pageNumber: index, method: 'ocr', text }))
  const text = typeof prediction.output['text'] === 'string'
    ? prediction.output['text']
    : typeof prediction.output['markdown'] === 'string'
      ? prediction.output['markdown']
      : undefined
  if (pages.length === 0 && text !== undefined) {
    pages.push({ pageNumber: 0, method: 'ocr', text })
  }
  if (pages.length === 0) {
    throw ValidationError('Replicate OCR prediction completed without extracted text', { stage: 'ocr:replicate:response' })
  }
  const pageCount = prediction.output['page_count']
  return {
    pages,
    extractionMethod: 'replicate-ocr',
    ...(typeof pageCount === 'number' ? { totalPages: pageCount } : {})
  }
}
