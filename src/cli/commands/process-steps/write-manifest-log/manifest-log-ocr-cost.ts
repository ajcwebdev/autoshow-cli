import type { OcrCostCalculationRow, OcrCostCalculationSection, WriteManifestMetadata } from '~/types'
import { createHumanTable } from '~/utils/app-logger/human-table/human-table'
import { formatCost } from '~/utils/app-logger/formatters'
import {
  buildProviderModelLabel,
  formatInputSummary,
  formatNumber,
  formatRatesSummary,
  getNumber,
  getRecord
} from './manifest-log-formatting'
import { isRecord } from './manifest-log-metadata'
import { OCR_COST_COLUMNS } from './write-manifest-log-columns'

const getOcrDiagnostics = (metadata: WriteManifestMetadata): Record<string, unknown>[] => {
  const cost = metadata['cost']
  if (!isRecord(cost) || !Array.isArray(cost['ocrDiagnostics'])) {
    return []
  }
  return cost['ocrDiagnostics'].filter(isRecord)
}

const getSchemaRetryPages = (record: Record<string, unknown>): number[] => {
  const pages = Array.isArray(record['pages']) ? record['pages'] : []
  return [...new Set(pages
    .filter((page): page is number => typeof page === 'number' && Number.isFinite(page))
    .map((page) => Math.max(1, Math.floor(page))))]
    .sort((a, b) => a - b)
}

const formatSchemaRetryPages = (pages: number[]): string | null => {
  if (pages.length === 0) {
    return null
  }
  const displayed = pages.slice(0, 5).map((page) => `p${page}`).join(',')
  return pages.length > 5
    ? `${displayed},+${pages.length - 5}`
    : displayed
}

const formatSchemaRetrySuffix = (
  actualCostInputs: Record<string, unknown> | undefined
): string | null => {
  if (!actualCostInputs) {
    return null
  }

  const schemaRetryUsage = getRecord(actualCostInputs, 'schemaRetryUsage')
  if (!schemaRetryUsage) {
    return null
  }

  const pages = formatSchemaRetryPages(getSchemaRetryPages(schemaRetryUsage))
  const count = getNumber(schemaRetryUsage, 'count')
  const completionTokens = getNumber(schemaRetryUsage, 'completionTokens')
  const target = pages ?? (count !== undefined ? `${formatNumber(count)}x` : '')
  const tokenSummary = completionTokens !== undefined ? ` +${formatNumber(completionTokens)} out` : ''
  return `retries${target.length > 0 ? ` ${target}` : ''}${tokenSummary}`
}

const formatActualInputSummary = (
  actualCostInputs: Record<string, unknown> | undefined
): string | null => {
  const base = formatInputSummary(actualCostInputs)
  const suffix = formatSchemaRetrySuffix(actualCostInputs)
  const partialSuffix = actualCostInputs?.['status'] === 'failed_partial'
    ? 'partial failed'
    : null
  const suffixes = [suffix, partialSuffix].filter((value): value is string => typeof value === 'string' && value.length > 0)
  if (suffixes.length === 0) {
    return base
  }
  return base ? `${base}; ${suffixes.join('; ')}` : suffixes.join('; ')
}

export const buildOcrCostCalculation = (metadata: WriteManifestMetadata): OcrCostCalculationSection | undefined => {
  const diagnostics = getOcrDiagnostics(metadata)
  if (diagnostics.length === 0) {
    return undefined
  }

  const rows: OcrCostCalculationRow[] = diagnostics.map((entry) => {
    const provider = typeof entry['provider'] === 'string' ? entry['provider'] : 'ocr'
    const model = typeof entry['model'] === 'string' ? entry['model'] : 'unknown'
    const predictedCostInputs = getRecord(entry, 'predictedCostInputs')
    const actualCostInputs = getRecord(entry, 'actualCostInputs')
    const delta = getRecord(entry, 'delta')
    const partial = entry['status'] === 'failed_partial'
    const completedPages = getNumber(entry, 'completedPages')
    const totalPages = getNumber(entry, 'pages')

    return {
      providerModel: partial
        ? `${buildProviderModelLabel(provider, model)} (failed partial)`
        : buildProviderModelLabel(provider, model),
      pages: partial && typeof completedPages === 'number' && typeof totalPages === 'number'
        ? `${formatNumber(completedPages)}/${formatNumber(totalPages)}`
        : totalPages ?? null,
      predictedInputs: formatInputSummary(predictedCostInputs),
      actualInputs: formatActualInputSummary(actualCostInputs),
      rates: formatRatesSummary(getRecord(entry, 'ratesUsed')),
      predictedCostCents: getNumber(predictedCostInputs ?? {}, 'costCents') ?? null,
      actualCostCents: getNumber(actualCostInputs ?? {}, 'costCents') ?? null,
      deltaCents: getNumber(delta ?? {}, 'costCents') ?? null
    }
  })

  return {
    columns: OCR_COST_COLUMNS,
    rows,
    humanTable: createHumanTable(rows.map((row) => ({
      providerModel: row.providerModel,
      pages: row.pages === null
        ? ''
        : typeof row.pages === 'number'
          ? formatNumber(row.pages)
          : row.pages,
      predInputs: row.predictedInputs ?? '',
      actInputs: row.actualInputs ?? '',
      rates: row.rates ?? '',
      predCost: row.predictedCostCents === null ? '' : formatCost(row.predictedCostCents),
      actCost: row.actualCostCents === null ? '' : formatCost(row.actualCostCents),
      delta: row.deltaCents === null ? '' : formatCost(row.deltaCents)
    })), OCR_COST_COLUMNS)
  }
}
