import { convertDocumentToPdf, renderPageToImage, splitPdfPages } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import type { OcrPdfChunkRange, PdfChunkLocalTools, PdfChunkSplitLogMode, PdfChunkSplitResult, PdfChunkSplitTool } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { formatPageRangeArg, formatRange, hasNonEmptyFile } from './pdf-chunk-fallback-shared'
import { summarizeSplitFailureMessage } from './pdf-chunk-preparation-state'

export const defaultPdfChunkLocalTools: PdfChunkLocalTools = {
  splitPdfPages,
  renderPageToImage,
  convertDocumentToPdf
}

export const tryCreateDirectPdfChunk = async (options: {
  inputPath: string
  outputPath: string
  range: OcrPdfChunkRange
  password?: string | undefined
  tools: PdfChunkLocalTools
  splitLogMode?: PdfChunkSplitLogMode | undefined
  logLabel?: string | undefined
  disabledTools?: PdfChunkSplitTool[] | undefined
}): Promise<{ created: boolean, result: PdfChunkSplitResult }> => {
  const splitOptions = options.splitLogMode !== undefined || options.logLabel !== undefined || (options.disabledTools?.length ?? 0) > 0
    ? {
        ...(options.splitLogMode !== undefined ? { logMode: options.splitLogMode } : {}),
        ...(options.logLabel !== undefined ? { logLabel: options.logLabel } : {}),
        ...((options.disabledTools?.length ?? 0) > 0 ? { disabledTools: options.disabledTools } : {})
      }
    : undefined
  const result = await options.tools.splitPdfPages(
    options.inputPath,
    options.outputPath,
    formatPageRangeArg(options.range),
    options.password,
    splitOptions
  )

  if ((result.exitCode === 0 || (result.exitCode === 3 && result.tool === 'qpdf')) && await hasNonEmptyFile(options.outputPath)) {
    return { created: true, result }
  }
  if (await hasNonEmptyFile(options.outputPath)) {
    return { created: true, result }
  }

  return { created: false, result }
}

export const buildDirectSplitDiagnosticMetadata = (
  range: OcrPdfChunkRange,
  result: PdfChunkSplitResult
): Record<string, unknown> => ({
  range,
  directSplit: {
    tool: result.tool,
    exitCode: result.exitCode,
    attempts: result.attempts ?? [{ tool: result.tool, exitCode: result.exitCode }],
    message: summarizeSplitFailureMessage(result)
  }
})

export const writeDirectSplitFallbackLog = (
  logMode: PdfChunkSplitLogMode,
  range: OcrPdfChunkRange,
  result: PdfChunkSplitResult,
  logLabel?: string | undefined
): void => {
  if (logMode === 'silent') {
    return
  }

  const baseMessage = `PDF chunk extraction failed for ${formatRange(range)}; rasterizing page to PDF`
  const message = logLabel ? `${logLabel}: ${baseMessage}` : baseMessage
  if (logMode === 'debug') {
    l.write('debug', message, { category: 'pipeline', metadata: buildDirectSplitDiagnosticMetadata(range, result) })
    return
  }

  l.write('warn', message, { category: 'pipeline', metadata: buildDirectSplitDiagnosticMetadata(range, result) })
}
