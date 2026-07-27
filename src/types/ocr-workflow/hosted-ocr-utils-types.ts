import type { PageResult } from '~/types'
export type HostedOcrImageResult = {
  page: PageResult
  promptTokens?: number
  completionTokens?: number
}


export type StoredRenderedHostedOcrPage = {
  version: number
  mode: typeof import('~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-utils').RENDERED_HOSTED_OCR_PAGE_MODE
  extractionMethod: string
  model: string
  sourceFile: string
  totalPages: number
  pageNumber: number
  result: HostedOcrImageResult
}
