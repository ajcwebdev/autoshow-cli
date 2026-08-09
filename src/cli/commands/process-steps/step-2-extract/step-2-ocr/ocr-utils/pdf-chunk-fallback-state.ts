import { mkdir, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { FallbackAuditState, HostedExtractOcrEngine, HostedOcrIdentity, HostedOcrRun, HostedOcrService, InitialFallbackReason, OcrPdfChunkRange, PdfChunkPreparationSummary, RunHostedOcrPdfChunkFallbackOptions, StoredHostedOcrFallbackPage } from '~/types'
import { ValidationError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { sanitizeLogMetadata, sanitizeLogText } from '~/utils/app-logger/redaction'
import { findOcrStructuredResponseError } from '../ocr-structured-response-error'
import {
  HOSTED_OCR_PDF_PAGE_FALLBACK_MODE,
  HOSTED_OCR_PDF_PAGE_FALLBACK_THRESHOLD,
  HOSTED_OCR_PDF_PAGE_FALLBACK_VERSION,
  isRecord
} from './pdf-chunk-fallback-shared'
import {
  getFallbackPageInputPath,
  getFallbackPageInputsDir,
  getFallbackPageInvalidResponsePath,
  getFallbackPageResultPath,
  getFallbackPageResultsDir,
  getFallbackPageTextPath,
  getFallbackPartialTextPath,
  getFallbackStatePath
} from './pdf-chunk-fallback-paths'
import { summarizeFallbackAudit } from './pdf-chunk-fallback-audit'
import { isHostedOcrRun, isPageResult } from './hosted-ocr-utils'

type HostedOcrPageCacheValidation = {
  pageNumber?: number | undefined
  totalPages?: number | undefined
  sourceFile?: string | undefined
  identity?: HostedOcrIdentity | undefined
  allowLegacySourceFile?: boolean | undefined
}

export type ParsedHostedOcrPageCache = {
  pageNumber: number
  totalPages: number
  run: HostedOcrRun
  legacyRenderedPage: boolean
}

const resolveHostedIdentityFromExtractionMethod = (
  extractionMethod: unknown
): Pick<HostedOcrIdentity, 'extractionMethod' | 'ocrService'> | undefined => {
  const identities: Partial<Record<HostedExtractOcrEngine, HostedOcrService>> = {
    'mistral-ocr': 'mistral',
    'glm-ocr': 'glm',
    'kimi-ocr': 'kimi',
    'openai-ocr': 'openai',
    'grok-ocr': 'grok',
    'anthropic-ocr': 'anthropic',
    'gemini-ocr': 'gemini',
    'deepinfra-ocr': 'deepinfra'
  }
  if (typeof extractionMethod !== 'string') {
    return undefined
  }
  const ocrService = identities[extractionMethod as HostedExtractOcrEngine]
  if (ocrService === undefined) {
    return undefined
  }
  return {
    extractionMethod: extractionMethod as HostedExtractOcrEngine,
    ocrService
  }
}

const matchesCacheIdentity = (
  run: HostedOcrRun,
  identity: HostedOcrIdentity | undefined
): boolean =>
  identity === undefined
  || (
    run.extractionMethod === identity.extractionMethod
    && run.ocrService === identity.ocrService
    && run.ocrModel === identity.ocrModel
  )

const parseLegacyRenderedPage = (
  value: Record<string, unknown>,
  validation: HostedOcrPageCacheValidation
): ParsedHostedOcrPageCache | undefined => {
  if (
    value['version'] !== 1
    || value['mode'] !== 'rendered-page'
    || typeof value['model'] !== 'string'
    || typeof value['sourceFile'] !== 'string'
    || typeof value['pageNumber'] !== 'number'
    || typeof value['totalPages'] !== 'number'
    || !isRecord(value['result'])
  ) {
    return undefined
  }

  const pageNumber = value['pageNumber']
  const totalPages = value['totalPages']
  const result = value['result']
  const page = result['page']
  if (!isPageResult(page)) {
    return undefined
  }
  const resolvedIdentity = resolveHostedIdentityFromExtractionMethod(value['extractionMethod'])
  if (
    resolvedIdentity === undefined
    || page.pageNumber !== pageNumber
    || (validation.pageNumber !== undefined && validation.pageNumber !== pageNumber)
    || (validation.totalPages !== undefined && validation.totalPages !== totalPages)
    || (validation.sourceFile !== undefined && validation.sourceFile !== value['sourceFile'])
    || (validation.identity !== undefined && (
      validation.identity.extractionMethod !== resolvedIdentity.extractionMethod
      || validation.identity.ocrService !== resolvedIdentity.ocrService
      || validation.identity.ocrModel !== value['model']
    ))
  ) {
    return undefined
  }

  const promptTokens = typeof result['promptTokens'] === 'number' ? result['promptTokens'] : undefined
  const completionTokens = typeof result['completionTokens'] === 'number' ? result['completionTokens'] : undefined
  const hasUsage = promptTokens !== undefined || completionTokens !== undefined
  const run: HostedOcrRun = {
    pages: [page],
    extractionMethod: resolvedIdentity.extractionMethod,
    ocrService: resolvedIdentity.ocrService,
    ocrModel: value['model'],
    totalPages: 1,
    ...(promptTokens !== undefined ? { promptTokens } : {}),
    ...(completionTokens !== undefined ? { completionTokens } : {}),
    ...(hasUsage
      ? {
          providerUsage: [{
            unit: 'chunk',
            pageStart: pageNumber,
            pageEnd: pageNumber,
            pages: 1,
            provider: resolvedIdentity.ocrService,
            model: value['model'],
            ...(promptTokens !== undefined ? { promptTokens } : {}),
            ...(completionTokens !== undefined ? { completionTokens } : {})
          }]
        }
      : {})
  }

  return {
    pageNumber,
    totalPages,
    run,
    legacyRenderedPage: true
  }
}

export const parseStoredHostedOcrPageCache = (
  value: unknown,
  validation: HostedOcrPageCacheValidation = {}
): ParsedHostedOcrPageCache | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const legacyRenderedPage = parseLegacyRenderedPage(value, validation)
  if (legacyRenderedPage !== undefined) {
    return legacyRenderedPage
  }

  if (
    value['version'] !== HOSTED_OCR_PDF_PAGE_FALLBACK_VERSION
    || value['mode'] !== HOSTED_OCR_PDF_PAGE_FALLBACK_MODE
    || typeof value['pageNumber'] !== 'number'
    || typeof value['totalPages'] !== 'number'
    || !isHostedOcrRun(value['run'])
  ) {
    return undefined
  }

  const pageNumber = value['pageNumber']
  const totalPages = value['totalPages']
  const run = value['run']
  const sourceFile = value['sourceFile']
  if (
    run.pages.length !== 1
    || run.pages[0]?.pageNumber !== pageNumber
    || !matchesCacheIdentity(run, validation.identity)
    || (validation.pageNumber !== undefined && validation.pageNumber !== pageNumber)
    || (validation.totalPages !== undefined && validation.totalPages !== totalPages)
    || (validation.sourceFile !== undefined && (
      typeof sourceFile === 'string'
        ? sourceFile !== validation.sourceFile
        : validation.allowLegacySourceFile !== true
    ))
  ) {
    return undefined
  }

  return {
    pageNumber,
    totalPages,
    run,
    legacyRenderedPage: false
  }
}

export const readCachedFallbackPage = async (
  fallbackDir: string | undefined,
  pageNumber: number,
  totalPages: number,
  validation: Omit<HostedOcrPageCacheValidation, 'pageNumber' | 'totalPages'> = {}
): Promise<HostedOcrRun | undefined> => {
  if (fallbackDir === undefined) {
    return undefined
  }

  try {
    const raw = await Bun.file(getFallbackPageResultPath(fallbackDir, pageNumber)).json()
    return parseStoredHostedOcrPageCache(raw, {
      ...validation,
      pageNumber,
      totalPages
    })?.run
  } catch {
    return undefined
  }
}

const hasValidFallbackPageResults = async (
  fallbackDir: string | undefined,
  totalPages: number,
  validation: Omit<HostedOcrPageCacheValidation, 'pageNumber' | 'totalPages'> = {}
): Promise<boolean> => {
  if (fallbackDir === undefined) {
    return false
  }

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    if (await readCachedFallbackPage(fallbackDir, pageNumber, totalPages, validation) !== undefined) {
      return true
    }
  }

  return false
}

export const writeFallbackState = async (
  fallbackDir: string | undefined,
  options: Pick<RunHostedOcrPdfChunkFallbackOptions, 'filePath' | 'serviceLabel' | 'cacheIdentity'>,
  totalPages: number,
  chunkPreparation?: PdfChunkPreparationSummary | undefined,
  audit?: FallbackAuditState | undefined
): Promise<void> => {
  if (fallbackDir === undefined) {
    return
  }

  await mkdir(fallbackDir, { recursive: true })
  const auditPages = audit !== undefined
    ? [...audit.pages.values()].sort((a, b) => a.pageNumber - b.pageNumber)
    : undefined
  const auditRollup = auditPages !== undefined
    ? summarizeFallbackAudit(auditPages, totalPages)
    : undefined
  const payload = sanitizeLogMetadata({
    version: HOSTED_OCR_PDF_PAGE_FALLBACK_VERSION,
    mode: HOSTED_OCR_PDF_PAGE_FALLBACK_MODE,
    totalPages,
    serviceLabel: options.serviceLabel,
    sourceFile: basename(options.filePath),
    ...(options.cacheIdentity !== undefined
      ? {
          extractionMethod: options.cacheIdentity.extractionMethod,
          ocrService: options.cacheIdentity.ocrService,
          ocrModel: options.cacheIdentity.ocrModel
        }
      : {}),
    ...(audit !== undefined
      ? {
          initialFallbackReason: audit.initialFallbackReason,
          ...(audit.initialFailure ? { initialFailure: audit.initialFailure } : {}),
          pageRange: audit.pageRange,
          ...(auditRollup ? { pageStatusCounts: auditRollup.pageStatusCounts } : {}),
          ...(auditRollup ? { terminalReason: auditRollup.terminalReason } : {}),
          pages: auditPages ?? []
        }
      : {}),
    ...(chunkPreparation !== undefined ? { chunkPreparation } : {})
  })
  await Bun.write(getFallbackStatePath(fallbackDir), JSON.stringify(payload, null, 2) + '\n')
}

export const cleanupFallbackPageInputs = async (
  fallbackDir: string | undefined,
  serviceLabel: string
): Promise<void> => {
  if (fallbackDir === undefined) {
    return
  }

  try {
    await rm(getFallbackPageInputsDir(fallbackDir), { recursive: true, force: true })
  } catch (error) {
    l.warn(`${serviceLabel}: failed to delete OCR fallback page inputs: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export const writeCachedFallbackPage = async (
  fallbackDir: string | undefined,
  pageNumber: number,
  totalPages: number,
  sourceFile: string,
  run: HostedOcrRun
): Promise<void> => {
  if (fallbackDir === undefined) {
    return
  }

  await mkdir(getFallbackPageResultsDir(fallbackDir), { recursive: true })
  await writeFallbackPageText(fallbackDir, pageNumber, run)
  const payload: StoredHostedOcrFallbackPage = {
    version: HOSTED_OCR_PDF_PAGE_FALLBACK_VERSION,
    mode: HOSTED_OCR_PDF_PAGE_FALLBACK_MODE,
    totalPages,
    pageNumber,
    sourceFile,
    run
  }
  await Bun.write(getFallbackPageResultPath(fallbackDir, pageNumber), JSON.stringify(payload, null, 2) + '\n')
}

export const writeFallbackPageText = async (
  fallbackDir: string | undefined,
  pageNumber: number,
  run: HostedOcrRun
): Promise<void> => {
  if (fallbackDir === undefined) {
    return
  }

  const pageText = run.pages.find((page) => page.pageNumber === pageNumber)?.text ?? ''
  await mkdir(getFallbackPageResultsDir(fallbackDir), { recursive: true })
  await Bun.write(getFallbackPageTextPath(fallbackDir, pageNumber), pageText.endsWith('\n') ? pageText : `${pageText}\n`)
}

export const writeInvalidFallbackPageResponse = async (
  fallbackDir: string | undefined,
  pageNumber: number,
  error: unknown
): Promise<void> => {
  if (fallbackDir === undefined) {
    return
  }

  const structuredError = findOcrStructuredResponseError(error)
  if (!structuredError) {
    return
  }

  await mkdir(getFallbackPageResultsDir(fallbackDir), { recursive: true })
  await Bun.write(getFallbackPageInvalidResponsePath(fallbackDir, pageNumber), sanitizeLogText(structuredError.rawResponse))
}

export const writeFallbackPartialText = async (
  fallbackDir: string | undefined,
  runs: HostedOcrRun[]
): Promise<void> => {
  if (fallbackDir === undefined) {
    return
  }

  const text = runs
    .flatMap((run) => run.pages)
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((page) => `Page ${page.pageNumber}\n${page.text.trim()}`)
    .join('\n\n')
    .trim()

  await Bun.write(getFallbackPartialTextPath(fallbackDir), text.length > 0 ? `${text}\n` : '')
}

export const resolveFallbackChunkPath = async (
  fallbackDir: string | undefined,
  tempDir: string,
  sourceFilePath: string,
  pageNumber: number,
  extension: string
): Promise<{ chunkPath: string, persistent: boolean }> => {
  if (fallbackDir !== undefined) {
    await mkdir(getFallbackPageInputsDir(fallbackDir), { recursive: true })
    return {
      chunkPath: getFallbackPageInputPath(fallbackDir, pageNumber, extension),
      persistent: true
    }
  }

  return {
    chunkPath: join(tempDir, `${basename(sourceFilePath, '.pdf')}-${pageNumber}.${extension}`),
    persistent: false
  }
}

export const validateSinglePageFallbackRun = (
  run: HostedOcrRun,
  pageNumber: number,
  serviceLabel: string
): HostedOcrRun => {
  if (run.pages.length !== 1 || run.pages[0]?.pageNumber !== pageNumber) {
    throw ValidationError(`${serviceLabel}: OCR fallback page ${pageNumber} returned ${run.pages.length} pages.`, { stage: 'ocr:pdf-chunk-fallback' })
  }
  return run
}

export const buildMalformedFallbackPageRun = (
  options: RunHostedOcrPdfChunkFallbackOptions,
  error: unknown,
  range: OcrPdfChunkRange
): HostedOcrRun | undefined => {
  const structuredError = findOcrStructuredResponseError(error)
  if (
    structuredError === undefined
    || (structuredError as { category?: string }).category === 'provider_limit'
    || options.buildMalformedPageRun === undefined
  ) {
    return undefined
  }

  return validateSinglePageFallbackRun(
    options.buildMalformedPageRun(structuredError.rawResponse, range),
    range.startPage,
    options.serviceLabel
  )
}

export const hasMatchingFallbackState = async (
  fallbackDir: string | undefined,
  sourceFile: string,
  identity?: HostedOcrIdentity | undefined
): Promise<boolean> => {
  if (fallbackDir === undefined) {
    return false
  }

  try {
    const value = await Bun.file(getFallbackStatePath(fallbackDir)).json()
    if (
      !isRecord(value)
      || value['version'] !== HOSTED_OCR_PDF_PAGE_FALLBACK_VERSION
      || value['mode'] !== HOSTED_OCR_PDF_PAGE_FALLBACK_MODE
      || (value['sourceFile'] !== sourceFile && value['sourceFile'] !== sanitizeLogText(sourceFile))
    ) {
      return false
    }
    if (identity === undefined) {
      return true
    }
    return (value['extractionMethod'] === undefined || value['extractionMethod'] === identity.extractionMethod)
      && (value['ocrService'] === undefined || value['ocrService'] === identity.ocrService)
      && (value['ocrModel'] === undefined || value['ocrModel'] === identity.ocrModel)
  } catch {
    return false
  }
}

export const resolveInitialFallbackReason = async (
  options: RunHostedOcrPdfChunkFallbackOptions,
  totalPages: number
): Promise<InitialFallbackReason | undefined> => {
  if (options.forcePageMode === true) {
    return 'forced-page-mode'
  }
  if (totalPages > HOSTED_OCR_PDF_PAGE_FALLBACK_THRESHOLD) {
    return 'large-pdf'
  }
  const expectedSourceFile = basename(options.filePath)
  const matchingState = await hasMatchingFallbackState(options.fallbackDir, expectedSourceFile, options.cacheIdentity)
  if (matchingState) {
    return 'fallback-state'
  }
  if (await hasValidFallbackPageResults(options.fallbackDir, totalPages, {
    sourceFile: expectedSourceFile,
    identity: options.cacheIdentity,
    allowLegacySourceFile: options.cacheIdentity === undefined || matchingState
  })) {
    return 'page-cache'
  }
  return undefined
}
