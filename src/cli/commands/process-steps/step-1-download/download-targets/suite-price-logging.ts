import { createSingleRowTable } from '~/utils/app-logger/human-table/human-table'
import { formatEstimatedCost } from '~/utils/app-logger/formatters'
import { defineTableLog } from '~/utils/app-logger/table-log-definition'
import type { SuitePriceSummary } from '~/types'

export const buildSuitePriceSummaryRows = (
  summary: SuitePriceSummary
): Array<{ checked: string, totalEstimatedCost: string }> => [{
  checked: `${summary.checkedCount} ${summary.checkedLabel}`,
  totalEstimatedCost: formatEstimatedCost(summary.totalEstimatedCost)
}]

export const { log: logSuitePriceSummary } = defineTableLog<SuitePriceSummary>({
  title: 'Suite Cost Summary',
  category: 'pricing',
  buildTable: summary => createSingleRowTable(buildSuitePriceSummaryRows(summary)[0]!, ['checked', 'totalEstimatedCost']),
  level: 'info',
  metadata: summary => summary
})
