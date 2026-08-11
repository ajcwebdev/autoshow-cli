import { join } from 'node:path'
import {
  HOSTED_OCR_PDF_PAGE_FALLBACK_STATE_FILE,
  HOSTED_OCR_PDF_PAGE_INPUTS_DIR,
  HOSTED_OCR_PDF_PAGE_RESULTS_DIR,
  HOSTED_OCR_PDF_PARTIAL_TEXT_FILE
} from './pdf-chunk-fallback-shared'

export const getFallbackStatePath = (fallbackDir: string): string =>
  join(fallbackDir, HOSTED_OCR_PDF_PAGE_FALLBACK_STATE_FILE)

export const getFallbackPageResultsDir = (fallbackDir: string): string =>
  join(fallbackDir, HOSTED_OCR_PDF_PAGE_RESULTS_DIR)

export const getFallbackPageInputsDir = (fallbackDir: string): string =>
  join(fallbackDir, HOSTED_OCR_PDF_PAGE_INPUTS_DIR)

export const getFallbackPageResultPath = (fallbackDir: string, pageNumber: number): string =>
  join(getFallbackPageResultsDir(fallbackDir), `page-${String(pageNumber).padStart(6, '0')}.json`)

export const getFallbackPageTextPath = (fallbackDir: string, pageNumber: number): string =>
  join(getFallbackPageResultsDir(fallbackDir), `page-${String(pageNumber).padStart(6, '0')}.txt`)

export const getFallbackPageInvalidResponsePath = (fallbackDir: string, pageNumber: number): string =>
  join(getFallbackPageResultsDir(fallbackDir), `page-${String(pageNumber).padStart(6, '0')}-invalid-response.txt`)

export const getFallbackPageInputPath = (fallbackDir: string, pageNumber: number, extension = 'pdf'): string =>
  join(getFallbackPageInputsDir(fallbackDir), `page-${String(pageNumber).padStart(6, '0')}.${extension}`)

export const getFallbackPartialTextPath = (fallbackDir: string): string =>
  join(fallbackDir, HOSTED_OCR_PDF_PARTIAL_TEXT_FILE)
