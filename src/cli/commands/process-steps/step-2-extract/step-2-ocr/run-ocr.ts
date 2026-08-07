import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DocumentMetadata, EpubArtifactFile, ExtractionMetadata, ExtractionOptions, ExtractionResult, HostedOcrRun, PageResult } from '~/types'
import { CLIUsageError, isAppError, ValidationError } from '~/utils/error-handler'
import { writeFile } from '~/utils/cli-utils'
import * as l from '~/utils/app-logger/app-logger'
import { buildPdfChapterArtifacts } from './pdf/ocr-chapters/ocr-chapter-artifacts'
import {
  resolvePdfChapterDetectionMode,
  shouldAttemptPdfChapterExport,
  shouldExportEpubChapters
} from './chapter-export-defaults'
import { buildEpubTextOutput } from './ebook/epub/export'
import { EPUB_UNREADABLE_CONTENT_REASON } from './ebook/epub/inspect-core'
import { runEpubBunInspect } from './ebook/epub/run-epub-bun-inspect'
import {
  countSelectedOcrEngines,
  getHostedOcrEngine,
  hasEpubExportFlags,
  hasHostedOcr,
  hasOcrFlag
} from './ocr-engine-selection'
import {
  getHostedDirectImageSupportError,
  normalizeHostedDirectImageInput,
  runHostedOcr
} from './hosted-ocr'
import {
  extractCbzImages,
  ocrSingleImage
} from './image/image-ocr'
import {
  buildCombinedText,
  extractRtfFile,
  isZipXmlFormat,
  runZipXmlExtract
} from './office/native-text-extractors'
import { buildOcrOutput } from './ocr-result'
import { hasPreparedMarkdownInput, resolveOcrInputAdapter } from './ocr-input-adapters'
import {
  buildHostedUploadMetadata,
  convertEpubToPdfForOcr,
  runLocalPdfOcr,
  runPdfOcr
} from './pdf/pdf-utils'
import {
  CHAPTER_EXPORT_FLAGS_IGNORED_WARNING,
  CSV_OCR_FLAGS_IGNORED_WARNING,
  EPUB_EXPORT_FLAGS_IGNORED_INSPECT_WARNING,
  EPUB_EXPORT_FLAGS_IGNORED_OCR_WARNING,
  EPUB_INSPECT_NON_EPUB_INFO,
  PDF_LENGTH_WITHOUT_CHAPTERS_WARNING
} from '../step-2-shared/inactive-flag-warnings'

const allInspectedEpubChaptersAreEmpty = (chapters: Array<{ text: string }>): boolean =>
  chapters.length > 0 && chapters.every((chapter) => chapter.text.trim().length === 0)

const isUnreadableEpubContentError = (error: unknown): boolean =>
  isAppError(error) && error.metadata['reason'] === EPUB_UNREADABLE_CONTENT_REASON

const maybeWriteAcsmFulfillmentHandoff = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  outputDir: string,
  error: unknown
): Promise<void> => {
  if (!isUnreadableEpubContentError(error)) return
  if (step1Metadata.sourceFormat !== 'acsm' || step1Metadata.format !== 'epub') return

  const handoffDir = join(outputDir, 'fulfilled')
  const fulfilledRelativePath = 'fulfilled/fulfilled.epub'
  const fulfilledOutputPath = join(outputDir, fulfilledRelativePath)
  await mkdir(handoffDir, { recursive: true })
  await cp(filePath, fulfilledOutputPath)
  await writeFile(join(outputDir, 'acsm-handoff.md'), [
    '# ACSM Fulfillment Handoff',
    '',
    `ACSM fulfillment completed and produced \`${fulfilledRelativePath}\`, but AutoShow could not extract text because the EPUB content appears encrypted or unsupported.`,
    '',
    'AutoShow does not remove DRM or decrypt EPUB content.',
    '',
    'If you have a readable EPUB or PDF from your own authorized workflow, run:',
    '',
    '```sh',
    'bun autoshow extract path/to/readable.epub',
    '```',
    ''
  ].join('\n'))
  l.write('info', `Saved ACSM fulfillment handoff artifact: ${fulfilledOutputPath}`)
}

const inspectEpubWithAcsmHandoff = async <T>(
  filePath: string,
  step1Metadata: DocumentMetadata,
  outputDir: string,
  inspect: () => Promise<T>
): Promise<T> => {
  try {
    return await inspect()
  } catch (error) {
    await maybeWriteAcsmFulfillmentHandoff(filePath, step1Metadata, outputDir, error)
    throw error
  }
}

export const runOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  opts: ExtractionOptions
): Promise<{ result: ExtractionResult, step2Metadata: ExtractionMetadata, artifactFiles?: EpubArtifactFile[] }> => {
  const start = Date.now()

  let pages: PageResult[] = []
  let extractionMethod: string
  let epubPayload: Record<string, unknown> | undefined
  let inputFamily: string | undefined
  let normalizedFrom: string | undefined = typeof step1Metadata.sourceFormat === 'string'
    && step1Metadata.sourceFormat.length > 0
    && step1Metadata.sourceFormat !== step1Metadata.format
    ? step1Metadata.sourceFormat
    : undefined
  let conversionChain: string[] | undefined = Array.isArray(step1Metadata.conversionChain) && step1Metadata.conversionChain.length > 0
    ? [...step1Metadata.conversionChain]
    : undefined
  let outputFidelity: string | undefined
  let canonicalText: string | undefined
  let reportedTotalPages: number | undefined
  let ocrService: string | undefined
  let promptTokens: number | undefined
  let completionTokens: number | undefined
  let providerCostCents: number | undefined
  let providerCostSource: HostedOcrRun['providerCostSource'] | undefined
  let ocrProviderUsage: HostedOcrRun['providerUsage'] | undefined
  let pdfChunkPreparation: HostedOcrRun['pdfChunkPreparation'] | undefined
  let chapterExportSummary: Record<string, unknown> | undefined
  let pdfChapterDetectionSummary: Record<string, unknown> | undefined
  let artifactFiles: EpubArtifactFile[] | undefined

  const mergeHostedProviderCost = (run: HostedOcrRun): void => {
    if (run.pdfChunkPreparation !== undefined) {
      pdfChunkPreparation = run.pdfChunkPreparation
    }
    if (typeof run.providerCostCents !== 'number') {
      if (run.providerUsage && run.providerUsage.length > 0) {
        ocrProviderUsage = [...(ocrProviderUsage ?? []), ...run.providerUsage]
      }
      return
    }
    providerCostCents = (providerCostCents ?? 0) + run.providerCostCents
    providerCostSource = run.providerCostSource ?? providerCostSource
    if (run.providerUsage && run.providerUsage.length > 0) {
      ocrProviderUsage = [...(ocrProviderUsage ?? []), ...run.providerUsage]
    }
  }

  const useEpubBun = opts.useEpubBun === true
  const useEpubInspect = step1Metadata.format === 'epub' && useEpubBun
  const ocrEngineCount = countSelectedOcrEngines(opts)

  if (!hasPreparedMarkdownInput(opts) && ocrEngineCount > 1) {
    throw CLIUsageError('Use at most one OCR provider at a time. Select one with --provider provider[=model].')
  }

  if (step1Metadata.format !== 'epub' && useEpubBun) {
    l.write('info', EPUB_INSPECT_NON_EPUB_INFO)
  }

  const writeExtractionTextCheckpoint = async (): Promise<void> => {
    if (opts.outputFormat !== 'text' || extractionMethod === 'epub-bun') {
      return
    }

    const text = opts.preparedMarkdown
      ? opts.preparedMarkdown.trim()
      : typeof canonicalText === 'string' && canonicalText.trim().length > 0
        ? canonicalText.trim()
        : buildCombinedText(pages, extractionMethod !== 'epub-text')

    await writeFile(`${opts.outputDir}/extraction.txt`, text)
  }

  const format = step1Metadata.format
  const inputAdapter = resolveOcrInputAdapter(format, opts)
  inputFamily = inputAdapter.family
  const epubExportFlagsActive = hasEpubExportFlags(opts)
  const pdfChunkOnlyRequested = format === 'pdf' && opts.epubChapterFiles === false && typeof opts.epubChunkLimitChars === 'number'

  if (format !== 'epub' && format !== 'pdf' && epubExportFlagsActive) {
    l.warn(CHAPTER_EXPORT_FLAGS_IGNORED_WARNING)
  }
  if (pdfChunkOnlyRequested) {
    l.warn(PDF_LENGTH_WITHOUT_CHAPTERS_WARNING)
  }

  if (inputAdapter.family === 'html') {
    pages = [{
      pageNumber: 1,
      method: 'text',
      text: opts.preparedMarkdown ?? ''
    }]
    extractionMethod = `html+${opts.htmlArticleBackend ?? 'defuddle'}`
    inputFamily = 'html'
    outputFidelity = 'markdown'
  } else if (useEpubInspect) {
    if (epubExportFlagsActive) {
      l.warn(EPUB_EXPORT_FLAGS_IGNORED_INSPECT_WARNING)
    }
    l.write('info', 'Inspecting EPUB with Bun ZIP/XML parser')
    const inspected = await inspectEpubWithAcsmHandoff(
      filePath,
      step1Metadata,
      opts.outputDir,
      async () => await runEpubBunInspect(filePath)
    )
    pages = inspected.payload.chapters.map((chapter) => ({
      pageNumber: chapter.index,
      method: 'text',
      text: chapter.text
    }))
    extractionMethod = 'epub-bun'
    epubPayload = inspected.payload as Record<string, unknown>
  } else if (inputAdapter.family === 'epub' && !hasOcrFlag(opts)) {
    l.write('info', 'Extracting EPUB chapter text with Bun ZIP/XML parser')
    const inspected = await inspectEpubWithAcsmHandoff(
      filePath,
      step1Metadata,
      opts.outputDir,
      async () => await runEpubBunInspect(filePath)
    )
    if (allInspectedEpubChaptersAreEmpty(inspected.payload.chapters)) {
      throw ValidationError(
        'Native EPUB text extraction returned no text for any inspected chapter. The EPUB XHTML may be malformed or unsupported by the native extractor; retry with OCR (for example --provider tesseract).',
        { stage: 'ocr:epub' }
      )
    }
    const epubTextOutput = buildEpubTextOutput(step1Metadata.slug, inspected.payload.chapters, {
      chapterFiles: shouldExportEpubChapters(opts.epubChapterFiles),
      ...(inspected.payload.metadata.title ? { documentTitle: inspected.payload.metadata.title } : {}),
      ...(normalizedFrom ? { normalizedFrom } : {}),
      ...(typeof opts.epubChunkLimitChars === 'number' ? { chunkLimitChars: opts.epubChunkLimitChars } : {})
    })

    pages = epubTextOutput.pages
    canonicalText = epubTextOutput.text
    artifactFiles = epubTextOutput.exportPlan?.files
    chapterExportSummary = epubTextOutput.exportPlan?.summary as Record<string, unknown> | undefined

    extractionMethod = 'epub-text'
    inputFamily = 'epub'
    outputFidelity = 'cleaned-epub-text'
  } else if (inputAdapter.family === 'epub' && hasOcrFlag(opts)) {
    if (epubExportFlagsActive) {
      l.warn(EPUB_EXPORT_FLAGS_IGNORED_OCR_WARNING)
    }
    inputFamily = 'epub'
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-epub-ocr-'))
    try {
      const { pdfPath, conversionChain: epubConversionChain } = await convertEpubToPdfForOcr(filePath, tempDir, opts.password)
      const tempMeta = await buildHostedUploadMetadata(pdfPath, step1Metadata, 'pdf', opts.password)
      if (hasHostedOcr(opts)) {
        const run = await runHostedOcr(pdfPath, tempMeta, opts)
        pages = run.pages
        extractionMethod = `pdf+${run.extractionMethod}`
        ocrService = run.ocrService
        canonicalText = run.canonicalText
        reportedTotalPages = run.totalPages
        promptTokens = run.promptTokens
        completionTokens = run.completionTokens
        mergeHostedProviderCost(run)
      } else {
        const run = await runPdfOcr(pdfPath, tempMeta, opts)
        pages = run.pages
        extractionMethod = run.extractionMethod
      }
      conversionChain = [...(conversionChain ?? []), ...epubConversionChain]
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  } else if (inputAdapter.family === 'office') {
    inputFamily = 'office'
    if (hasOcrFlag(opts)) {
      l.warn(`${format.toUpperCase()} OCR flags are ignored; extracting native ZIP/XML text with Bun`)
    }
    if (!isZipXmlFormat(format)) {
      throw CLIUsageError(`Unsupported ZIP/XML document format: ${format}`)
    }

    l.write('info', `Extracting ${format.toUpperCase()} with native ZIP/XML parser`)
    const run = await runZipXmlExtract(filePath, format)
    pages = run.pages
    extractionMethod = 'office-native'
  } else if (inputAdapter.family === 'rtf') {
    inputFamily = 'rtf'
    if (hasOcrFlag(opts)) {
      l.warn('RTF OCR flags are ignored; extracting native RTF text with Bun')
    }
    l.write('info', 'Extracting RTF with native text parser')
    pages = await extractRtfFile(filePath)
    extractionMethod = 'rtf-native'
  } else if (inputAdapter.family === 'csv') {
    inputFamily = 'csv'
    if (hasOcrFlag(opts)) {
      l.warn(CSV_OCR_FLAGS_IGNORED_WARNING)
    }
    const text = await Bun.file(filePath).text()
    pages = [{ pageNumber: 1, method: 'text', text }]
    extractionMethod = 'csv-raw'
  } else if (inputAdapter.family === 'cbz') {
    inputFamily = 'cbz'
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
            mergeHostedProviderCost(run)
          }
        } finally {
          await rm(hostedNormDir, { recursive: true, force: true })
        }
        pages = imagePages
        extractionMethod = `cbz+${hostedEngine}`
        if (totalPromptTokens > 0) promptTokens = totalPromptTokens
        if (totalCompletionTokens > 0) completionTokens = totalCompletionTokens
      } else {
        const ocrNormDir = await mkdtemp(join(tmpdir(), 'autoshow-cbz-ocr-'))
        try {
          const imagePages: PageResult[] = []
          for (let i = 0; i < images.length; i++) {
            const imgPath = images[i]!
            const result = await ocrSingleImage(imgPath, i + 1, opts, ocrNormDir)
            imagePages.push(result)
          }
          pages = imagePages
          extractionMethod = 'cbz+tesseract'
        } finally {
          await rm(ocrNormDir, { recursive: true, force: true })
        }
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  } else if (inputAdapter.family === 'image') {
    inputFamily = 'image'

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
        pages = run.pages
        extractionMethod = `image+${run.extractionMethod}`
        ocrService = run.ocrService
        canonicalText = run.canonicalText
        reportedTotalPages = run.totalPages
        promptTokens = run.promptTokens
        completionTokens = run.completionTokens
        mergeHostedProviderCost(run)
      } finally {
        await rm(hostedNormDir, { recursive: true, force: true })
      }
    } else {
      const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-img-ocr-'))
      try {
        const result = await ocrSingleImage(filePath, 1, opts, tempDir)
        pages = [result]
        extractionMethod = 'image+tesseract'
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    }
  } else {
    inputFamily = 'pdf'

    if (hasHostedOcr(opts)) {
      if (format !== 'pdf') {
        const hostedEngine = getHostedOcrEngine(opts) ?? 'mistral-ocr'
        throw CLIUsageError(getHostedDirectImageSupportError(hostedEngine))
      }
      const run = await runHostedOcr(filePath, step1Metadata, opts)
      pages = run.pages
      extractionMethod = run.extractionMethod
      ocrService = run.ocrService
      canonicalText = run.canonicalText
      reportedTotalPages = run.totalPages
      promptTokens = run.promptTokens
      completionTokens = run.completionTokens
      mergeHostedProviderCost(run)
    } else {
      const run = await runLocalPdfOcr(filePath, step1Metadata, opts)
      pages = run.pages
      extractionMethod = run.extractionMethod
    }
  }

  const extractedPdfPageCount = pages.length > 0
    ? Math.max(...pages.map((page) => page.pageNumber))
    : 0
  const resolvedPdfPageCount = Math.max(
    extractedPdfPageCount,
    step1Metadata.pageCount,
    reportedTotalPages ?? 0
  )
  const pdfChapterFilesRequested = format === 'pdf'
    && shouldAttemptPdfChapterExport(opts.epubChapterFiles, resolvedPdfPageCount)

  if (pdfChapterFilesRequested && format === 'pdf') {
    await writeExtractionTextCheckpoint()
    const pdfChapterMode = resolvePdfChapterDetectionMode(opts.epubChapterFiles, opts.pdfChapterMode)
    l.write('info', `Detecting PDF chapters with ${pdfChapterMode} mode`)
    const pdfChapterOutput = await buildPdfChapterArtifacts({
      filePath,
      pages,
      mode: pdfChapterMode,
      ...(typeof step1Metadata.title === 'string' ? { title: step1Metadata.title } : {}),
      ...(typeof step1Metadata.author === 'string' ? { author: step1Metadata.author } : {}),
      ...(typeof opts.password === 'string' ? { password: opts.password } : {}),
      ...(typeof opts.epubChunkLimitChars === 'number' ? { chunkLimitChars: opts.epubChunkLimitChars } : {}),
      ...(typeof opts.pdfChapterLlmService === 'string' ? { llmService: opts.pdfChapterLlmService } : {}),
      ...(typeof opts.pdfChapterLlmModel === 'string' ? { llmModel: opts.pdfChapterLlmModel } : {})
    })
    artifactFiles = pdfChapterOutput.files
    chapterExportSummary = pdfChapterOutput.summary as Record<string, unknown> | undefined
    pdfChapterDetectionSummary = pdfChapterOutput.detection as unknown as Record<string, unknown>
  }

  return buildOcrOutput({
    start,
    pages,
    extractionMethod,
    step1Metadata,
    opts,
    epubPayload,
    inputFamily,
    normalizedFrom,
    conversionChain,
    outputFidelity,
    canonicalText,
    reportedTotalPages,
    ocrService,
    promptTokens,
    completionTokens,
    providerCostCents,
    providerCostSource,
    ocrProviderUsage,
    pdfChunkPreparation,
    chapterExportSummary,
    pdfChapterDetectionSummary,
    artifactFiles
  })
}
