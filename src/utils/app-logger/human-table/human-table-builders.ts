import { toHumanTableCell } from './human-table-cells'
import { extractVerboseCellDetails, extractWidePathDetails } from './human-table-detail-lifting'
import type { BatchItemTableRow, HumanLogTable, HumanLogTableRow, LocationTableRow } from '~/types'

export const createHumanTable = (
  rows: readonly HumanLogTableRow[],
  columns?: readonly string[],
  options: Pick<HumanLogTable, 'align' | 'labels'> = {}
): HumanLogTable =>
  extractWidePathDetails(
    extractVerboseCellDetails({
      rows,
      ...(columns ? { columns } : {}),
      ...(options.align ? { align: options.align } : {}),
      ...(options.labels ? { labels: options.labels } : {})
    })
  )

export const createDetailTable = (
  entries: ReadonlyArray<readonly [string, unknown]>,
  options: Pick<HumanLogTable, 'labels'> = {}
): HumanLogTable => ({
  rows: [],
  details: entries.map(([label, value]) => ({
    label,
    value: toHumanTableCell(value)
  })),
  ...(options.labels ? { labels: options.labels } : {})
})

export const createKeyValueTable = (
  entries: ReadonlyArray<readonly [string, unknown]>,
  keyLabel = 'key',
  valueLabel = 'value'
): HumanLogTable =>
  createHumanTable(
    entries.map(([key, value]) => ({
      [keyLabel]: key,
      [valueLabel]: toHumanTableCell(value)
    })),
    [keyLabel, valueLabel]
  )

export const createSingleRowTable = (
  row: Readonly<Record<string, unknown>>,
  columns?: readonly string[]
): HumanLogTable =>
  createHumanTable([
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, toHumanTableCell(value)])
    ) as HumanLogTableRow
  ], columns)

const appendDetailColumnIfNeeded = (
  rows: readonly HumanLogTableRow[],
  baseColumns: readonly string[]
): readonly string[] =>
  rows.some((row) => row['detail'] !== undefined)
    ? [...baseColumns, 'detail']
    : baseColumns

export const createLocationsTable = (
  rows: readonly LocationTableRow[]
): HumanLogTable => {
  const normalizedRows = rows.map((row) => {
    const detail = toHumanTableCell(row.detail)
    return {
      artifact: toHumanTableCell(row.artifact),
      path: toHumanTableCell(row.path),
      ...(detail !== '' ? { detail } : {})
    }
  })

  return createHumanTable(
    normalizedRows,
    appendDetailColumnIfNeeded(normalizedRows, ['artifact', 'path'])
  )
}

export const createBatchItemTable = (
  rows: readonly BatchItemTableRow[]
): HumanLogTable => {
  const normalizedRows = rows.map((row) => {
    const detail = toHumanTableCell(row.detail)
    return {
      status: toHumanTableCell(row.status),
      input: toHumanTableCell(row.input),
      ...(detail !== '' ? { detail } : {})
    }
  })

  return createHumanTable(
    normalizedRows,
    appendDetailColumnIfNeeded(normalizedRows, ['status', 'input'])
  )
}
