import { stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { getExtractLimits } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import type { DocumentMetadata, ExtractionOptions, HostedDirectImageFormatSet, HostedDirectImageInputStrategy, HostedExtractOcrEngine, HostedOcrIdentity, HostedOcrRun, HostedOcrSchedulerRetryPressureHandler, HostedOcrService, RunHostedOcrPdfChunkFallbackOptions } from '~/types'
import { commandExists, exec } from '~/utils/cli-utils'
import { CLIUsageError } from '~/utils/error-handler'
import { hasAnthropicOcr, hasDeepinfraOcr, hasGeminiOcr, hasGlmOcr, hasGrokOcr, hasKimiOcr, hasMistralOcr, hasOpenAIOcr } from './ocr-engine-selection'
import { ANTHROPIC_OCR_LIMIT_SOURCE, ensureAnthropicOcrSetup } from './ocr-services/anthropic-ocr/anthropic-ocr'
import { runAnthropicOcr } from './ocr-services/anthropic-ocr/run-anthropic-ocr'
import { DEEPINFRA_OCR_LIMIT_SOURCE, ensureDeepinfraOcrSetup } from './ocr-services/deepinfra-ocr/deepinfra-ocr'
import { runDeepinfraOcr } from './ocr-services/deepinfra-ocr/run-deepinfra-ocr'
import { GEMINI_FILE_UPLOAD_BYTES, GEMINI_OCR_LIMIT_SOURCE, GEMINI_PDF_PAGE_COUNT_LIMIT, ensureGeminiOcrSetup } from './ocr-services/gemini-ocr/gemini-ocr'
import { runGeminiOcr } from './ocr-services/gemini-ocr/run-gemini-ocr'
import { ensureGlmOcrSetup } from './ocr-services/glm-ocr/glm'
import { runGlmOcr } from './ocr-services/glm-ocr/run-glm-ocr'
import { GROK_OCR_LIMIT_SOURCE, ensureGrokOcrSetup } from './ocr-services/grok-ocr/grok-ocr'
import { runGrokOcr } from './ocr-services/grok-ocr/run-grok-ocr'
import { KIMI_OCR_LIMIT_SOURCE, ensureKimiOcrSetup } from './ocr-services/kimi-ocr/kimi'
import { runKimiOcr } from './ocr-services/kimi-ocr/run-kimi-ocr'
import { ensureMistralOcrSetup } from './ocr-services/mistral-ocr/mistral-ocr'
import { runMistralOcr } from './ocr-services/mistral-ocr/run-mistral-ocr'
import { ensureOpenAIOcrSetup } from './ocr-services/openai-ocr/openai-ocr'
import { runOpenAIOcr } from './ocr-services/openai-ocr/run-openai-ocr'
import { isBunImagePngNormalizableFormat, normalizeImageToPngWithBun } from './ocr-utils/bun-image-utils'
import { runHostedOcrSchedulerAdmission } from './ocr-utils/hosted-ocr-scheduler'
import { createRenderedPngPageChunk, runHostedOcrWithPdfChunkFallback } from './ocr-utils/pdf-chunk-fallback'
import { isPdfEncrypted, resolvePdfPageCount } from './pdf/pdf-utils'

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < (1024 * 1024)) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < (1024 * 1024 * 1024)) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const formatHostedOcrLabel = (service: HostedOcrService): string => {
  switch (service) {
    case 'glm':
      return 'GLM OCR'
    case 'kimi':
      return 'Kimi OCR'
    case 'mistral':
      return 'Mistral OCR'
    case 'openai':
      return 'OpenAI OCR'
    case 'grok':
      return 'Grok OCR'
    case 'anthropic':
      return 'Anthropic OCR'
    case 'gemini':
      return 'Gemini OCR'
    case 'deepinfra':
      return 'DeepInfra OCR'
  }
}

const getHostedOcrLimitSource = (service: HostedOcrService): string => {
  switch (service) {
    case 'mistral':
      return 'project/links/mistral-general-ocr-links.md'
    case 'openai':
      return 'project/links/openai-general-ocr-text-links.md'
    case 'grok':
      return GROK_OCR_LIMIT_SOURCE
    case 'anthropic':
      return ANTHROPIC_OCR_LIMIT_SOURCE
    case 'gemini':
      return GEMINI_OCR_LIMIT_SOURCE
    case 'deepinfra':
      return DEEPINFRA_OCR_LIMIT_SOURCE
    case 'glm':
      return 'project/links/glm-all-links.md'
    case 'kimi':
      return KIMI_OCR_LIMIT_SOURCE
  }
}

const BUN_PNG_FALLBACK_FORMATS = ['webp', 'gif', 'bmp'] as const
const IMAGEMAGICK_PNG_FALLBACK_FORMATS = ['tif'] as const

export const getHostedDirectImageSupportError = (engine: HostedExtractOcrEngine): string => {
  if (engine === 'glm-ocr') {
    return 'The GLM OCR provider sends PNG/JPG images to GLM directly; PDF pages are rendered to PNG. AutoShow normalizes WEBP/GIF/BMP images locally with Bun.Image. Install ImageMagick so AutoShow can normalize TIF images automatically.'
  }
  if (engine === 'kimi-ocr') {
    return 'The Kimi OCR provider sends PNG/JPG/WEBP/GIF images to Kimi directly; PDF pages are rendered to PNG. AutoShow normalizes BMP images locally with Bun.Image. Install ImageMagick so AutoShow can normalize TIF images automatically.'
  }
  if (engine === 'mistral-ocr') {
    return 'The Mistral OCR provider sends PDF and PNG/JPG/TIF images to Mistral directly. AutoShow normalizes WEBP/GIF/BMP images locally with Bun.Image.'
  }
  if (engine === 'anthropic-ocr') {
    return 'The Anthropic OCR provider supports PDF and PNG/JPG/WEBP/GIF images directly. AutoShow normalizes BMP images locally with Bun.Image. Install ImageMagick so AutoShow can normalize TIF images automatically.'
  }
  if (engine === 'gemini-ocr') {
    return 'The Gemini OCR provider supports PDF and PNG/JPG/WEBP/BMP images directly. AutoShow normalizes GIF images locally with Bun.Image. Install ImageMagick so AutoShow can normalize TIF images automatically.'
  }
  if (engine === 'deepinfra-ocr') {
    return 'The DeepInfra OCR provider sends PNG/JPG/WEBP images to DeepInfra directly; PDF pages are rendered to PNG. AutoShow normalizes GIF/BMP images locally with Bun.Image. Install ImageMagick so AutoShow can normalize TIF images automatically.'
  }
  if (engine === 'grok-ocr') {
    return 'The Grok OCR provider sends PNG/JPG images to Grok directly; PDF pages are rendered to PNG. AutoShow normalizes WEBP/GIF/BMP images locally with Bun.Image. Install ImageMagick so AutoShow can normalize TIF images automatically.'
  }
  return 'The OpenAI OCR provider supports PDF and PNG/JPG/WEBP/GIF images directly. AutoShow normalizes BMP images locally with Bun.Image. Install ImageMagick so AutoShow can normalize TIF images automatically.'
}

const hostedDirectImageFormats = (
  direct: string[]
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

const HOSTED_DIRECT_IMAGE_FORMATS: Record<HostedExtractOcrEngine, HostedDirectImageFormatSet> = {
  'glm-ocr': hostedDirectImageFormats(['png', 'jpg']),
  'kimi-ocr': hostedDirectImageFormats(['png', 'jpg', 'webp', 'gif']),
  'mistral-ocr': hostedDirectImageFormats(['png', 'jpg', 'tif']),
  'openai-ocr': hostedDirectImageFormats(['png', 'jpg', 'webp', 'gif']),
  'grok-ocr': hostedDirectImageFormats(['png', 'jpg']),
  'anthropic-ocr': hostedDirectImageFormats(['png', 'jpg', 'webp', 'gif']),
  'gemini-ocr': hostedDirectImageFormats(['png', 'jpg', 'webp', 'bmp']),
  'deepinfra-ocr': hostedDirectImageFormats(['png', 'jpg', 'webp'])
}

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
    const message = error instanceof Error ? error.message : String(error)
    throw CLIUsageError(`Failed to normalize ${basename(imagePath)} for --${engine}. Bun.Image could not convert ${normalizedFormat.toUpperCase()} to PNG: ${message}`)
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
    throw CLIUsageError(`Failed to normalize ${basename(imagePath)} for --${engine}. ${result.stderr || result.stdout || 'ImageMagick conversion failed.'}`)
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
  if (hasMistralOcr(opts)) {
    return { service: 'mistral', model: opts.mistralOcrModel as string }
  }

  if (hasGlmOcr(opts)) {
    return { service: 'glm', model: opts.glmOcrModel as string }
  }

  if (hasKimiOcr(opts)) {
    return { service: 'kimi', model: opts.kimiOcrModel as string }
  }

  if (hasOpenAIOcr(opts)) {
    return { service: 'openai', model: opts.openaiOcrModel as string }
  }

  if (hasGrokOcr(opts)) {
    return { service: 'grok', model: opts.grokOcrModel as string }
  }

  if (hasAnthropicOcr(opts)) {
    return { service: 'anthropic', model: opts.anthropicOcrModel as string }
  }

  if (hasGeminiOcr(opts)) {
    return { service: 'gemini', model: opts.geminiOcrModel as string }
  }

  if (hasDeepinfraOcr(opts)) {
    return { service: 'deepinfra', model: opts.deepinfraOcrModel as string }
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
  const reasoningIdentity: HostedOcrIdentity = {
    ...identity,
    ...(reasoningPolicy.requested !== undefined ? { requestedReasoningEffort: reasoningPolicy.requested } : {}),
    effectiveReasoningEffort: reasoningPolicy.effective
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
          effectiveReasoningEffort: reasoningPolicy.effective
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
    keepPageInputs: opts.keepOcrPageInputs,
    runFull: async () => await runScheduledProvider(filePath, step1Metadata, {
      unit: 'document',
      pages: totalPages
    }),
    runChunk: async (chunkPath, chunkMetadata, range) => await runScheduledProvider(chunkPath, chunkMetadata, {
      unit: 'chunk',
      pageStart: range.startPage,
      pageEnd: range.endPage,
      pages: Math.max(1, chunkMetadata.pageCount)
    }, range.startPage),
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
      effectiveReasoningEffort: reasoningPolicy.effective
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

  if (hasMistralOcr(opts)) {
    await ensureMistralOcrSetup()
    const ocrModel = opts.mistralOcrModel as string
    return await runChunkableHostedPdfOcr(filePath, step1Metadata, opts, 'Mistral OCR', {
      extractionMethod: 'mistral-ocr',
      ocrService: 'mistral',
      ocrModel
    }, async (inputPath, inputMetadata, onRetryable) => {
      await assertHostedOcrWithinLimits(inputPath, inputMetadata, opts)
      const run = await runMistralOcr(inputPath, inputMetadata, ocrModel, { onRetryable })
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        ocrService: 'mistral',
        ocrModel
      }
    })
  }

  if (hasGlmOcr(opts)) {
    await ensureGlmOcrSetup()
    const ocrModel = opts.glmOcrModel as string
    return await runChunkableHostedPdfOcr(filePath, step1Metadata, opts, 'GLM OCR', {
      extractionMethod: 'glm-ocr',
      ocrService: 'glm',
      ocrModel
    }, async (inputPath, inputMetadata, onRetryable) => {
      await assertHostedOcrWithinLimits(inputPath, inputMetadata, opts)
      const run = await runGlmOcr(inputPath, inputMetadata, ocrModel, {
        onRetryable,
        reasoningEffort: opts.reasoningEffort
      })
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        ocrService: 'glm',
        ocrModel,
        canonicalText: run.markdown,
        ...(typeof run.totalPages === 'number' ? { totalPages: run.totalPages } : {}),
        ...(typeof run.promptTokens === 'number' ? { promptTokens: run.promptTokens } : {}),
        ...(typeof run.completionTokens === 'number' ? { completionTokens: run.completionTokens } : {})
      }
    })
  }

  if (hasKimiOcr(opts)) {
    await ensureKimiOcrSetup()
    const ocrModel = opts.kimiOcrModel as string
    return await runChunkableHostedPdfOcr(filePath, step1Metadata, opts, 'Kimi OCR', {
      extractionMethod: 'kimi-ocr',
      ocrService: 'kimi',
      ocrModel
    }, async (inputPath, inputMetadata, onRetryable, pageNumber) => {
      await assertHostedOcrWithinLimits(inputPath, inputMetadata, opts)
      const run = await runKimiOcr(inputPath, inputMetadata, ocrModel, {
        dpi: opts.dpi,
        password: opts.password,
        outputDir: opts.outputDir,
        ocrConcurrency: opts.ocrConcurrency,
        ocrConcurrencyMode: opts.ocrConcurrencyMode,
        hostedOcrScheduler: opts.hostedOcrScheduler,
        ocrPreparationCache: opts.ocrPreparationCache,
        onRetryable,
        documentPageNumber: pageNumber,
        reasoningEffort: opts.reasoningEffort
      })
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        ocrService: 'kimi',
        ocrModel,
        totalPages: run.totalPages,
        ...(typeof run.promptTokens === 'number' ? { promptTokens: run.promptTokens } : {}),
        ...(typeof run.completionTokens === 'number' ? { completionTokens: run.completionTokens } : {})
      }
    }, {
      forcePageMode: true,
      createChunk: createRenderedPngPageChunk(opts.dpi, opts.ocrPreparationCache),
      chunkFormat: 'png',
      chunkExtension: 'png'
    })
  }

  if (hasOpenAIOcr(opts)) {
    await ensureOpenAIOcrSetup()
    const ocrModel = opts.openaiOcrModel as string
    return await runChunkableHostedPdfOcr(filePath, step1Metadata, opts, 'OpenAI OCR', {
      extractionMethod: 'openai-ocr',
      ocrService: 'openai',
      ocrModel
    }, async (inputPath, inputMetadata, onRetryable) => {
      await assertHostedOcrWithinLimits(inputPath, inputMetadata, opts)
      const run = await runOpenAIOcr(inputPath, inputMetadata, ocrModel, {
        onRetryable,
        reasoningEffort: opts.reasoningEffort
      })
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        ocrService: 'openai',
        ocrModel,
        totalPages: run.totalPages,
        ...(typeof run.promptTokens === 'number' ? { promptTokens: run.promptTokens } : {}),
        ...(typeof run.completionTokens === 'number' ? { completionTokens: run.completionTokens } : {})
      }
    })
  }

  if (hasGrokOcr(opts)) {
    await ensureGrokOcrSetup()
    const ocrModel = opts.grokOcrModel as string
    return await runChunkableHostedPdfOcr(filePath, step1Metadata, opts, 'Grok OCR', {
      extractionMethod: 'grok-ocr',
      ocrService: 'grok',
      ocrModel
    }, async (inputPath, inputMetadata, onRetryable, pageNumber) => {
      await assertHostedOcrWithinLimits(inputPath, inputMetadata, opts)
      const run = await runGrokOcr(inputPath, inputMetadata, ocrModel, {
        dpi: opts.dpi,
        password: opts.password,
        outputDir: opts.outputDir,
        ocrConcurrency: opts.ocrConcurrency,
        ocrConcurrencyMode: opts.ocrConcurrencyMode,
        hostedOcrScheduler: opts.hostedOcrScheduler,
        ocrPreparationCache: opts.ocrPreparationCache,
        onRetryable,
        documentPageNumber: pageNumber,
        reasoningEffort: opts.reasoningEffort
      })
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        ocrService: 'grok',
        ocrModel,
        totalPages: run.totalPages,
        ...(typeof run.promptTokens === 'number' ? { promptTokens: run.promptTokens } : {}),
        ...(typeof run.completionTokens === 'number' ? { completionTokens: run.completionTokens } : {})
      }
    }, {
      forcePageMode: true,
      createChunk: createRenderedPngPageChunk(opts.dpi, opts.ocrPreparationCache),
      chunkFormat: 'png',
      chunkExtension: 'png'
    })
  }

  if (hasAnthropicOcr(opts)) {
    await ensureAnthropicOcrSetup()
    const ocrModel = opts.anthropicOcrModel as string
    return await runChunkableHostedPdfOcr(filePath, step1Metadata, opts, 'Anthropic OCR', {
      extractionMethod: 'anthropic-ocr',
      ocrService: 'anthropic',
      ocrModel
    }, async (inputPath, inputMetadata, onRetryable) => {
      await assertHostedOcrWithinLimits(inputPath, inputMetadata, opts)
      const run = await runAnthropicOcr(inputPath, inputMetadata, ocrModel, {
        onRetryable,
        reasoningEffort: opts.reasoningEffort
      })
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        ocrService: 'anthropic',
        ocrModel,
        totalPages: run.totalPages,
        ...(typeof run.promptTokens === 'number' ? { promptTokens: run.promptTokens } : {}),
        ...(typeof run.completionTokens === 'number' ? { completionTokens: run.completionTokens } : {})
      }
    })
  }

  if (hasGeminiOcr(opts)) {
    await ensureGeminiOcrSetup()
    const ocrModel = opts.geminiOcrModel as string
    return await runChunkableHostedPdfOcr(filePath, step1Metadata, opts, 'Gemini OCR', {
      extractionMethod: 'gemini-ocr',
      ocrService: 'gemini',
      ocrModel
    }, async (inputPath, inputMetadata, onRetryable, pageNumber) => {
      await assertHostedOcrWithinLimits(inputPath, inputMetadata, opts)
      const run = await runGeminiOcr(inputPath, inputMetadata, ocrModel, {
        ocrPreparationCache: opts.ocrPreparationCache,
        onRetryable,
        reasoningEffort: opts.reasoningEffort,
        ...(typeof pageNumber === 'number' ? { documentPageNumber: pageNumber } : {})
      })
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        ocrService: 'gemini',
        ocrModel,
        totalPages: run.totalPages,
        ...(typeof run.promptTokens === 'number' ? { promptTokens: run.promptTokens } : {}),
        ...(typeof run.completionTokens === 'number' ? { completionTokens: run.completionTokens } : {}),
        ...(run.providerUsage && run.providerUsage.length > 0 ? { providerUsage: run.providerUsage } : {})
      }
    }, {
      createChunk: createRenderedPngPageChunk(opts.dpi, opts.ocrPreparationCache),
      chunkFormat: 'png',
      chunkExtension: 'png'
    })
  }

  if (hasDeepinfraOcr(opts)) {
    await ensureDeepinfraOcrSetup()
    const ocrModel = opts.deepinfraOcrModel as string
    return await runChunkableHostedPdfOcr(filePath, step1Metadata, opts, 'DeepInfra OCR', {
      extractionMethod: 'deepinfra-ocr',
      ocrService: 'deepinfra',
      ocrModel
    }, async (inputPath, inputMetadata, onRetryable, pageNumber) => {
      await assertHostedOcrWithinLimits(inputPath, inputMetadata, opts)
      const run = await runDeepinfraOcr(inputPath, inputMetadata, ocrModel, {
        dpi: opts.dpi,
        password: opts.password,
        outputDir: opts.outputDir,
        ocrConcurrency: opts.ocrConcurrency,
        ocrConcurrencyMode: opts.ocrConcurrencyMode,
        hostedOcrScheduler: opts.hostedOcrScheduler,
        ocrPreparationCache: opts.ocrPreparationCache,
        onRetryable,
        documentPageNumber: pageNumber,
        reasoningEffort: opts.reasoningEffort
      })
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        ocrService: 'deepinfra',
        ocrModel,
        totalPages: run.totalPages,
        ...(typeof run.promptTokens === 'number' ? { promptTokens: run.promptTokens } : {}),
        ...(typeof run.completionTokens === 'number' ? { completionTokens: run.completionTokens } : {})
      }
    }, {
      forcePageMode: true,
      createChunk: createRenderedPngPageChunk(opts.dpi, opts.ocrPreparationCache),
      chunkFormat: 'png',
      chunkExtension: 'png'
    })
  }

  throw CLIUsageError('Hosted OCR requested without a configured hosted OCR model.')
}
