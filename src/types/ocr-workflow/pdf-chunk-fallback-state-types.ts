import type { HostedOcrIdentity, HostedOcrRun } from '~/types'

export type HostedOcrPageCacheValidation = {
  pageNumber?: number | undefined
  totalPages?: number | undefined
  sourceFile?: string | undefined
  identity?: HostedOcrIdentity | undefined
}

export type ParsedHostedOcrPageCache = {
  pageNumber: number
  totalPages: number
  run: HostedOcrRun
}

export type StoredHostedOcrFallbackPage = {
  version: number
  mode: typeof import('~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/pdf-chunk-fallback-shared').HOSTED_OCR_PDF_PAGE_FALLBACK_MODE
  totalPages: number
  pageNumber: number
  sourceFile: string
  run: HostedOcrRun
}
