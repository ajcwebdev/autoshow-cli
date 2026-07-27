import { formatTableCell } from './human-table-cells'
import { detailLabelFromCell } from './human-table-detail-labels'
import type { HumanLogTable, HumanLogTableCell, HumanLogTableRow } from '~/types'

const collectTableColumns = (rows: readonly HumanLogTableRow[]): string[] => {
  const columns = new Set<string>()

  for (const row of rows) {
    for (const column of Object.keys(row)) {
      columns.add(column)
    }
  }

  return [...columns]
}

export const resolveTableColumns = (table: HumanLogTable): string[] =>
  table.columns && table.columns.length > 0
    ? [...table.columns]
    : collectTableColumns(table.rows)

export const getSemanticColumnName = (
  row: HumanLogTableRow,
  columns: readonly string[],
  column: string
): string => {
  if (columns.length === 2 && column === columns[1]) {
    const keyValueLabel = detailLabelFromCell(row[columns[0] as string])
    return keyValueLabel ?? column
  }

  return column
}

export const isKeyLabelColumn = (
  columns: readonly string[],
  column: string
): boolean =>
  columns.length === 2
  && column === columns[0]
  && (
    columns[1] === 'value'
    || columns[1] === 'path'
  )

export const shouldRenderHeader = (columns: readonly string[]): boolean =>
  !(
    columns.length === 2
    && (
      (columns[0] === 'key' && columns[1] === 'value')
      || (columns[0] === 'artifact' && columns[1] === 'path')
    )
  )

export const nonEmptyTableCell = (value: HumanLogTableCell | undefined): boolean =>
  value !== undefined && formatTableCell(value).length > 0
