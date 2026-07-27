import type {
  FallbackAuditRollup,
  FallbackAuditState,
  FallbackPageAudit,
  FallbackPageAuditStatus,
  FallbackPageStatusCounts,
  PdfChunkPreparationSummary
} from '~/types'
import { sanitizeLogText } from '~/utils/app-logger/redaction'
import { classifyOcrProviderFailure } from '../ocr-run-state'
import { isRecord } from './pdf-chunk-fallback-shared'
import { getFallbackStatePath } from './pdf-chunk-fallback-paths'

const createFallbackPageStatusCounts = (
  pages: FallbackPageAudit[]
): FallbackPageStatusCounts => {
  const counts: FallbackPageStatusCounts = {
    cached: 0,
    resumed: 0,
    succeeded: 0,
    failed: 0,
    canceled: 0
  }

  for (const page of pages) {
    counts[page.status] += 1
  }

  return counts
}

const summarizeFallbackTerminalReason = (
  pages: FallbackPageAudit[],
  totalPages: number
): string => {
  const failedPage = pages.find((page) => page.status === 'failed')
  if (failedPage?.failure) {
    return failedPage.failure.blockedReason
      ?? failedPage.failure.failureKind
      ?? failedPage.failure.category
  }

  const canceledPage = pages.find((page) => page.status === 'canceled')
  if (canceledPage?.failure) {
    return canceledPage.failure.blockedReason
      ?? canceledPage.failure.failureKind
      ?? canceledPage.failure.category
  }

  const terminalSuccessCount = pages.filter((page) =>
    page.status === 'cached' || page.status === 'succeeded'
  ).length
  if (terminalSuccessCount >= totalPages) {
    return 'completed'
  }

  return pages.length === 0 ? 'not-started' : 'in-progress'
}

export const summarizeFallbackAudit = (
  pages: FallbackPageAudit[],
  totalPages: number
): { pageStatusCounts: FallbackPageStatusCounts, terminalReason: string } => ({
  pageStatusCounts: createFallbackPageStatusCounts(pages),
  terminalReason: summarizeFallbackTerminalReason(pages, totalPages)
})

export const isPdfChunkPreparationSummary = (value: unknown): value is PdfChunkPreparationSummary =>
  isRecord(value)
  && typeof value['strategy'] === 'string'
  && typeof value['directPageAttempts'] === 'number'
  && typeof value['directSuccesses'] === 'number'
  && typeof value['directFailures'] === 'number'
  && typeof value['rasterizedPages'] === 'number'
  && typeof value['directSplittingDisabled'] === 'boolean'
  && Array.isArray(value['tools'])

export const readFallbackChunkPreparation = async (
  fallbackDir: string | undefined
): Promise<PdfChunkPreparationSummary | undefined> => {
  if (fallbackDir === undefined) {
    return undefined
  }

  try {
    const state = await Bun.file(getFallbackStatePath(fallbackDir)).json()
    const chunkPreparation = isRecord(state) ? state['chunkPreparation'] : undefined
    return isPdfChunkPreparationSummary(chunkPreparation) ? chunkPreparation : undefined
  } catch {
    return undefined
  }
}

const isFallbackPageStatusCounts = (value: unknown): value is FallbackPageStatusCounts =>
  isRecord(value)
  && typeof value['cached'] === 'number'
  && typeof value['resumed'] === 'number'
  && typeof value['succeeded'] === 'number'
  && typeof value['failed'] === 'number'
  && typeof value['canceled'] === 'number'

export const readFallbackAuditRollup = async (
  fallbackDir: string | undefined
): Promise<FallbackAuditRollup | undefined> => {
  if (fallbackDir === undefined) {
    return undefined
  }

  try {
    const state = await Bun.file(getFallbackStatePath(fallbackDir)).json()
    if (!isRecord(state)) {
      return undefined
    }
    const pageStatusCounts = state['pageStatusCounts']
    const terminalReason = state['terminalReason']
    const chunkPreparation = isPdfChunkPreparationSummary(state['chunkPreparation'])
      ? state['chunkPreparation']
      : undefined
    const rollup: FallbackAuditRollup = {
      ...(isFallbackPageStatusCounts(pageStatusCounts) ? { pageStatusCounts } : {}),
      ...(typeof terminalReason === 'string' ? { terminalReason } : {}),
      ...(chunkPreparation ? { chunkStrategy: chunkPreparation.strategy, rasterizedPages: chunkPreparation.rasterizedPages } : {})
    }
    return Object.keys(rollup).length > 0 ? rollup : undefined
  } catch {
    return undefined
  }
}

export const hasObservedChunkPreparation = (
  summary: PdfChunkPreparationSummary | undefined
): summary is PdfChunkPreparationSummary =>
  summary !== undefined
  && (
    summary.directPageAttempts > 0
    || summary.directSuccesses > 0
    || summary.directFailures > 0
    || summary.rasterizedPages > 0
    || summary.tools.length > 0
    || (summary.disabledTools?.length ?? 0) > 0
  )

const summarizeSplitToolFailures = (
  summary: PdfChunkPreparationSummary | undefined
): FallbackPageAudit['splitToolFailures'] => {
  if (summary === undefined) {
    return undefined
  }
  const failures = summary.tools
    .map((tool) => ({
      tool: tool.tool,
      exitCodes: Object.fromEntries(
        Object.entries(tool.exitCodes).filter(([code, count]) => code !== '0' && count > 0)
      ),
      ...(tool.path ? { path: tool.path } : {}),
      ...(tool.source ? { source: tool.source } : {}),
      ...(tool.failureKind ? { failureKind: tool.failureKind } : {}),
      ...(tool.message ? { message: tool.message } : {})
    }))
    .filter((tool) => Object.keys(tool.exitCodes).length > 0)

  return failures.length > 0 ? failures : undefined
}

export const formatDirectSplittingDisabledWarning = (
  serviceLabel: string,
  summary: PdfChunkPreparationSummary
): string => {
  const lastFailure = summary.lastDirectFailure
  if (lastFailure?.failureKind === 'qpdf_launch_failure') {
    return `${serviceLabel}: direct PDF page splitting failed because qpdf could not launch (${lastFailure.message}); using rasterized page PDFs for remaining OCR fallback pages`
  }
  if (lastFailure?.failureKind === 'mutool_unsupported_document') {
    return `${serviceLabel}: direct PDF page splitting failed because mutool cannot preserve this PDF page content (${lastFailure.message}); using rasterized page PDFs for remaining OCR fallback pages`
  }
  return `${serviceLabel}: direct PDF page splitting failed twice; using rasterized page PDFs for remaining OCR fallback pages`
}

export const summarizeFallbackFailure = (error: unknown): NonNullable<FallbackPageAudit['failure']> => {
  const failure = classifyOcrProviderFailure(error)
  return {
    message: sanitizeLogText(failure.message),
    category: failure.category,
    failureKind: failure.failureKind,
    retryable: failure.retryable,
    ...(failure.blockedReason ? { blockedReason: failure.blockedReason } : {}),
    ...(typeof failure.status === 'number' ? { status: failure.status } : {})
  }
}

export const isProviderWideNonRetryableOcrFailure = (error: unknown): boolean => {
  const failure = classifyOcrProviderFailure(error)
  return failure.retryable === false && failure.providerWide === true
}

export const setFallbackPageAudit = (
  audit: FallbackAuditState,
  pageNumber: number,
  status: FallbackPageAuditStatus,
  options: {
    failure?: FallbackPageAudit['failure'] | undefined
    chunkPreparation?: PdfChunkPreparationSummary | undefined
  } = {}
): void => {
  const range = { startPage: pageNumber, endPage: pageNumber }
  const chunkPreparation = options.chunkPreparation
  audit.pages.set(pageNumber, {
    pageNumber,
    range,
    status,
    ...(chunkPreparation?.strategy ? { chunkPreparationMode: chunkPreparation.strategy } : {}),
    ...(summarizeSplitToolFailures(chunkPreparation) ? { splitToolFailures: summarizeSplitToolFailures(chunkPreparation) } : {}),
    ...(options.failure ? { failure: options.failure } : {})
  })
}
