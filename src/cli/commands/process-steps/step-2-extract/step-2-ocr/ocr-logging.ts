import type { HumanLogTable, KeyValueEntry, LogLevel, OcrPagesProgress, OcrProviderLifecycle, TableLogger } from '~/types'
import { createKeyValueTable } from '~/utils/app-logger/human-table/human-table'

const addOptionalEntry = (
  entries: KeyValueEntry[],
  key: string,
  value: unknown
): void => {
  if (value !== undefined && value !== '') {
    entries.push([key, value])
  }
}

export const buildOcrProviderLifecycleTable = (
  lifecycle: OcrProviderLifecycle
): HumanLogTable => {
  const entries: KeyValueEntry[] = [
    ['provider', lifecycle.provider],
    ['model', lifecycle.model],
    ['status', lifecycle.status]
  ]
  addOptionalEntry(entries, 'elapsedMs', lifecycle.elapsedMs)
  addOptionalEntry(entries, 'reason', lifecycle.reason)
  addOptionalEntry(entries, 'detail', lifecycle.detail)
  return createKeyValueTable(entries)
}

export const logOcrProviderLifecycle = (
  logger: TableLogger,
  lifecycle: OcrProviderLifecycle,
  level: LogLevel = lifecycle.status === 'succeeded'
    ? 'success'
    : lifecycle.status === 'failed' ? 'warn' : 'info'
): void => {
  logger.write(level, 'OCR Provider', {
    category: 'pipeline',
    humanTable: buildOcrProviderLifecycleTable(lifecycle),
    metadata: lifecycle
  })
}

export const buildOcrPagesProgressTable = (
  progress: OcrPagesProgress
): HumanLogTable =>
  createKeyValueTable([
    ['status', progress.status],
    ['ocrPages', progress.ocrPages],
    ['totalPages', progress.totalPages],
    ['renderConcurrency', progress.renderConcurrency],
    ['ocrConcurrency', progress.ocrConcurrency]
  ])

export const logOcrPagesProgress = (
  logger: TableLogger,
  progress: OcrPagesProgress,
  level: LogLevel = 'info'
): void => {
  logger.write(level, 'OCR Pages', {
    category: 'pipeline',
    humanTable: buildOcrPagesProgressTable(progress),
    metadata: progress
  })
}
