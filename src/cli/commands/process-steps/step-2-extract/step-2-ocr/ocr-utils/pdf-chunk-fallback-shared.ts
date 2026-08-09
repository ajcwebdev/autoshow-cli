import { stat } from 'node:fs/promises'
import type { OcrPdfChunkRange } from '~/types'
import { collectErrorChain } from '~/utils/error-handler'
import { isRecord } from '~/utils/rest-client'
import { stripAnsi } from '../ocr-run-state'

export const HOSTED_OCR_PDF_PAGE_FALLBACK_THRESHOLD = 20
export const HOSTED_OCR_PDF_PAGE_FALLBACK_VERSION = 2
export const HOSTED_OCR_PDF_PAGE_FALLBACK_MODE = 'single-page'
export const HOSTED_OCR_PDF_PAGE_FALLBACK_STATE_FILE = 'fallback-state.json'
export const HOSTED_OCR_PDF_PAGE_INPUTS_DIR = 'page-inputs'
export const HOSTED_OCR_PDF_PAGE_RESULTS_DIR = 'page-results'
export const HOSTED_OCR_PDF_PARTIAL_TEXT_FILE = 'partial-extraction.txt'
export const DEFAULT_RASTERIZED_PDF_CHUNK_DPI = 300

export { isRecord }

export const getErrorMessage = (error: unknown): string => {
  const chain = collectErrorChain(error)
  if (chain.length === 0) {
    return error instanceof Error ? error.message : String(error)
  }
  return chain.map((entry) => entry.message).filter(Boolean).join(' | ')
}

export const getErrorStatus = (error: unknown): number | undefined => {
  for (const entry of collectErrorChain(error)) {
    if (typeof entry['status'] === 'number') {
      return entry['status']
    }
  }
  return undefined
}

export const formatRange = (range: OcrPdfChunkRange): string =>
  range.startPage === range.endPage ? `page ${range.startPage}` : `pages ${range.startPage}-${range.endPage}`

export const formatPageRangeArg = (range: OcrPdfChunkRange): string =>
  range.startPage === range.endPage ? String(range.startPage) : `${range.startPage}-${range.endPage}`

export const summarizePdfChunkCreateCause = (stderr: string, stdout: string): string => {
  const raw = stripAnsi(stderr || stdout || '').trim()
  const firstLine = raw.split(/\r?\n/).map(line => line.trim()).find(line => line.length > 0)
  if (!firstLine) {
    return 'mutool convert failed'
  }
  return firstLine.length > 160 ? `${firstLine.slice(0, 157)}...` : firstLine
}

export const createOcrPdfChunkRenderError = (
  range: OcrPdfChunkRange,
  result: { exitCode: number, stderr: string, stdout: string, command: string }
): Error & {
  category: 'pdf_chunk_render'
  stage: 'pdf_chunk_render'
  pageStart: number
  pageEnd: number
  exitCode: number
  stderr: string
  stdout: string
  command: string
} =>
  Object.assign(
    new Error(`PDF chunk creation failed for ${formatRange(range)}: ${summarizePdfChunkCreateCause(result.stderr, result.stdout)}`),
    {
      category: 'pdf_chunk_render' as const,
      stage: 'pdf_chunk_render' as const,
      pageStart: range.startPage,
      pageEnd: range.endPage,
      exitCode: result.exitCode,
      stderr: result.stderr,
      stdout: result.stdout,
      command: result.command
    }
  )

export const getOcrPdfChunkRangePageCount = (range: OcrPdfChunkRange): number =>
  Math.max(0, range.endPage - range.startPage + 1)

export const hasNonEmptyFile = async (filePath: string): Promise<boolean> => {
  try {
    const fileStats = await stat(filePath)
    return fileStats.size > 0
  } catch {
    return false
  }
}
