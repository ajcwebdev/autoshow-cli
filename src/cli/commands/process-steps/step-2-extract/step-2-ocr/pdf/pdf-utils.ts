import { statPath as stat } from '~/utils/bun-file-io'
import { join } from 'node:path'
import { convertDocumentToPdf, getDocumentInfo, isPdfEncryptedViaQpdf, showPdfObject } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import type { DocumentMetadata, ExtractionOptions, PageResult } from '~/types'
import { InfraError } from '~/utils/error-handler'
import { processPages } from '../ocr-utils/page-processor'

export const convertEpubToPdfForOcr = async (
  filePath: string,
  tempDir: string,
  password?: string
): Promise<{ pdfPath: string, conversionChain: string[] }> => {
  const fallbackPdfPath = join(tempDir, 'epub-ocr.pdf')
  const converted = await convertDocumentToPdf(filePath, fallbackPdfPath, password)
  if (converted.exitCode !== 0) {
    throw InfraError(converted.stderr || converted.stdout || 'mutool convert failed', { stage: 'ocr:pdf' })
  }

  const outFile = Bun.file(fallbackPdfPath)
  if (!(await outFile.exists())) {
    throw InfraError(`mutool did not produce PDF output for ${filePath}`, { stage: 'ocr:pdf' })
  }

  return { pdfPath: fallbackPdfPath, conversionChain: ['mutool'] }
}

export const resolvePdfPageCount = async (
  filePath: string,
  password?: string,
  fallbackPageCount?: number
): Promise<number | undefined> => {
  try {
    const info = await getDocumentInfo(filePath, password)
    return Math.max(1, info.pageCount)
  } catch {
    return typeof fallbackPageCount === 'number' ? Math.max(1, fallbackPageCount) : undefined
  }
}

export const isPdfEncrypted = async (
  filePath: string,
  password?: string
): Promise<boolean> => {
  try {
    const qpdfResult = await isPdfEncryptedViaQpdf(filePath)
    if (qpdfResult !== undefined) return qpdfResult
  } catch {
    // qpdf unavailable or errored, fall through to mutool
  }
  try {
    const result = await showPdfObject(filePath, 'trailer/Encrypt', password)
    if (result.exitCode !== 0) {
      return false
    }

    const combined = `${result.stdout}\n${result.stderr}`.trim()
    return combined.length > 0 && combined !== 'null'
  } catch {
    return false
  }
}

export const buildHostedUploadMetadata = async (
  filePath: string,
  baseMetadata: DocumentMetadata,
  format: DocumentMetadata['format'],
  password?: string
): Promise<DocumentMetadata> => {
  const sourceStats = await stat(filePath)
  const pageCount = format === 'pdf'
    ? await resolvePdfPageCount(filePath, password, baseMetadata.pageCount)
    : 1

  return {
    ...baseMetadata,
    format,
    fileSize: sourceStats.size,
    pageCount: pageCount ?? (format === 'pdf' ? baseMetadata.pageCount : 1)
  }
}

export const runLocalPdfOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  opts: ExtractionOptions
): Promise<{ pages: PageResult[], extractionMethod: string }> => {
  const pages = await processPages(filePath, step1Metadata.pageCount, opts)
  return { pages, extractionMethod: 'mutool+tesseract' }
}

export const runPdfOcr = async (
  pdfPath: string,
  tempMeta: DocumentMetadata,
  opts: ExtractionOptions
): Promise<{ pages: PageResult[], extractionMethod: string }> => {
  const pages = await processPages(pdfPath, tempMeta.pageCount, opts)
  return { pages, extractionMethod: 'pdf+tesseract' }
}
