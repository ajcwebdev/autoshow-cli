import { stripAnsi } from '~/utils/terminal-colors'
import { formatTableCell } from './human-table-cells'
import { nonEmptyTableCell, resolveTableColumns } from './human-table-columns'
import { buildCellDetailLabel, detailLabelFromCell, getEffectiveVerboseColumnName } from './human-table-detail-labels'
import { isAlwaysLiftVerboseColumnName, isConditionallyLiftVerboseColumnName, isPathLikeColumnName, normalizeColumnName } from './human-table-labels'
import { getTerminalDisplayWidth } from './human-table-width'
import type { HumanLogTable, HumanLogTableCell, HumanLogTableDetail, HumanLogTableRow, WidePathDetailContext } from '~/types'

const widePathDetailVisibleLength = 56

const isUrlLikeValue = (value: string): boolean =>
  /^[a-z][a-z0-9+.-]*:\/\//i.test(value.trim())

const hasFilesystemPathMarker = (value: string): boolean => {
  const trimmed = value.trim()
  return /^(?:\.{1,2}[\\/]|~[\\/]|[\\/]|[A-Za-z]:[\\/])/.test(trimmed)
    || trimmed.includes('\\')
    || trimmed.split('/').length > 2
    || /^(?:build|cache|dist|docs|input|output|private|runtime|src|test|tmp|users|var)\//i.test(trimmed)
    || /[\\/][^\\/]+\.[A-Za-z0-9]{1,12}(?:$|[?#])/.test(trimmed)
}

const isProviderOrModelId = (value: string): boolean => {
  const trimmed = value.trim()
  if (hasFilesystemPathMarker(trimmed)) {
    return false
  }

  const slashCount = trimmed.split('/').length - 1
  return slashCount === 1
    && /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._:@+-]*$/.test(trimmed)
}

const isLiftableWidePathValue = (value: HumanLogTableCell): boolean => {
  const visibleValue = stripAnsi(formatTableCell(value))
  return getTerminalDisplayWidth(visibleValue) > widePathDetailVisibleLength
    && /[\\/]/.test(visibleValue)
    && !isUrlLikeValue(visibleValue)
    && !isProviderOrModelId(visibleValue)
}

const VERBOSE_DETAIL_VISIBLE_LENGTH = 96
const lineBreakPattern = /\r|\n/
const stackLikePattern = /(?:^|\n)\s*at\s+\S+|Traceback \(most recent call last\)|\b(?:Error|Exception):\s|\bstack trace\b/i
const rawStreamLikePattern = /\b(?:stderr|stdout)\b\s*[:=]|\bexit code\b|\bexited with code\b/i

const isVerboseDetailValue = (
  value: HumanLogTableCell
): boolean => {
  const visibleValue = stripAnsi(formatTableCell(value))
  return lineBreakPattern.test(visibleValue)
    || getTerminalDisplayWidth(visibleValue) > VERBOSE_DETAIL_VISIBLE_LENGTH
    || stackLikePattern.test(visibleValue)
    || rawStreamLikePattern.test(visibleValue)
}

const shouldLiftVerboseCell = (
  row: HumanLogTableRow,
  columns: readonly string[],
  column: string,
  value: HumanLogTableCell | undefined
): value is HumanLogTableCell => {
  if (value === undefined) {
    return false
  }

  const visibleValue = stripAnsi(formatTableCell(value)).trim()
  if (visibleValue.length === 0) {
    return false
  }

  const effectiveColumn = getEffectiveVerboseColumnName(row, columns, column)
  if (isAlwaysLiftVerboseColumnName(effectiveColumn)) {
    return typeof value === 'string'
  }

  if (lineBreakPattern.test(visibleValue)) {
    return true
  }

  return isConditionallyLiftVerboseColumnName(effectiveColumn)
    && isVerboseDetailValue(value)
}

const getLiftedCellSummary = (
  row: HumanLogTableRow,
  columns: readonly string[],
  column: string
): string => {
  const effectiveColumn = getEffectiveVerboseColumnName(row, columns, column)
  if (normalizeColumnName(effectiveColumn) === 'stack') {
    return 'see stack'
  }
  return 'see details'
}

export const extractVerboseCellDetails = (table: HumanLogTable): HumanLogTable => {
  const columns = resolveTableColumns(table)
  const rows = table.rows.map(row => ({ ...row }))
  const details: HumanLogTableDetail[] = table.details ? [...table.details] : []
  let lifted = false

  for (const row of rows) {
    for (const column of columns) {
      const value = row[column]
      if (!shouldLiftVerboseCell(row, columns, column, value)) {
        continue
      }

      details.push({
        label: buildCellDetailLabel(row, columns, column),
        value
      })
      row[column] = getLiftedCellSummary(row, columns, column)
      lifted = true
    }
  }

  if (!lifted) {
    return table
  }

  return {
    ...table,
    rows,
    details
  }
}

const getWidePathDetailContext = (
  row: HumanLogTableRow,
  columns: readonly string[],
  column: string
): WidePathDetailContext | undefined => {
  const normalizedColumn = normalizeColumnName(column)

  if (normalizedColumn === 'path') {
    const artifactLabel = detailLabelFromCell(row['artifact'])
    if (artifactLabel) {
      return { label: artifactLabel, labelColumn: 'artifact' }
    }
  }

  if (columns.length === 2 && column === columns[1]) {
    const labelColumn = columns[0] as string
    const label = detailLabelFromCell(row[labelColumn])
    if (label && isPathLikeColumnName(label)) {
      return { label, labelColumn }
    }
  }

  if (isPathLikeColumnName(column)) {
    return { label: column }
  }

  return undefined
}

const shouldOmitLiftedLabelOnlyRow = (
  remainingColumns: readonly string[],
  liftedLabelColumns: ReadonlySet<string>
): boolean =>
  remainingColumns.length > 0
  && remainingColumns.every(column => liftedLabelColumns.has(column))

export const extractWidePathDetails = (table: HumanLogTable): HumanLogTable => {
  const columns = resolveTableColumns(table)
  const rows = table.rows.map(row => ({ ...row }))
  const details: HumanLogTableDetail[] = table.details ? [...table.details] : []
  const liftedColumns = new Set<string>()
  const liftedLabelColumnsByRow = new Map<number, Set<string>>()

  for (const [rowIndex, row] of rows.entries()) {
    for (const column of columns) {
      const value = row[column]
      if (value === undefined) {
        continue
      }

      const detailContext = getWidePathDetailContext(row, columns, column)
      if (!detailContext || !isLiftableWidePathValue(value)) {
        continue
      }

      details.push({ label: detailContext.label, value })
      delete row[column]
      liftedColumns.add(column)

      if (detailContext.labelColumn) {
        const labelColumns = liftedLabelColumnsByRow.get(rowIndex) ?? new Set<string>()
        labelColumns.add(detailContext.labelColumn)
        liftedLabelColumnsByRow.set(rowIndex, labelColumns)
      }
    }
  }

  if (details.length === (table.details?.length ?? 0)) {
    return table
  }

  const keptRows = rows.filter((row, rowIndex) => {
    const remainingColumns = columns.filter(column => nonEmptyTableCell(row[column]))
    if (remainingColumns.length === 0) {
      return false
    }

    const liftedLabelColumns = liftedLabelColumnsByRow.get(rowIndex)
    return liftedLabelColumns
      ? !shouldOmitLiftedLabelOnlyRow(remainingColumns, liftedLabelColumns)
      : true
  })

  const keptColumns = columns.filter((column) => {
    if (!liftedColumns.has(column)) {
      return true
    }
    return keptRows.some(row => nonEmptyTableCell(row[column]))
  })
  const keptColumnSet = new Set(keptColumns)

  const out: HumanLogTable = {
    rows: keptRows,
    ...(keptColumns.length > 0 ? { columns: keptColumns } : {}),
    ...(table.align
      ? {
          align: Object.fromEntries(
            Object.entries(table.align).filter(([column]) => keptColumnSet.has(column))
          )
        }
      : {}),
    details,
    ...(table.labels ? { labels: table.labels } : {})
  }

  return out
}
