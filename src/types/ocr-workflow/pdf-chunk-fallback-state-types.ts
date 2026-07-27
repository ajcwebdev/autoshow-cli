import type { HostedOcrRun } from '~/types'

export type StoredHostedOcrFallbackPage = {
  version: number
  mode: typeof import('~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/pdf-chunk-fallback-shared').HOSTED_OCR_PDF_PAGE_FALLBACK_MODE
  totalPages: number
  pageNumber: number
  run: HostedOcrRun
}
