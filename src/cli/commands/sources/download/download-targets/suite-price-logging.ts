import { formatEstimatedCost } from '~/utils/app-logger/formatters'
import type { SuitePriceSummary } from '~/types'
import * as l from '~/utils/app-logger/app-logger'

export const buildSuitePriceSummaryRows = (
  summary: SuitePriceSummary
): Array<{ checked: string, totalEstimatedCost: string }> => [{
  checked: `${summary.checkedCount} ${summary.checkedLabel}`,
  totalEstimatedCost: formatEstimatedCost(summary.totalEstimatedCost)
}]

export const logSuitePriceSummary = (summary: SuitePriceSummary): void => {
  l.write('info', `Suite estimate: ${summary.checkedCount} ${summary.checkedLabel}, ${formatEstimatedCost(summary.totalEstimatedCost)}`, {
    category: 'pricing',
    metadata: summary
  })
}
