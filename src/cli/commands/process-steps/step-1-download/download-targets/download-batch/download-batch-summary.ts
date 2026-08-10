import { basename } from 'node:path'
import { derivePipelineItemRecord, readManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { formatSttTargetLabel } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import type { PipelineItemErrorRecord, PipelineItemRecord, PipelineItemStatus, SttBatchItemSummary, SttProviderSummary } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { createHumanTable, logBatchItemTable } from '~/utils/app-logger/human-table/human-table'
import { getPipelineItemStatus, isRecord } from './pipeline-item-record-state'

const getPipelineItemTitle = (
  record: PipelineItemRecord,
  fallbackIndex: number
): string => {
  const step1 = isRecord(record['step1']) ? record['step1'] : undefined
  const titleCandidates = [
    step1?.['title'],
    step1?.['slug']
  ]

  for (const candidate of titleCandidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }

  const url = typeof step1?.['url'] === 'string' ? step1['url'] : undefined
  if (typeof url === 'string' && url.length > 0) {
    try {
      const parsed = new URL(url)
      const leaf = basename(parsed.pathname).replace(/\.[^.]+$/, '')
      if (leaf.length > 0) {
        return leaf
      }
    } catch {
    }
  }

  const outputDir = record['outputDir']
  if (typeof outputDir === 'string' && outputDir.trim().length > 0) {
    return basename(outputDir)
  }

  return `item-${fallbackIndex + 1}`
}

const parseSttProviderSummaries = (
  record: PipelineItemRecord
): SttProviderSummary[] => {
  const providerStates = Array.isArray(record['providerStates']) ? record['providerStates'] : []
  const summaries: SttProviderSummary[] = []

  for (const value of providerStates) {
    if (!isRecord(value) || typeof value['service'] !== 'string' || typeof value['model'] !== 'string') {
      continue
    }

    const status = value['status']
    if (status !== 'running' && status !== 'succeeded' && status !== 'missing' && status !== 'failed' && status !== 'skipped') {
      continue
    }

    const lastError = isRecord(value['lastError']) ? value['lastError'] : undefined
    const message = typeof lastError?.['message'] === 'string' && lastError['message'].trim().length > 0
      ? lastError['message'].trim()
      : undefined

    summaries.push({
      label: formatSttTargetLabel({
        service: value['service'] as Parameters<typeof formatSttTargetLabel>[0]['service'],
        model: value['model']
      }),
      status,
      ...(message ? { message } : {})
    })
  }

  return summaries
}

const getSttProviderStatusCounts = (
  record: PipelineItemRecord | null
): {
  succeeded: number
  failed: number
  missing: number
  skipped: number
} => {
  if (!record) {
    return {
      succeeded: 0,
      failed: 0,
      missing: 0,
      skipped: 0
    }
  }

  const summaries = parseSttProviderSummaries(record)
  if (summaries.length > 0) {
    return summaries.reduce((counts, summary) => {
      if (summary.status === 'succeeded') {
        counts.succeeded += 1
      } else if (summary.status === 'failed') {
        counts.failed += 1
      } else if (summary.status === 'missing' || summary.status === 'running') {
        counts.missing += 1
      } else {
        counts.skipped += 1
      }
      return counts
    }, {
      succeeded: 0,
      failed: 0,
      missing: 0,
      skipped: 0
    })
  }

  return {
    succeeded: 0,
    failed: 0,
    missing: 0,
    skipped: 0
  }
}

const formatBatchProviderCount = (
  count: number,
  label: string
): string => `${count} ${label}${count === 1 ? '' : 's'}`

export const buildSttBatchItemDetail = (
  record: PipelineItemRecord | null
): string | undefined => {
  const counts = getSttProviderStatusCounts(record)
  const parts = [
    counts.failed > 0 ? formatBatchProviderCount(counts.failed, 'provider failure') : undefined,
    counts.missing > 0 ? formatBatchProviderCount(counts.missing, 'provider missing') : undefined,
    counts.skipped > 0 ? formatBatchProviderCount(counts.skipped, 'provider skipped') : undefined
  ].filter((value): value is string => typeof value === 'string')

  return parts.length > 0 ? parts.join(', ') : undefined
}

const resolveSttItemRecordCompletionStatus = (
  record: PipelineItemRecord
): PipelineItemStatus => {
  const completionStatus = getPipelineItemStatus(record)
  if (completionStatus) {
    return completionStatus
  }

  const counts = getSttProviderStatusCounts(record)
  if (counts.succeeded === 0) {
    return 'failed'
  }

  return counts.failed === 0 && counts.missing === 0 ? 'full' : 'incomplete'
}

const summarizeSttItemRecords = (
  records: PipelineItemRecord[]
): SttBatchItemSummary[] =>
  records.map((record, index) => ({
    label: getPipelineItemTitle(record, index),
    completionStatus: resolveSttItemRecordCompletionStatus(record),
    providers: parseSttProviderSummaries(record)
  }))

const buildSttBatchFinalSummaryTable = (
  records: PipelineItemRecord[]
) => {
  const summaries = summarizeSttItemRecords(records)
  const rows = summaries.flatMap((summary, index) => {
    const base = {
      item: `${index + 1}/${summaries.length}`,
      label: summary.label,
      status: summary.completionStatus
    }

    if (summary.providers.length === 0) {
      return [{
        ...base,
        provider: 'unavailable',
        providerStatus: 'unavailable',
        detail: ''
      }]
    }

    return summary.providers.map((provider) => ({
      ...base,
      provider: provider.label,
      providerStatus: provider.status,
      detail: provider.message ?? ''
    }))
  })

  return createHumanTable(rows, ['item', 'label', 'status', 'provider', 'providerStatus', 'detail'])
}

export const logSttBatchFinalSummary = async (batchDir: string): Promise<void> => {
  const manifest = await readManifest(batchDir).catch(() => undefined)
  if (!manifest || manifest.command !== 'extract' || manifest.scope !== 'batch') {
    return
  }

  const records = manifest.items.map((item) => derivePipelineItemRecord(batchDir, item))
  const summaries = summarizeSttItemRecords(records)
  if (summaries.length === 0) {
    return
  }

  const table = buildSttBatchFinalSummaryTable(records)
  const hasFailed = summaries.some((summary) =>
    summary.completionStatus === 'failed'
    || summary.providers.some((provider) => provider.status === 'failed')
  )
  const hasWarnings = hasFailed || summaries.some((summary) =>
    summary.completionStatus === 'incomplete'
    || summary.completionStatus === 'skipped'
    || summary.providers.some((provider) =>
      provider.status === 'skipped' || provider.status === 'missing'
    )
  )
  const level = hasFailed ? 'error' : hasWarnings ? 'warn' : 'success'
  l.write(level, 'STT final provider status by item', {
    category: 'artifact',
    humanTable: table,
    metadata: {
      items: summaries.map((summary, index) => ({
        item: `${index + 1}/${summaries.length}`,
        label: summary.label,
        status: summary.completionStatus,
        providers: summary.providers
      }))
    }
  })
}

const buildNonSttBatchSummaryTable = (
  ok: number,
  partial: number,
  fail: number
) =>
  createHumanTable([{
    completed: ok,
    full: ok - partial,
    partial,
    failed: fail
  }], ['completed', 'full', 'partial', 'failed'])

const buildSttBatchSummaryTable = (
  ok: number,
  incomplete: number,
  fail: number
) =>
  createHumanTable([{
    full: ok,
    incomplete,
    failed: fail
  }], ['full', 'incomplete', 'failed'])

export const buildBatchPartialFailureTable = (
  records: PipelineItemErrorRecord[]
) => {
  const counts = new Map<string, number>()

  for (const record of records) {
    if (record.skipped === true) {
      continue
    }
    if (typeof record.service !== 'string' || typeof record.model !== 'string') {
      continue
    }

    const key = `${record.service}/${record.model}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const rows = [...counts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([provider, failures]) => ({ provider, failures }))

  return createHumanTable(rows, ['provider', 'failures'])
}

export const logBatchItemStatus = (
  level: 'info' | 'success' | 'warn' | 'error',
  item: string,
  status: 'processing' | 'done' | 'incomplete' | 'failed',
  detail?: string
): void => {
  logBatchItemTable(l, [{
    status,
    input: item,
    ...(detail ? { detail } : {})
  }], { level })
}

const buildBatchCompletionTable = (
  ok: number,
  partial: number,
  incomplete: number,
  fail: number,
  sttLike = false
)=> {
  return sttLike
    ? buildSttBatchSummaryTable(ok, incomplete, fail)
    : buildNonSttBatchSummaryTable(ok, partial, fail)
}

export const logBatchCompletionTable = (
  ok: number,
  partial: number,
  incomplete: number,
  fail: number,
  sttLike = false
): void => {
  l.write(
    sttLike
      ? (incomplete > 0 || fail > 0 ? 'warn' : 'success')
      : (partial > 0 || fail > 0 ? 'warn' : 'success'),
    'Batch Summary',
    {
      category: 'pipeline',
      humanTable: buildBatchCompletionTable(ok, partial, incomplete, fail, sttLike),
      metadata: sttLike
        ? { full: ok, incomplete, failed: fail }
        : { completed: ok, full: ok - partial, partial, failed: fail }
    }
  )
}
