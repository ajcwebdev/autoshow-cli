import * as l from '~/utils/app-logger/app-logger'
import type { LogMetadata } from '~/types'

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
    metadata: { ...metadata, details: Object.fromEntries(entries) }
  })
}

export const priceRows = (
  title: string,
  rows: ReadonlyArray<Record<string, unknown>>,
  _columns: readonly string[],
  metadata?: LogMetadata
): void => {
  l.write('info', `${title}: ${rows.length} entries`, {
    category: 'pricing',
    metadata: { ...metadata, rows }
  })
}
