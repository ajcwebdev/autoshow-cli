import type { DocumentMetadata, EpubArtifactFile, ExtractionMetadata, ExtractionOptions, ExtractionResult, FormatExtractionResult } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { writeFile } from '~/utils/cli-utils'
import * as l from '~/utils/app-logger/app-logger'
import { buildPdfChapterArtifacts } from './pdf/ocr-chapters/ocr-chapter-artifacts'
import {
  resolvePdfChapterDetectionMode,
  shouldAttemptPdfChapterExport,
} from './chapter-export-defaults'
import {
  countSelectedOcrEngines,
  hasEpubExportFlags,
  hasOcrFlag,
} from './ocr-engine-selection'
import { buildCombinedText } from './office/native-text-extractors'
import { buildOcrOutput } from './ocr-result'
import { hasPreparedMarkdownInput, resolveOcrInputAdapter } from './ocr-input-adapters'
import {
  CHAPTER_EXPORT_FLAGS_IGNORED_WARNING,
  PDF_LENGTH_WITHOUT_CHAPTERS_WARNING,
} from '../step-2-shared/inactive-flag-warnings'
import {
  extractCbzFormat,
  extractCsvFormat,
  extractEpubNativeFormat,
  extractEpubOcrFormat,
  extractHtmlFormat,
  extractImageFormat,
  extractOfficeNativeFormat,
  extractPdfFormat,
  extractRtfNativeFormat,
} from './ocr-format-extractors'

const writeExtractionTextCheckpoint = async (
  opts: ExtractionOptions,
  pages: FormatExtractionResult['pages'],
  canonicalText: string | undefined,
  extractionMethod: string
): Promise<void> => {
  if (opts.outputFormat !== 'text') {
    return
  }

  const text = opts.preparedMarkdown
    ? opts.preparedMarkdown.trim()
    : typeof canonicalText === 'string' && canonicalText.trim().length > 0
      ? canonicalText.trim()
      : buildCombinedText(pages, extractionMethod !== 'epub-text')

  await writeFile(`${opts.outputDir}/extraction.txt`, text)
}

export const runOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  opts: ExtractionOptions
): Promise<{ result: ExtractionResult, step2Metadata: ExtractionMetadata, artifactFiles?: EpubArtifactFile[] }> => {
  const start = Date.now()

  const normalizedFrom: string | undefined = typeof step1Metadata.sourceFormat === 'string'
    && step1Metadata.sourceFormat.length > 0
    && step1Metadata.sourceFormat !== step1Metadata.format
    ? step1Metadata.sourceFormat
    : undefined
  const conversionChain: string[] | undefined = Array.isArray(step1Metadata.conversionChain) && step1Metadata.conversionChain.length > 0
    ? [...step1Metadata.conversionChain]
    : undefined

  const ocrEngineCount = countSelectedOcrEngines(opts)

  if (!hasPreparedMarkdownInput(opts) && ocrEngineCount > 1) {
    throw UsageError('Use at most one OCR provider at a time. Select one with --provider provider[=model].')
  }

  const format = step1Metadata.format
  const inputAdapter = resolveOcrInputAdapter(format, opts)
  const epubExportFlagsActive = hasEpubExportFlags(opts)
  const pdfChunkOnlyRequested = format === 'pdf' && opts.chapterFiles === false && typeof opts.chapterChunkLimitChars === 'number'

  if (format !== 'epub' && format !== 'pdf' && epubExportFlagsActive) {
    l.warn(CHAPTER_EXPORT_FLAGS_IGNORED_WARNING, { category: 'pipeline' })
  }
  if (pdfChunkOnlyRequested) {
    l.warn(PDF_LENGTH_WITHOUT_CHAPTERS_WARNING, { category: 'pipeline' })
  }

  let extracted: FormatExtractionResult

  if (inputAdapter.family === 'html') {
    extracted = extractHtmlFormat(opts)
  } else if (inputAdapter.family === 'epub' && !hasOcrFlag(opts)) {
    extracted = await extractEpubNativeFormat(filePath, step1Metadata, opts, normalizedFrom)
  } else if (inputAdapter.family === 'epub' && hasOcrFlag(opts)) {
    extracted = await extractEpubOcrFormat(filePath, step1Metadata, opts, epubExportFlagsActive, conversionChain)
  } else if (inputAdapter.family === 'office') {
    extracted = await extractOfficeNativeFormat(filePath, format, opts)
  } else if (inputAdapter.family === 'rtf') {
    extracted = await extractRtfNativeFormat(filePath, opts)
  } else if (inputAdapter.family === 'csv') {
    extracted = await extractCsvFormat(filePath, opts)
  } else if (inputAdapter.family === 'cbz') {
    extracted = await extractCbzFormat(filePath, step1Metadata, opts)
  } else if (inputAdapter.family === 'image') {
    extracted = await extractImageFormat(filePath, step1Metadata, opts)
  } else {
    extracted = await extractPdfFormat(filePath, step1Metadata, opts)
  }

  let artifactFiles = extracted.artifactFiles
  let chapterExportSummary = extracted.chapterExportSummary
  let pdfChapterDetectionSummary = extracted.pdfChapterDetectionSummary

  const extractedPdfPageCount = extracted.pages.length > 0
    ? Math.max(...extracted.pages.map((page) => page.pageNumber))
    : 0
  const resolvedPdfPageCount = Math.max(
    extractedPdfPageCount,
    step1Metadata.pageCount,
    extracted.reportedTotalPages ?? 0
  )
  const pdfChapterFilesRequested = format === 'pdf'
    && shouldAttemptPdfChapterExport(opts.chapterFiles, resolvedPdfPageCount)

  if (pdfChapterFilesRequested && format === 'pdf') {
    await writeExtractionTextCheckpoint(opts, extracted.pages, extracted.canonicalText, extracted.extractionMethod)
    const pdfChapterMode = resolvePdfChapterDetectionMode(opts.chapterFiles, opts.pdfChapterMode)
    l.write('info', `Detecting PDF chapters with ${pdfChapterMode} mode`, { category: 'pipeline', metadata: { pdfChapterMode } })
    const pdfChapterOutput = await buildPdfChapterArtifacts({
      filePath,
      pages: extracted.pages,
      mode: pdfChapterMode,
      ...(typeof step1Metadata.title === 'string' ? { title: step1Metadata.title } : {}),
      ...(typeof step1Metadata.author === 'string' ? { author: step1Metadata.author } : {}),
      ...(typeof opts.password === 'string' ? { password: opts.password } : {}),
      ...(typeof opts.chapterChunkLimitChars === 'number' ? { chunkLimitChars: opts.chapterChunkLimitChars } : {})
    })
    artifactFiles = pdfChapterOutput.files
    chapterExportSummary = pdfChapterOutput.summary as Record<string, unknown> | undefined
    pdfChapterDetectionSummary = pdfChapterOutput.detection as unknown as Record<string, unknown>
  }

  return buildOcrOutput({
    start,
    pages: extracted.pages,
    extractionMethod: extracted.extractionMethod,
    step1Metadata,
    opts,
    inputFamily: extracted.inputFamily ?? inputAdapter.family,
    normalizedFrom: extracted.normalizedFrom ?? normalizedFrom,
    conversionChain: extracted.conversionChain ?? conversionChain,
    outputFidelity: extracted.outputFidelity,
    canonicalText: extracted.canonicalText,
    reportedTotalPages: extracted.reportedTotalPages,
    ocrService: extracted.ocrService,
    promptTokens: extracted.promptTokens,
    completionTokens: extracted.completionTokens,
    providerCostCents: extracted.providerCostCents,
    providerCostSource: extracted.providerCostSource,
    ocrProviderUsage: extracted.ocrProviderUsage,
    pdfChunkPreparation: extracted.pdfChunkPreparation,
    chapterExportSummary,
    pdfChapterDetectionSummary,
    artifactFiles,
    requestedReasoningEffort: extracted.requestedReasoningEffort,
    effectiveReasoningEffort: extracted.effectiveReasoningEffort,
  })
}
