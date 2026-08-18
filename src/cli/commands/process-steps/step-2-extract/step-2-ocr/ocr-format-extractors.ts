import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  DocumentMetadata,
  EpubArtifactFile,
  ExtractionOptions,
  HostedOcrRun,
  PageResult,
} from '~/types'
import { CLIUsageError, ValidationError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { shouldExportEpubChapters } from './chapter-export-defaults'
import { buildEpubTextOutput } from './ebook/epub/export'
import { runEpubBunInspect } from './ebook/epub/run-epub-bun-inspect'
import {
  getHostedOcrEngine,
  hasHostedOcr,
  hasOcrFlag,
} from './ocr-engine-selection'
import {
  getHostedDirectImageSupportError,
  normalizeHostedDirectImageInput,
  runHostedOcr,
} from './hosted-ocr'
import {
  extractCbzImages,
  ocrSingleImage,
} from './image/image-ocr'
import {
  extractRtfFile,
  isZipXmlFormat,
  runZipXmlExtract,
} from './office/native-text-extractors'
import {
  buildHostedUploadMetadata,
  convertEpubToPdfForOcr,
  runLocalPdfOcr,
  runPdfOcr,
} from './pdf/pdf-utils'
import {
  CSV_OCR_FLAGS_IGNORED_WARNING,
  EPUB_EXPORT_FLAGS_IGNORED_OCR_WARNING,
} from '../step-2-shared/inactive-flag-warnings'
import type { NormalizedReasoningEffort } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'

export interface FormatExtractionResult {
  pages: PageResult[]
  extractionMethod: string
  inputFamily?: string | undefined
  normalizedFrom?: string | undefined
  conversionChain?: string[] | undefined
  outputFidelity?: string | undefined
  canonicalText?: string | undefined
  reportedTotalPages?: number | undefined
  ocrService?: string | undefined
  promptTokens?: number | undefined
  completionTokens?: number | undefined
  providerCostCents?: number | undefined
  providerCostSource?: HostedOcrRun['providerCostSource'] | undefined
  ocrProviderUsage?: HostedOcrRun['providerUsage'] | undefined
  pdfChunkPreparation?: HostedOcrRun['pdfChunkPreparation'] | undefined
  chapterExportSummary?: Record<string, unknown> | undefined
  pdfChapterDetectionSummary?: Record<string, unknown> | undefined
  artifactFiles?: EpubArtifactFile[] | undefined
  requestedReasoningEffort?: NormalizedReasoningEffort | undefined
  effectiveReasoningEffort?: NormalizedReasoningEffort | undefined
}

export const allInspectedEpubChaptersAreEmpty = (chapters: Array<{ text: string }>): boolean =>
  chapters.length > 0 && chapters.every((chapter) => chapter.text.trim().length === 0)

export const extractHtmlFormat = (opts: ExtractionOptions): FormatExtractionResult => ({
  pages: [{
    pageNumber: 1,
    method: 'text',
    text: opts.preparedMarkdown ?? ''
  }],
  extractionMethod: `html+${opts.htmlArticleBackend ?? 'defuddle'}`,
  inputFamily: 'html',
  outputFidelity: 'markdown',
})

export const extractEpubNativeFormat = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  opts: ExtractionOptions,
  normalizedFrom?: string
): Promise<FormatExtractionResult> => {
  l.write('info', 'Extracting EPUB chapter text with Bun ZIP/XML parser')
  const inspected = await runEpubBunInspect(filePath)
  if (allInspectedEpubChaptersAreEmpty(inspected.payload.chapters)) {
    throw ValidationError(
      'Native EPUB text extraction returned no text for any inspected chapter. The EPUB XHTML may be malformed or unsupported by the native extractor; retry with OCR (for example --provider tesseract).',
      { stage: 'ocr:epub' }
    )
  }
  const epubTextOutput = buildEpubTextOutput(step1Metadata.slug, inspected.payload.chapters, {
    chapterFiles: shouldExportEpubChapters(opts.chapterFiles),
    ...(inspected.payload.metadata.title ? { documentTitle: inspected.payload.metadata.title } : {}),
    ...(normalizedFrom ? { normalizedFrom } : {}),
    ...(typeof opts.chapterChunkLimitChars === 'number' ? { chunkLimitChars: opts.chapterChunkLimitChars } : {})
  })

  return {
    pages: epubTextOutput.pages,
    canonicalText: epubTextOutput.text,
    artifactFiles: epubTextOutput.exportPlan?.files,
    chapterExportSummary: epubTextOutput.exportPlan?.summary as Record<string, unknown> | undefined,
    extractionMethod: 'epub-text',
    inputFamily: 'epub',
    outputFidelity: 'cleaned-epub-text',
  }
}

export const extractEpubOcrFormat = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  opts: ExtractionOptions,
  epubExportFlagsActive: boolean,
  conversionChain?: string[]
): Promise<FormatExtractionResult> => {
  if (epubExportFlagsActive) {
    l.warn(EPUB_EXPORT_FLAGS_IGNORED_OCR_WARNING)
  }
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-epub-ocr-'))
  try {
    const { pdfPath, conversionChain: epubConversionChain } = await convertEpubToPdfForOcr(filePath, tempDir, opts.password)
    const tempMeta = await buildHostedUploadMetadata(pdfPath, step1Metadata, 'pdf', opts.password)
    const updatedChain = [...(conversionChain ?? []), ...epubConversionChain]
    if (hasHostedOcr(opts)) {
      const run = await runHostedOcr(pdfPath, tempMeta, opts)
      return {
        pages: run.pages,
        extractionMethod: `pdf+${run.extractionMethod}`,
        ocrService: run.ocrService,
        canonicalText: run.canonicalText,
        reportedTotalPages: run.totalPages,
        promptTokens: run.promptTokens,
        completionTokens: run.completionTokens,
        providerCostCents: run.providerCostCents,
        providerCostSource: run.providerCostSource,
        ocrProviderUsage: run.providerUsage,
        pdfChunkPreparation: run.pdfChunkPreparation,
        requestedReasoningEffort: run.requestedReasoningEffort,
        effectiveReasoningEffort: run.effectiveReasoningEffort,
        inputFamily: 'epub',
        conversionChain: updatedChain,
      }
    } else {
      const run = await runPdfOcr(pdfPath, tempMeta, opts)
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        inputFamily: 'epub',
        conversionChain: updatedChain,
      }
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

export const extractOfficeNativeFormat = async (
  filePath: string,
  format: string,
  opts: ExtractionOptions
): Promise<FormatExtractionResult> => {
  if (hasOcrFlag(opts)) {
    l.warn(`${format.toUpperCase()} OCR flags are ignored; extracting native ZIP/XML text with Bun`)
  }
  if (!isZipXmlFormat(format)) {
    throw CLIUsageError(`Unsupported ZIP/XML document format: ${format}`)
  }

  l.write('info', `Extracting ${format.toUpperCase()} with native ZIP/XML parser`)
  const run = await runZipXmlExtract(filePath, format)
  return {
    pages: run.pages,
    extractionMethod: 'office-native',
    inputFamily: 'office',
  }
}

export const extractRtfNativeFormat = async (
  filePath: string,
  opts: ExtractionOptions
): Promise<FormatExtractionResult> => {
  if (hasOcrFlag(opts)) {
    l.warn('RTF OCR flags are ignored; extracting native RTF text with Bun')
  }
  l.write('info', 'Extracting RTF with native text parser')
  const pages = await extractRtfFile(filePath)
  return {
    pages,
    extractionMethod: 'rtf-native',
    inputFamily: 'rtf',
  }
}

export const extractCsvFormat = async (
  filePath: string,
  opts: ExtractionOptions
): Promise<FormatExtractionResult> => {
  if (hasOcrFlag(opts)) {
    l.warn(CSV_OCR_FLAGS_IGNORED_WARNING)
  }
  const text = await Bun.file(filePath).text()
  return {
    pages: [{ pageNumber: 1, method: 'text', text }],
    extractionMethod: 'csv-raw',
    inputFamily: 'csv',
  }
}

export const extractCbzFormat = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  opts: ExtractionOptions
): Promise<FormatExtractionResult> => {
  l.write('info', 'Extracting images from CBZ archive')
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-cbz-'))
  try {
    const images = await extractCbzImages(filePath, tempDir)
    l.write('info', `Processing ${images.length} images from CBZ`)

    if (hasHostedOcr(opts)) {
      const hostedEngine = getHostedOcrEngine(opts)
      if (!hostedEngine) {
        throw CLIUsageError('Hosted OCR requested without a configured hosted OCR model.')
      }
      const imagePages: PageResult[] = []
      let totalPromptTokens = 0
      let totalCompletionTokens = 0
      let providerCostCents: number | undefined
      let providerCostSource: HostedOcrRun['providerCostSource'] | undefined
      let ocrProviderUsage: HostedOcrRun['providerUsage'] | undefined
      let ocrService: string | undefined
      let requestedReasoningEffort: NormalizedReasoningEffort | undefined
      let effectiveReasoningEffort: NormalizedReasoningEffort | undefined
      let pdfChunkPreparation: HostedOcrRun['pdfChunkPreparation'] | undefined

      const hostedNormDir = await mkdtemp(join(tmpdir(), 'autoshow-cbz-hosted-'))
      try {
        for (let i = 0; i < images.length; i++) {
          const imgPath = images[i]!
          const normalized = await normalizeHostedDirectImageInput(
            imgPath,
            hostedEngine,
            hostedNormDir,
            `cbz-page-${String(i + 1).padStart(4, '0')}`
          )
          const tempMeta = await buildHostedUploadMetadata(normalized.filePath, step1Metadata, normalized.format)
          const run = await runHostedOcr(normalized.filePath, tempMeta, opts)
          imagePages.push(...run.pages.map(page => ({ ...page, pageNumber: i + 1 })))
          ocrService = run.ocrService
          totalPromptTokens += run.promptTokens ?? 0
          totalCompletionTokens += run.completionTokens ?? 0
          if (run.requestedReasoningEffort !== undefined) requestedReasoningEffort = run.requestedReasoningEffort
          if (run.effectiveReasoningEffort !== undefined) effectiveReasoningEffort = run.effectiveReasoningEffort
          if (run.pdfChunkPreparation !== undefined) pdfChunkPreparation = run.pdfChunkPreparation
          if (typeof run.providerCostCents === 'number') {
            providerCostCents = (providerCostCents ?? 0) + run.providerCostCents
            providerCostSource = run.providerCostSource ?? providerCostSource
          }
          if (run.providerUsage && run.providerUsage.length > 0) {
            ocrProviderUsage = [...(ocrProviderUsage ?? []), ...run.providerUsage]
          }
        }
      } finally {
        await rm(hostedNormDir, { recursive: true, force: true })
      }
      return {
        pages: imagePages,
        extractionMethod: `cbz+${hostedEngine}`,
        inputFamily: 'cbz',
        ocrService,
        promptTokens: totalPromptTokens > 0 ? totalPromptTokens : undefined,
        completionTokens: totalCompletionTokens > 0 ? totalCompletionTokens : undefined,
        providerCostCents,
        providerCostSource,
        ocrProviderUsage,
        pdfChunkPreparation,
        requestedReasoningEffort,
        effectiveReasoningEffort,
      }
    } else {
      const ocrNormDir = await mkdtemp(join(tmpdir(), 'autoshow-cbz-ocr-'))
      try {
        const imagePages: PageResult[] = []
        for (let i = 0; i < images.length; i++) {
          const imgPath = images[i]!
          const result = await ocrSingleImage(imgPath, i + 1, opts, ocrNormDir)
          imagePages.push(result)
        }
        return {
          pages: imagePages,
          extractionMethod: 'cbz+tesseract',
          inputFamily: 'cbz',
        }
      } finally {
        await rm(ocrNormDir, { recursive: true, force: true })
      }
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

export const extractImageFormat = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  opts: ExtractionOptions
): Promise<FormatExtractionResult> => {
  if (hasHostedOcr(opts)) {
    const hostedEngine = getHostedOcrEngine(opts)
    if (!hostedEngine) {
      throw CLIUsageError('Hosted OCR requested without a configured hosted OCR model.')
    }

    const hostedNormDir = await mkdtemp(join(tmpdir(), 'autoshow-img-hosted-'))
    try {
      const normalized = await normalizeHostedDirectImageInput(filePath, hostedEngine, hostedNormDir, 'input-image')
      const tempMeta = normalized.filePath === filePath && normalized.format === step1Metadata.format
        ? step1Metadata
        : await buildHostedUploadMetadata(normalized.filePath, step1Metadata, normalized.format, opts.password)
      const run = await runHostedOcr(normalized.filePath, tempMeta, opts)
      return {
        pages: run.pages,
        extractionMethod: `image+${run.extractionMethod}`,
        inputFamily: 'image',
        ocrService: run.ocrService,
        canonicalText: run.canonicalText,
        reportedTotalPages: run.totalPages,
        promptTokens: run.promptTokens,
        completionTokens: run.completionTokens,
        providerCostCents: run.providerCostCents,
        providerCostSource: run.providerCostSource,
        ocrProviderUsage: run.providerUsage,
        pdfChunkPreparation: run.pdfChunkPreparation,
        requestedReasoningEffort: run.requestedReasoningEffort,
        effectiveReasoningEffort: run.effectiveReasoningEffort,
      }
    } finally {
      await rm(hostedNormDir, { recursive: true, force: true })
    }
  } else {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-img-ocr-'))
    try {
      const result = await ocrSingleImage(filePath, 1, opts, tempDir)
      return {
        pages: [result],
        extractionMethod: 'image+tesseract',
        inputFamily: 'image',
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }
}

export const extractPdfFormat = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  opts: ExtractionOptions
): Promise<FormatExtractionResult> => {
  if (hasHostedOcr(opts)) {
    if (step1Metadata.format !== 'pdf') {
      const hostedEngine = getHostedOcrEngine(opts) ?? 'mistral-ocr'
      throw CLIUsageError(getHostedDirectImageSupportError(hostedEngine))
    }
    const run = await runHostedOcr(filePath, step1Metadata, opts)
    return {
      pages: run.pages,
      extractionMethod: run.extractionMethod,
      inputFamily: 'pdf',
      ocrService: run.ocrService,
      canonicalText: run.canonicalText,
      reportedTotalPages: run.totalPages,
      promptTokens: run.promptTokens,
      completionTokens: run.completionTokens,
      providerCostCents: run.providerCostCents,
      providerCostSource: run.providerCostSource,
      ocrProviderUsage: run.providerUsage,
      pdfChunkPreparation: run.pdfChunkPreparation,
      requestedReasoningEffort: run.requestedReasoningEffort,
      effectiveReasoningEffort: run.effectiveReasoningEffort,
    }
  } else {
    const run = await runLocalPdfOcr(filePath, step1Metadata, opts)
    return {
      pages: run.pages,
      extractionMethod: run.extractionMethod,
      inputFamily: 'pdf',
    }
  }
}
