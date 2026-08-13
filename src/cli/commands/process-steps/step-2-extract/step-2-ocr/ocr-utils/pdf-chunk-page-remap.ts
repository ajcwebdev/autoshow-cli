import type { HostedOcrRun, OcrPdfChunkRange, PageResult, PdfChunkPreparationSummary } from '~/types'
import { InternalError } from '~/utils/error-handler'
import { getOcrPdfChunkRangePageCount } from './pdf-chunk-fallback-shared'

export const remapOcrPagesToRange = (
  pages: PageResult[],
  range: OcrPdfChunkRange
): PageResult[] =>
  pages
    .slice()
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((page, index) => ({
      ...page,
      pageNumber: range.startPage + index
    }))

const remapLocalUsagePageNumberToRange = (
  value: unknown,
  range: OcrPdfChunkRange
): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }

  const localPageNumber = Math.floor(value)
  const pageCount = getOcrPdfChunkRangePageCount(range)
  if (localPageNumber < 1 || localPageNumber > pageCount) {
    return undefined
  }

  return range.startPage + localPageNumber - 1
}

export const remapOcrProviderUsageToRange = (
  providerUsage: HostedOcrRun['providerUsage'],
  range: OcrPdfChunkRange
): HostedOcrRun['providerUsage'] | undefined => {
  if (providerUsage === undefined || providerUsage.length === 0) {
    return undefined
  }

  return providerUsage.map((entry) => {
    const pageNumber = remapLocalUsagePageNumberToRange(entry['pageNumber'], range)
    const page = remapLocalUsagePageNumberToRange(entry['page'], range)
    const pageStart = remapLocalUsagePageNumberToRange(entry['pageStart'], range)
    const startPage = remapLocalUsagePageNumberToRange(entry['startPage'], range)
    const pageEnd = remapLocalUsagePageNumberToRange(entry['pageEnd'], range)
    const endPage = remapLocalUsagePageNumberToRange(entry['endPage'], range)

    return {
      ...entry,
      ...(pageNumber !== undefined ? { pageNumber } : {}),
      ...(page !== undefined ? { page } : {}),
      ...(pageStart !== undefined ? { pageStart } : {}),
      ...(startPage !== undefined ? { startPage } : {}),
      ...(pageEnd !== undefined ? { pageEnd } : {}),
      ...(endPage !== undefined ? { endPage } : {})
    }
  })
}

export const stitchHostedOcrChunkRuns = (
  runs: HostedOcrRun[],
  totalPages: number,
  pdfChunkPreparation?: PdfChunkPreparationSummary | undefined
): HostedOcrRun => {
  const firstRun = runs[0]
  if (!firstRun) {
    throw InternalError('OCR PDF chunk fallback produced no chunk results.', { stage: 'ocr:pdf-chunk-fallback' })
  }

  const pages = runs
    .flatMap((run) => run.pages)
    .sort((a, b) => a.pageNumber - b.pageNumber)
  const canonicalTextChunks = runs
    .map((run) => run.canonicalText?.trim() ?? '')
  const canonicalText = canonicalTextChunks.every((text) => text.length > 0)
    ? canonicalTextChunks.join('\n\n')
    : ''
  const promptTokens = runs.reduce((sum, run) => sum + (run.promptTokens ?? 0), 0)
  const completionTokens = runs.reduce((sum, run) => sum + (run.completionTokens ?? 0), 0)
  const providerCostCents = runs.reduce((sum, run) => sum + (run.providerCostCents ?? 0), 0)
  const hasPromptTokens = runs.some((run) => typeof run.promptTokens === 'number')
  const hasCompletionTokens = runs.some((run) => typeof run.completionTokens === 'number')
  const hasProviderCost = runs.some((run) => typeof run.providerCostCents === 'number')
  const providerCostSources = runs
    .map((run) => run.providerCostSource)
    .filter((source): source is NonNullable<HostedOcrRun['providerCostSource']> => source !== undefined)
  const providerUsage = runs.flatMap((run) => run.providerUsage ?? [])

  return {
    pages,
    extractionMethod: firstRun.extractionMethod,
    ocrService: firstRun.ocrService,
    ocrModel: firstRun.ocrModel,
    ...(firstRun.requestedReasoningEffort !== undefined ? { requestedReasoningEffort: firstRun.requestedReasoningEffort } : {}),
    ...(firstRun.effectiveReasoningEffort !== undefined ? { effectiveReasoningEffort: firstRun.effectiveReasoningEffort } : {}),
    totalPages,
    ...(canonicalText.length > 0 ? { canonicalText } : {}),
    ...(hasPromptTokens ? { promptTokens } : {}),
    ...(hasCompletionTokens ? { completionTokens } : {}),
    ...(hasProviderCost ? { providerCostCents } : {}),
    ...(providerCostSources.length > 0
      ? { providerCostSource: providerCostSources.includes('registry_fallback') ? 'registry_fallback' as const : 'provider_quote' as const }
      : {}),
    ...(providerUsage.length > 0 ? { providerUsage } : {}),
    ...(pdfChunkPreparation !== undefined ? { pdfChunkPreparation } : {})
  }
}
