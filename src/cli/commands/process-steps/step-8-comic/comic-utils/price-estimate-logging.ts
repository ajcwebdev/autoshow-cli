import * as l from '~/utils/app-logger/app-logger'
import { createDetailTable, createHumanTable } from '~/utils/app-logger/human-table/human-table'
import type { HumanLogTableRow, LogMetadata } from '~/types'

/**
 * Comic's price-estimate output.
 *
 * The rest of step-8-comic keeps the compact one-line `label key=value` contract through
 * `comicWrite`, but price estimates do not: they were the one place in the repo where a
 * pricing module hand-padded ASCII columns with `.padEnd()` inside message strings, so the
 * JSON sink received pre-rendered layout instead of rows, every event landed at level
 * `info` under category `command`, and the numbers a consumer wants (per-image cost,
 * subtotal, output counts) were only recoverable by re-parsing prose.
 *
 * These helpers put comic on the same footing as `video-pricing.ts`, `image-pricing.ts`,
 * and `suite-price-logging.ts`: `category: 'pricing'`, a real `humanTable`, and `metadata`
 * carrying the same values the human line shows.
 */

export const priceLine = (message: string, metadata?: LogMetadata): void => {
  l.write('info', message, {
    category: 'pricing',
    ...(metadata ? { metadata } : {})
  })
}

/**
 * For notices that report a missing prerequisite or a degraded estimate. These used to be
 * emitted at `info` alongside ordinary progress, so `--log-level warn` showed nothing at
 * all for a run that could not be estimated.
 */
export const priceNotice = (message: string, metadata?: LogMetadata): void => {
  l.write('warn', message, {
    category: 'pricing',
    ...(metadata ? { metadata } : {})
  })
}

/** Key/value block (models, size, quality, …) rendered as table details. */
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
