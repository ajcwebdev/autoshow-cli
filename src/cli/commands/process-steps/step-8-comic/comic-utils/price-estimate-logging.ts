import * as l from '~/utils/app-logger/app-logger'
import { createDetailTable, createHumanTable } from '~/utils/app-logger/human-table/human-table'
import type { HumanLogTableRow, LogMetadata } from '~/types'

export const priceLine = (message: string, metadata?: LogMetadata): void => {
  l.write('info', message, {
    category: 'pricing',
    ...(metadata ? { metadata } : {})
  })
}

export const priceNotice = (message: string, metadata?: LogMetadata): void => {
  l.write('warn', message, {
    category: 'pricing',
    ...(metadata ? { metadata } : {})
  })
}

export const priceDetails = (
  title: string,
  entries: ReadonlyArray<readonly [string, unknown]>,
  metadata?: LogMetadata
): void => {
  l.write('info', title, {
    category: 'pricing',
    humanTable: createDetailTable(entries),
    ...(metadata ? { metadata } : {})
  })
}

export const priceTable = (
  title: string,
  rows: readonly HumanLogTableRow[],
  columns: readonly string[],
  metadata?: LogMetadata
): void => {
  l.write('info', title, {
    category: 'pricing',
    humanTable: createHumanTable(rows, columns),
    ...(metadata ? { metadata } : {})
  })
}
