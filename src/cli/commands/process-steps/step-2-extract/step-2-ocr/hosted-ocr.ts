import { stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import { basename, extname, join } from 'node:path'
import { getExtractLimits } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import type { DocumentMetadata, ExtractionOptions, HostedDirectImageFormatSet, HostedDirectImageInputStrategy, HostedExtractOcrEngine, HostedOcrIdentity, HostedOcrRun, HostedOcrSchedulerRetryPressureHandler, HostedOcrService, RunHostedOcrPdfChunkFallbackOptions } from '~/types'
import { commandExists, exec } from '~/utils/cli-utils'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import { HOSTED_OCR_ADAPTERS, hostedOcrAdapterForEngine, hostedOcrAdapterForService } from './hosted-ocr-adapters'
import { GEMINI_FILE_UPLOAD_BYTES, GEMINI_PDF_PAGE_COUNT_LIMIT } from './ocr-services/gemini-ocr/gemini-ocr'
import { isBunImagePngNormalizableFormat, normalizeImageToPngWithBun } from './ocr-utils/bun-image-utils'
import { runHostedOcrSchedulerAdmission } from './ocr-utils/hosted-ocr-scheduler'
import { runHostedOcrWithPdfChunkFallback } from './ocr-utils/pdf-chunk-fallback'
import { isPdfEncrypted, resolvePdfPageCount } from './pdf/pdf-utils'

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < (1024 * 1024)) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < (1024 * 1024 * 1024)) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const formatHostedOcrLabel = (service: HostedOcrService): string =>
  hostedOcrAdapterForService(service).label

const getHostedOcrLimitSource = (service: HostedOcrService): string =>
  hostedOcrAdapterForService(service).limitSource

const BUN_PNG_FALLBACK_FORMATS = ['webp', 'gif', 'bmp'] as const
const IMAGEMAGICK_PNG_FALLBACK_FORMATS = ['tif'] as const

export const getHostedDirectImageSupportError = (engine: HostedExtractOcrEngine): string =>
  hostedOcrAdapterForEngine(engine).directImageSupportError

const hostedDirectImageFormats = (
  direct: readonly string[]
): HostedDirectImageFormatSet => {
  const directFormats = new Set(direct)
  const supportsPngUpload = directFormats.has('png')
  return {
    direct: directFormats,
    bunToPng: new Set<string>(
      supportsPngUpload
        ? BUN_PNG_FALLBACK_FORMATS.filter(format => !directFormats.has(format))
        : []
    ),
    imagemagickToPng: new Set<string>(
      supportsPngUpload
        ? IMAGEMAGICK_PNG_FALLBACK_FORMATS.filter(format => !directFormats.has(format))
        : []
    )
  }
}

const HOSTED_DIRECT_IMAGE_FORMATS = Object.fromEntries(
  HOSTED_OCR_ADAPTERS.map((adapter) => [adapter.engine, hostedDirectImageFormats([...adapter.directImageFormats])])
) as Record<HostedExtractOcrEngine, HostedDirectImageFormatSet>

const normalizeHostedImageFormat = (format: string): string =>
  format.toLowerCase() === 'jpeg'
    ? 'jpg'
    : format.toLowerCase() === 'tiff'
      ? 'tif'
      : format.toLowerCase()

export const resolveHostedDirectImageInputStrategy = (
  format: string,
  engine: HostedExtractOcrEngine
): HostedDirectImageInputStrategy => {
  const normalizedFormat = normalizeHostedImageFormat(format)
  const formats = HOSTED_DIRECT_IMAGE_FORMATS[engine]
  if (formats.direct.has(normalizedFormat)) {
    return 'direct'
  }
  if (formats.bunToPng.has(normalizedFormat)) {
    return 'bun-png'
  }
  if (formats.imagemagickToPng.has(normalizedFormat)) {
    return 'imagemagick-png'
  }
  return 'unsupported'
}

const normalizeHostedImageWithBun = async (
  imagePath: string,
  engine: HostedExtractOcrEngine,
  tempDir: string,
  outputStem: string,
  normalizedFormat: string
): Promise<{ filePath: string, format: DocumentMetadata['format'] }> => {
  if (!isBunImagePngNormalizableFormat(normalizedFormat)) {
    throw CLIUsageError(getHostedDirectImageSupportError(engine))
  }

  const pngPath = join(tempDir, `${outputStem}.png`)
  try {
    await normalizeImageToPngWithBun(imagePath, pngPath)
  } catch (error) {
    // A conversion failure is a tooling/infrastructure problem, not a usage mistake:
    // the format was accepted by `resolveHostedDirectImageInputStrategy`, so exiting 2
    // here would report "you typed it wrong" for a decoder failure.
    const message = error instanceof Error ? error.message : String(error)
    throw InfraError(
      `Failed to normalize ${basename(imagePath)} for --${engine}. Bun.Image could not convert ${normalizedFormat.toUpperCase()} to PNG: ${message}`,
      {
        stage: 'ocr:image-normalize',
        hints: ['Convert the image to PNG or JPG yourself (for example with ImageMagick) and rerun.'],
        ...(error instanceof Error ? { cause: error } : {})
      }
    )
  }

  return { filePath: pngPath, format: 'png' }
}

const normalizeHostedImageWithImageMagick = async (
  imagePath: string,
  engine: HostedExtractOcrEngine,
  tempDir: string,
  outputStem: string
): Promise<{ filePath: string, format: DocumentMetadata['format'] }> => {
  const imageMagickCommand = commandExists('magick')
    ? 'magick'
    : commandExists('convert')
      ? 'convert'
      : undefined
  if (!imageMagickCommand) {
    throw CLIUsageError(getHostedDirectImageSupportError(engine))
  }

  const pngPath = join(tempDir, `${outputStem}.png`)
  const result = await exec(imageMagickCommand, [imagePath, pngPath])
  if (result.exitCode !== 0) {
    throw InfraError(
      `Failed to normalize ${basename(imagePath)} for --${engine}. ${result.stderr || result.stdout || 'ImageMagick conversion failed.'}`,
      {
        stage: 'ocr:image-normalize',
        hints: ['Convert the image to PNG or JPG yourself and rerun.']
      }
    )
  }

  return { filePath: pngPath, format: 'png' }
}

export const normalizeHostedDirectImageInput = async (
  imagePath: string,
  engine: HostedExtractOcrEngine,
  tempDir: string,
  outputStem: string
): Promise<{ filePath: string, format: DocumentMetadata['format'] }> => {
  const ext = extname(imagePath).toLowerCase()
  const normalizedFormat = normalizeHostedImageFormat(ext.slice(1))

  const strategy = resolveHostedDirectImageInputStrategy(normalizedFormat, engine)
  if (strategy === 'direct') {
    return { filePath: imagePath, format: normalizedFormat as DocumentMetadata['format'] }
  }
  if (strategy === 'bun-png') {
    return await normalizeHostedImageWithBun(imagePath, engine, tempDir, outputStem, normalizedFormat)
  }
  if (strategy === 'imagemagick-png') {
    return await normalizeHostedImageWithImageMagick(imagePath, engine, tempDir, outputStem)
  }

  throw CLIUsageError(getHostedDirectImageSupportError(engine))
}

const resolveHostedOcrSelection = (
  opts: ExtractionOptions
): { service: HostedOcrService, model: string } | undefined => {
  for (const adapter of HOSTED_OCR_ADAPTERS) {
    const model = adapter.selectModel(opts)
    if (model !== undefined) return { service: adapter.service, model }
  }
  return undefined
}

const assertHostedOcrWithinLimits = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  opts: ExtractionOptions
): Promise<void> => {
  const selection = resolveHostedOcrSelection(opts)
  if (!selection) return

  if (selection.service === 'gemini') {
    const inputLabel = step1Metadata.format === 'pdf' ? 'PDF' : 'image'
    const fileStats = await stat(filePath)
    if (fileStats.size > GEMINI_FILE_UPLOAD_BYTES) {
      throw CLIUsageError(
        `${formatHostedOcrLabel(selection.service)} supports ${inputLabel} inputs up to ${formatBytes(GEMINI_FILE_UPLOAD_BYTES)} based on ${getHostedOcrLimitSource(selection.service)}. `
        + `Got ${formatBytes(fileStats.size)} for ${basename(filePath)}.`
      )
    }

    if (step1Metadata.format === 'pdf') {
      const pageCount = await resolvePdfPageCount(filePath, opts.password, step1Metadata.pageCount)
      if (typeof pageCount === 'number' && pageCount > GEMINI_PDF_PAGE_COUNT_LIMIT) {
        throw CLIUsageError(
          `${formatHostedOcrLabel(selection.service)} supports PDF inputs up to ${GEMINI_PDF_PAGE_COUNT_LIMIT} pages based on ${getHostedOcrLimitSource(selection.service)}. `
          + `Got ${pageCount} pages for ${basename(filePath)}.`
        )
      }
    }

    return
  }

  if (selection.service === 'anthropic' && step1Metadata.format === 'pdf') {
    if (typeof opts.password === 'string' && opts.password.length > 0) {
      throw CLIUsageError('Anthropic OCR only supports standard unencrypted PDFs. Remove --password and decrypt the PDF before using the Anthropic OCR provider.')
    }

    if (await isPdfEncrypted(filePath)) {
      throw CLIUsageError('Anthropic OCR only supports standard unencrypted PDFs. Decrypt the PDF before using the Anthropic OCR provider.')
    }
  }

  const limits = getExtractLimits(selection.service, selection.model, step1Metadata.format)
  if (
    limits.effectiveBytes === undefined
    && limits.pageCount === undefined
  ) {
    return
  }

  const inputLabel = step1Metadata.format === 'pdf' ? 'PDF' : 'image'
  const fileStats = await stat(filePath)

  if (typeof limits.effectiveBytes === 'number' && fileStats.size > limits.effectiveBytes) {
    throw CLIUsageError(
      `${formatHostedOcrLabel(selection.service)} supports ${inputLabel} inputs up to ${formatBytes(limits.effectiveBytes)} based on ${getHostedOcrLimitSource(selection.service)}. `
      + `Got ${formatBytes(fileStats.size)} for ${basename(filePath)}.`
    )
  }

  if (step1Metadata.format === 'pdf' && typeof limits.pageCount === 'number') {
    const pageCount = await resolvePdfPageCount(filePath, opts.password, step1Metadata.pageCount)
    if (typeof pageCount === 'number' && pageCount > limits.pageCount) {
      throw CLIUsageError(
        `${formatHostedOcrLabel(selection.service)} supports PDF inputs up to ${limits.pageCount} pages based on ${getHostedOcrLimitSource(selection.service)}. `
        + `Got ${pageCount} pages for ${basename(filePath)}.`
      )
    }
  }
}

const runChunkableHostedPdfOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  opts: ExtractionOptions,
  serviceLabel: string,
  identity: HostedOcrIdentity,
  runProvider: (inputPath: string, inputMetadata: DocumentMetadata, onRetryable?: HostedOcrSchedulerRetryPressureHandler | undefined, pageNumber?: number | undefined) => Promise<HostedOcrRun>,
  fallbackOptions: Pick<RunHostedOcrPdfChunkFallbackOptions, 'createChunk' | 'chunkFormat' | 'chunkExtension' | 'forcePageMode'> = {}
): Promise<HostedOcrRun> => {
  const reasoningPolicy = resolveReasoningPolicy({
    step: 'extract',
    service: identity.ocrService,
    model: identity.ocrModel,
    requestedReasoningEffort: opts.reasoningEffort
  })
  const inputSha256 = await new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
  const reasoningIdentity: HostedOcrIdentity = {
    ...identity,
    ...(reasoningPolicy.requested !== undefined ? { requestedReasoningEffort: reasoningPolicy.requested } : {}),
    effectiveReasoningEffort: reasoningPolicy.effective,
    ocrProviderMode: opts.ocrProviderMode ?? 'fanout',
    inputSha256,
    inputFormat: step1Metadata.format,
    ...(typeof opts.ocrPoolDocumentPageNumber === 'number' ? { inputPageNumber: opts.ocrPoolDocumentPageNumber } : {}),
    dpi: opts.dpi
  }
  const runScheduledProvider = async (
    inputPath: string,
    inputMetadata: DocumentMetadata,
    context: Record<string, unknown>,
    pageNumber?: number | undefined
  ): Promise<HostedOcrRun> =>
    await runHostedOcrSchedulerAdmission(
      opts.hostedOcrScheduler,
      {
        service: identity.ocrService,
        model: identity.ocrModel,
        targetKey: `${identity.ocrService}:${identity.ocrModel}`,
        pageCount: Math.max(1, inputMetadata.pageCount),
        ...(typeof pageNumber === 'number' ? { pageNumber } : {})
      },
      async (onRetryable) => {
        const run = await runProvider(inputPath, inputMetadata, onRetryable, pageNumber)
        return withHostedUsageDetail({
          ...run,
          ...(reasoningPolicy.requested !== undefined ? { requestedReasoningEffort: reasoningPolicy.requested } : {}),
          effectiveReasoningEffort: reasoningPolicy.effective,
          ocrProviderMode: reasoningIdentity.ocrProviderMode,
          inputSha256: reasoningIdentity.inputSha256,
          inputFormat: reasoningIdentity.inputFormat,
          ...(typeof reasoningIdentity.inputPageNumber === 'number' ? { inputPageNumber: reasoningIdentity.inputPageNumber } : {}),
          dpi: reasoningIdentity.dpi
        }, context)
      }
    )

  if (step1Metadata.format !== 'pdf') {
    return await runScheduledProvider(filePath, step1Metadata, {
      unit: 'document',
      pages: Math.max(1, step1Metadata.pageCount)
    })
  }

  const totalPages = Math.max(1, step1Metadata.pageCount)
  return await runHostedOcrWithPdfChunkFallback({
    filePath,
    step1Metadata,
    serviceLabel,
    totalPages,
    dpi: opts.dpi,
    password: opts.password,
    fallbackDir: opts.outputDir,
    cacheIdentity: reasoningIdentity,
    pageConcurrency: opts.hostedOcrScheduler?.getMaxConcurrency({
      service: identity.ocrService,
      model: identity.ocrModel,
      pageCount: totalPages
    }) ?? opts.ocrConcurrency,
    runFull: async () => await runScheduledProvider(filePath, step1Metadata, {
      unit: 'document',
      pages: totalPages
    }),
    runChunk: async (chunkPath, chunkMetadata, range) => await runScheduledProvider(chunkPath, chunkMetadata, {
      unit: 'chunk',
      pageStart: range.startPage,
      pageEnd: range.endPage,
      pages: Math.max(1, chunkMetadata.pageCount)
    }, opts.ocrPoolDocumentPageNumber ?? range.startPage),
    ...fallbackOptions,
    buildMalformedPageRun: (rawText, range) => ({
      pages: [{
        pageNumber: range.startPage,
        method: 'ocr',
        text: rawText
      }],
      extractionMethod: identity.extractionMethod,
      ocrService: identity.ocrService,
      ocrModel: identity.ocrModel,
      totalPages: Math.max(1, range.endPage - range.startPage + 1),
      ...(reasoningPolicy.requested !== undefined ? { requestedReasoningEffort: reasoningPolicy.requested } : {}),
      effectiveReasoningEffort: reasoningPolicy.effective,
      ocrProviderMode: reasoningIdentity.ocrProviderMode,
      inputSha256: reasoningIdentity.inputSha256,
      inputFormat: reasoningIdentity.inputFormat,
      ...(typeof reasoningIdentity.inputPageNumber === 'number' ? { inputPageNumber: reasoningIdentity.inputPageNumber } : {}),
      dpi: reasoningIdentity.dpi
    })
  })
}

const withHostedUsageDetail = (
  run: HostedOcrRun,
  context: Record<string, unknown>
): HostedOcrRun => {
  if (run.providerUsage && run.providerUsage.length > 0) {
    return {
      ...run,
      providerUsage: run.providerUsage.map((entry) => ({
        ...context,
        provider: run.ocrService,
        model: run.ocrModel,
        ...entry
      }))
    }
  }

  const hasUsage = typeof run.promptTokens === 'number'
    || typeof run.completionTokens === 'number'
    || typeof run.providerCostCents === 'number'

  if (!hasUsage) {
    return run
  }

  return {
    ...run,
    providerUsage: [{
      ...context,
      provider: run.ocrService,
      model: run.ocrModel,
      ...(typeof run.promptTokens === 'number' ? { promptTokens: run.promptTokens } : {}),
      ...(typeof run.completionTokens === 'number' ? { completionTokens: run.completionTokens } : {}),
      ...(typeof run.providerCostCents === 'number' ? { providerCostCents: run.providerCostCents } : {}),
      ...(run.providerCostSource ? { providerCostSource: run.providerCostSource } : {})
    }]
  }
}

export const runHostedOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  opts: ExtractionOptions
): Promise<HostedOcrRun> => {
  const selectedProvider = resolveHostedOcrSelection(opts)
  if (selectedProvider) {
    resolveReasoningPolicy({
      step: 'extract',
      service: selectedProvider.service,
      model: selectedProvider.model,
      requestedReasoningEffort: opts.reasoningEffort
    })
  }

  for (const adapter of HOSTED_OCR_ADAPTERS) {
    const ocrModel = adapter.selectModel(opts)
    if (ocrModel === undefined) continue

    await adapter.ensureSetup()
    return await runChunkableHostedPdfOcr(filePath, step1Metadata, opts, adapter.label, {
      extractionMethod: adapter.engine,
      ocrService: adapter.service,
      ocrModel
    }, async (inputPath, inputMetadata, onRetryable, pageNumber) => {
      await assertHostedOcrWithinLimits(inputPath, inputMetadata, opts)
      return await adapter.request({ inputPath, inputMetadata, ocrModel, opts, onRetryable, pageNumber })
    }, adapter.fallbackOptions?.(opts, ocrModel) ?? {})
  }

  throw CLIUsageError('Hosted OCR requested without a configured hosted OCR model.')
}
