import type { HumanLogTable, KeyValueEntry, OcrPagesProgress, OcrProviderLifecycle } from '~/types'
import { createKeyValueTable } from '~/utils/app-logger/human-table/human-table'
import { defineTableLog } from '~/utils/app-logger/table-log-definition'

const addOptionalEntry = (
  entries: KeyValueEntry[],
  key: string,
  value: unknown
): void => {
  if (value !== undefined && value !== '') {
    entries.push([key, value])
  }
}

const buildOcrProviderLifecycleTableValue = (
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

export const { buildTable: buildOcrProviderLifecycleTable, log: logOcrProviderLifecycle } = defineTableLog<OcrProviderLifecycle>({
  title: 'OCR Provider',
  category: 'pipeline',
  buildTable: buildOcrProviderLifecycleTableValue,
  level: lifecycle => lifecycle.status === 'succeeded' ? 'success' : lifecycle.status === 'failed' ? 'warn' : 'info',
  metadata: lifecycle => lifecycle
})

const buildOcrPagesProgressTableValue = (
  progress: OcrPagesProgress
): HumanLogTable =>
  createKeyValueTable([
    ['status', progress.status],
    ['ocrPages', progress.ocrPages],
    ['totalPages', progress.totalPages],
    ['renderConcurrency', progress.renderConcurrency],
    ['ocrConcurrency', progress.ocrConcurrency]
  ])

export const { buildTable: buildOcrPagesProgressTable, log: logOcrPagesProgress } = defineTableLog<OcrPagesProgress>({
  title: 'OCR Pages',
  category: 'pipeline',
  buildTable: buildOcrPagesProgressTableValue,
  level: 'info',
  metadata: progress => progress
})
