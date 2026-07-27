import { formatTableCell } from './human-table-cells'
import type { HumanLogTableCell, HumanLogTableRow } from '~/types'

export const detailLabelFromCell = (value: HumanLogTableCell | undefined): string | undefined => {
  const label = formatTableCell(value).trim()
  return label.length > 0 ? label : undefined
}

const getKeyValueDetailLabel = (
  row: HumanLogTableRow,
  columns: readonly string[],
  column: string
): string | undefined => {
  if (columns.length !== 2 || column !== columns[1]) {
    return undefined
  }

  return detailLabelFromCell(row[columns[0] as string])
}

const getProviderDetailPrefix = (row: HumanLogTableRow): string | undefined => {
  const provider = detailLabelFromCell(row['provider'])
  if (!provider) {
    return undefined
  }

  const model = detailLabelFromCell(row['model'])
  return model ? `${provider}/${model}` : provider
}

export const buildCellDetailLabel = (
  row: HumanLogTableRow,
  columns: readonly string[],
  column: string
): string => {
  const keyValueLabel = getKeyValueDetailLabel(row, columns, column)
  const label = keyValueLabel ?? column
  const providerPrefix = getProviderDetailPrefix(row)
  return providerPrefix && !label.includes(providerPrefix)
    ? `${providerPrefix} ${label}`
    : label
}

export const getEffectiveVerboseColumnName = (
  row: HumanLogTableRow,
  columns: readonly string[],
  column: string
): string => getKeyValueDetailLabel(row, columns, column) ?? column
