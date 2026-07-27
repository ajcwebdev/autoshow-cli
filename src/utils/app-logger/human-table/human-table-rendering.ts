import { formatDuration } from '~/utils/app-logger/formatters'
import { colorizeHumanTableBorder, colorizeHumanTableCell, colorizeHumanTableHeader } from '~/utils/app-logger/log-colors'
import { stripAnsi } from '~/utils/terminal-colors'
import { getSemanticColumnName, isKeyLabelColumn, resolveTableColumns, shouldRenderHeader } from './human-table-columns'
import { extractVerboseCellDetails, extractWidePathDetails } from './human-table-detail-lifting'
import { getDisplayLabel, isCostSemanticColumn, isCountSemanticColumn, isDurationSemanticColumn, isSecondsSemanticColumn } from './human-table-labels'
import type { HumanLogTable, HumanLogTableAlign, HumanLogTableCell, HumanLogTableDetail, HumanLogTableRow } from '~/types'

const tableIndent = '  '

const tableChars = {
  topLeft: '\u250c',
  topJoin: '\u252c',
  topRight: '\u2510',
  leftJoin: '\u251c',
  crossJoin: '\u253c',
  rightJoin: '\u2524',
  bottomLeft: '\u2514',
  bottomJoin: '\u2534',
  bottomRight: '\u2518',
  horizontal: '\u2500',
  vertical: '\u2502'
} as const

const shouldFormatDurationValue = (
  semanticColumn: string,
  value: HumanLogTableCell
): value is number =>
  typeof value === 'number'
  && Number.isFinite(value)
  && isDurationSemanticColumn(semanticColumn)
  && !isSecondsSemanticColumn(semanticColumn)

const formatDisplayTableCell = (
  table: HumanLogTable,
  row: HumanLogTableRow,
  columns: readonly string[],
  column: string,
  value: HumanLogTableCell | undefined
): string => {
  if (value === undefined) {
    return ''
  }

  if (value === null) {
    return 'null'
  }

  if (isKeyLabelColumn(columns, column) && typeof value === 'string') {
    return getDisplayLabel(table, value)
  }

  const semanticColumn = getSemanticColumnName(row, columns, column)
  if (shouldFormatDurationValue(semanticColumn, value)) {
    return formatDuration(value)
  }

  return String(value)
}

const formatDisplayDetailCell = (
  label: string,
  value: HumanLogTableCell
): string => {
  if (value === null) {
    return 'null'
  }

  if (shouldFormatDurationValue(label, value)) {
    return formatDuration(value)
  }

  return String(value)
}

const padColoredTableCell = (
  coloredValue: string,
  plainValue: string,
  width: number,
  align: HumanLogTableAlign = 'left'
): string => {
  const padding = ' '.repeat(Math.max(0, width - plainValue.length))
  return align === 'right'
    ? `${padding}${coloredValue}`
    : `${coloredValue}${padding}`
}

const renderBorder = (
  left: string,
  join: string,
  right: string,
  widths: readonly number[]
): string =>
  colorizeHumanTableBorder(
    `${left}${widths.map(width => tableChars.horizontal.repeat(width + 2)).join(join)}${right}`
  )

const createStringRow = (
  columns: readonly string[],
  values: readonly string[]
): Record<string, string> => {
  const row: Record<string, string> = {}
  for (const [index, column] of columns.entries()) {
    row[column] = values[index] ?? ''
  }
  return row
}

const renderTableRow = (
  values: readonly string[],
  widths: readonly number[],
  columns: readonly string[],
  options: { header?: boolean; align?: HumanLogTable['align'] } = {}
): string => {
  const row = createStringRow(columns, values)
  const vertical = colorizeHumanTableBorder(tableChars.vertical)
  return `${vertical}${values
    .map((value, index) => {
      const width = widths[index] ?? 0
      const column = columns[index] ?? ''
      const align = options.align?.[column] ?? 'left'
      const coloredValue = options.header
        ? colorizeHumanTableHeader(value)
        : colorizeHumanTableCell({ column, value, row })
      return ` ${padColoredTableCell(coloredValue, value, width, align)} `
    })
    .join(vertical)}${vertical}`
}

const isRightAlignedDisplayValue = (value: string): boolean => {
  const trimmed = stripAnsi(value).trim()
  return trimmed.length > 0
    && (
      /^-?\d+(?:\.\d+)?$/.test(trimmed)
      || /^-?\$?\d+(?:\.\d+)?\u00a2?$/.test(trimmed)
      || trimmed === 'free'
      || trimmed === '<0.01\u00a2'
      || /^\d+(?:\.\d+)?(?:ms|s)$/.test(trimmed)
      || /^\d+m \d+s$/.test(trimmed)
    )
}

const inferColumnAlign = (
  table: HumanLogTable,
  columns: readonly string[],
  column: string,
  displayValues: readonly string[]
): HumanLogTableAlign | undefined => {
  if (isKeyLabelColumn(columns, column)) {
    return undefined
  }

  const columnIndex = columns.indexOf(column)
  const semanticColumns = new Set(
    table.rows.map(row => getSemanticColumnName(row, columns, column))
  )
  const shouldAlignBySemantic = semanticColumns.size === 1 && [...semanticColumns].some(semantic =>
    isCostSemanticColumn(semantic)
    || isDurationSemanticColumn(semantic)
    || isCountSemanticColumn(semantic)
  )
  if (shouldAlignBySemantic) {
    return 'right'
  }

  const nonEmptyValues = displayValues
    .map(value => value.trim())
    .filter(value => value.length > 0)
  if (
    columnIndex >= 0
    && nonEmptyValues.length > 0
    && nonEmptyValues.every(isRightAlignedDisplayValue)
  ) {
    return 'right'
  }

  return undefined
}

const resolveRenderAlign = (
  table: HumanLogTable,
  columns: readonly string[],
  rows: readonly (readonly string[])[]
): HumanLogTable['align'] => {
  const align: Record<string, HumanLogTableAlign> = {}

  for (const [index, column] of columns.entries()) {
    const explicitAlign = table.align?.[column]
    const inferredAlign = explicitAlign ?? inferColumnAlign(
      table,
      columns,
      column,
      rows.map(row => row[index] ?? '')
    )
    if (inferredAlign) {
      align[column] = inferredAlign
    }
  }

  return Object.keys(align).length > 0 ? align : undefined
}

const renderHumanTableDetails = (
  table: HumanLogTable,
  details: readonly HumanLogTableDetail[] | undefined
): string => {
  if (!details || details.length === 0) {
    return ''
  }

  return details
    .map((detail) => {
      const label = getDisplayLabel(table, detail.label)
      const value = formatDisplayDetailCell(detail.label, detail.value)
      const valueLines = value.split(/\r?\n/).map(line => colorizeHumanTableCell({
        column: detail.label,
        value: line,
        row: { [detail.label]: line }
      }))
      const [firstLine = '', ...restLines] = valueLines
      const renderedFirstLine = `${tableIndent}${label}: ${firstLine}`
      if (restLines.length === 0) {
        return renderedFirstLine
      }

      const continuationIndent = `${tableIndent}${' '.repeat(label.length + 2)}`
      return [
        renderedFirstLine,
        ...restLines.map(line => `${continuationIndent}${line}`)
      ].join('\n')
    })
    .join('\n')
}

export const renderHumanTable = (table: HumanLogTable): string => {
  const normalizedTable = extractWidePathDetails(extractVerboseCellDetails(table))
  const renderedDetails = renderHumanTableDetails(normalizedTable, normalizedTable.details)

  if (normalizedTable.rows.length === 0) {
    return renderedDetails.length > 0 ? renderedDetails : `${tableIndent}(empty)`
  }

  const columns = resolveTableColumns(normalizedTable)
  if (columns.length === 0) {
    return renderedDetails.length > 0 ? renderedDetails : `${tableIndent}(empty)`
  }

  const renderHeader = shouldRenderHeader(columns)
  const headerValues = columns.map(column => getDisplayLabel(normalizedTable, column))
  const rows = normalizedTable.rows.map(row =>
    columns.map(column => formatDisplayTableCell(normalizedTable, row, columns, column, row[column]))
  )
  const renderAlign = resolveRenderAlign(normalizedTable, columns, rows)
  const widths = columns.map((column, index) => Math.max(
    renderHeader ? (headerValues[index]?.length ?? column.length) : 0,
    ...rows.map(row => row[index]?.length ?? 0)
  ))
  const lines = [
    renderBorder(tableChars.topLeft, tableChars.topJoin, tableChars.topRight, widths),
    ...(renderHeader
      ? [
          renderTableRow(headerValues, widths, columns, { header: true, align: renderAlign }),
          renderBorder(tableChars.leftJoin, tableChars.crossJoin, tableChars.rightJoin, widths)
        ]
      : []),
    ...rows.map(row => renderTableRow(row, widths, columns, { align: renderAlign })),
    renderBorder(tableChars.bottomLeft, tableChars.bottomJoin, tableChars.bottomRight, widths)
  ]

  return lines
    .map(line => `${tableIndent}${line}`)
    .join('\n')
    + (renderedDetails.length > 0 ? `\n${renderedDetails}` : '')
}
