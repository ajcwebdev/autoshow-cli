import { createBatchItemTable, createKeyValueTable, createLocationsTable, createSingleRowTable } from './human-table-builders'
import type { BatchItemTableRow, HumanTableLogOptions, KeyValueTableLogOptions, LocationTableRow, Logger, SingleRowTableLogOptions } from '~/types'

export const logSingleRowTable = (
  logger: Pick<Logger, 'write'>,
  message: string,
  row: Readonly<Record<string, unknown>>,
  options: SingleRowTableLogOptions = {}
): void => {
  logger.write(options.level ?? 'info', message, {
    category: options.category ?? 'general',
    humanTable: createSingleRowTable(row, options.columns),
    metadata: options.metadata ?? row
  })
}

export const logKeyValueTable = (
  logger: Pick<Logger, 'write'>,
  message: string,
  entries: ReadonlyArray<readonly [string, unknown]>,
  options: KeyValueTableLogOptions = {}
): void => {
  const keyLabel = options.keyLabel ?? 'key'
  const valueLabel = options.valueLabel ?? 'value'

  logger.write(options.level ?? 'info', message, {
    category: options.category ?? 'general',
    humanTable: createKeyValueTable(entries, keyLabel, valueLabel),
    metadata: options.metadata ?? {
      entries: entries.map(([key, value]) => ({ key, value }))
    }
  })
}

export const logLocationsTable = (
  logger: Pick<Logger, 'write'>,
  rows: readonly LocationTableRow[],
  options: HumanTableLogOptions = {}
): void => {
  logger.write(options.level ?? 'info', 'Locations', {
    category: options.category ?? 'artifact',
    humanTable: createLocationsTable(rows),
    ...(options.metadata ? { metadata: options.metadata } : {})
  })
}

export const logBatchItemTable = (
  logger: Pick<Logger, 'write'>,
  rows: readonly BatchItemTableRow[],
  options: HumanTableLogOptions = {}
): void => {
  logger.write(options.level ?? 'info', 'Batch Item', {
    category: options.category ?? 'pipeline',
    humanTable: createBatchItemTable(rows),
    ...(options.metadata ? { metadata: options.metadata } : {})
  })
}
