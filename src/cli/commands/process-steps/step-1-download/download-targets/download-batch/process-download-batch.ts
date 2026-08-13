import { basename, join } from 'node:path'
import { createManifest, createPipelineItemFromRecord, PIPELINE_MANIFEST_FILE, updateManifest, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { resolveRunDirectory } from '~/cli/commands/process-steps/run-dir'
import { getOutputRoot } from '~/cli/commands/process-steps/output-root'
import { buildPipelineItemRecord } from '~/cli/commands/process-steps/step-0-metadata/metadata-batch/pipeline-item-record-builder'
import type { BatchItemOutcome, BatchItemProcessor, BatchProcessResult, BatchRunOptions, BatchSummarySource, BatchTallyAccumulator, ExecuteBatchItemContext, PipelineItemErrorRecord, PipelineItemRecord, PrepareBatchRunResult, ProcessCommand } from '~/types'
import { ensureDirectory } from '~/utils/cli-utils'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import * as l from '~/utils/app-logger/app-logger'
import { logLocationsTable } from '~/utils/app-logger/human-table/human-table'
import { getPipelineItemErrors, toBatchCommand } from './pipeline-item-record-state'
import { buildBatchPartialFailureTable, logBatchCompletionTable } from './download-batch-summary'
import { executeBatchItem } from './execute-batch-item'
import { writeOcrBatchDiagnostics } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-batch-diagnostics'

const runWithSemaphore = async <T>(
  max: number,
  sem: { active: number },
  fn: () => Promise<T>
): Promise<T> => {
  while (sem.active >= max) {
    await new Promise<void>(r => setTimeout(r, 50))
  }
  sem.active++
  try {
    return await fn()
  } finally {
    sem.active--
  }
}

/**
 * Validates inputs, creates the batch directory, and writes the initial canonical manifest.
 * Returns `{ done: true }` with an early result when there is nothing to
 * process, otherwise the resolved batch directory and pipeline item records.
 */
const prepareBatchRun = async (
  items: string[],
  batchLabel: string,
  command: ProcessCommand,
  runOpts: BatchRunOptions
): Promise<PrepareBatchRunResult> => {
  const prefilledRecords = runOpts.initialRecords ? [...runOpts.initialRecords] : undefined

  if (items.length === 0 && (!prefilledRecords || prefilledRecords.length === 0)) {
    l.warn('No inputs to process')
    return { done: true, result: { ok: 0, partial: 0, incomplete: 0, fail: 0 } }
  }

  if (typeof runOpts.totalCount === 'number' && runOpts.totalCount > items.length) {
    const selectedCount = prefilledRecords?.length ?? items.length
    if (selectedCount < runOpts.totalCount) {
      if (items.length < selectedCount) {
        l.warn(`Processing ${items.length} runnable items from ${selectedCount} selected of ${runOpts.totalCount} total. Some selected inputs were skipped as unsupported for this command; use --batch-all to select more items.`)
      } else {
        l.warn(`Processing ${items.length} of ${runOpts.totalCount} items. Use --batch-all to process all.`)
      }
    } else {
      l.warn(`Processing ${items.length} of ${selectedCount} selected items. Some inputs were skipped as unsupported for this command.`)
    }
  }

  const batchDir = runOpts.parentBatchDir
    ? join(runOpts.parentBatchDir, runOpts.extractRoute ?? toBatchCommand(command))
    : resolveRunDirectory(getOutputRoot(), batchLabel, 'batch')
  const batchDirName = basename(batchDir)
  await ensureDirectory(batchDir)
  logLocationsTable(l, [{ artifact: 'outputDir', path: batchDir }])

  const batchSource: BatchSummarySource | undefined = runOpts.source
    ? {
        sourceKind: runOpts.source.sourceKind,
        sourceUrl: runOpts.source.sourceUrl,
        title: runOpts.source.title,
        author: runOpts.source.author,
        selectedCount: prefilledRecords?.length ?? items.length
      }
    : undefined

  let itemRecords: PipelineItemRecord[]
  if (prefilledRecords && prefilledRecords.length > 0) {
    itemRecords = prefilledRecords
  } else if (runOpts.selectedItems && runOpts.selectedItems.length > 0) {
    itemRecords = runOpts.selectedItems.map((item, index) =>
      item
        ? buildPipelineItemRecord(item.url, item)
        : buildPipelineItemRecord(items[index] ?? `item-${index + 1}`)
    )
  } else {
    itemRecords = items.map((item) => buildPipelineItemRecord(item))
  }

  if (itemRecords.length === 0) {
    l.warn('No supported inputs to process')
    return { done: true, result: { ok: 0, partial: 0, incomplete: 0, fail: 0, batchDir } }
  }

  await writeManifest(batchDir, createManifest(toBatchCommand(command), 'batch', itemRecords.map((record) =>
    createPipelineItemFromRecord(batchDir, record, runOpts.extractRoute ? { extractRoute: runOpts.extractRoute } : {})
  ), batchSource))
  logLocationsTable(l, [{ artifact: 'manifest', path: `${batchDir}/${PIPELINE_MANIFEST_FILE}` }])

  return { done: false, batchDir, batchDirName, batchSource, itemRecords }
}

/**
 * Accumulates per-item outcomes into batch counters and item records, unifying the
 * serial and concurrent execution paths behind a single `applyItemResult`.
 */
const createBatchTallyAccumulator = (
  itemRecords: PipelineItemRecord[],
  resultEntryIndexes: number[]
) => {
  let ok = 0
  let partial = 0
  let incomplete = 0
  let fail = 0
  let failureExitCode: number | undefined
  let hasMixedFailureCodes = false
  const finalItemRecords = [...itemRecords]
  const partialFailureRecords: PipelineItemErrorRecord[] = []

  const recordFailureExitCode = (error: unknown): void => {
    const exitCode = error instanceof Error && 'exitCode' in error
      ? (error as Error & { exitCode?: unknown }).exitCode
      : undefined
    if (typeof exitCode !== 'number' || !Number.isFinite(exitCode) || exitCode < 1) {
      hasMixedFailureCodes = true
      return
    }
    if (failureExitCode === undefined) {
      failureExitCode = exitCode
      return
    }
    if (failureExitCode !== exitCode) {
      hasMixedFailureCodes = true
    }
  }

  const applyItemResult = (result: BatchItemOutcome, index: number): void => {
    if (result.itemRecord) {
      const recordIndex = resultEntryIndexes[index] ?? index
      finalItemRecords[recordIndex] = {
        ...(finalItemRecords[recordIndex] ?? {}),
        ...result.itemRecord
      }
    }
    partialFailureRecords.push(...getPipelineItemErrors(result.itemRecord))

    if (result.status === 'ok') {
      ok++
    } else if (result.status === 'partial') {
      ok++
      partial++
    } else if (result.status === 'incomplete') {
      incomplete++
      recordFailureExitCode(result.failureError)
    } else {
      fail++
      recordFailureExitCode(result.failureError)
    }
  }

  const recordRejectedItem = (reason: unknown): void => {
    fail++
    recordFailureExitCode(reason)
  }

  return {
    applyItemResult,
    recordRejectedItem,
    finalItemRecords,
    partialFailureRecords,
    tally: (): { ok: number, partial: number, incomplete: number, fail: number } => ({ ok, partial, incomplete, fail }),
    failureExit: (): number | undefined =>
      !hasMixedFailureCodes && failureExitCode !== undefined ? failureExitCode : undefined
  }
}

/**
 * Logs the partial-failure and completion tables and writes the final canonical manifest.
 */
const finalizeBatch = async ({
  command,
  batchDir,
  extractRoute,
  sttLike,
  acc
}: {
  command: ProcessCommand
  batchDir: string
  extractRoute: BatchRunOptions['extractRoute']
  sttLike: boolean
  acc: BatchTallyAccumulator
}): Promise<BatchProcessResult> => {
  const { ok, partial, incomplete, fail } = acc.tally()

  if (acc.partialFailureRecords.length > 0) {
    const partialFailureTable = buildBatchPartialFailureTable(acc.partialFailureRecords)
    if (partialFailureTable.rows.length > 0) {
      l.write('warn', 'Partial provider failures', {
        category: 'pipeline',
        humanTable: partialFailureTable,
        metadata: {
          failures: partialFailureTable.rows
        }
      })
    }
  }

  logBatchCompletionTable(ok, partial, incomplete, fail, sttLike)
  const completedItems = acc.finalItemRecords.map((record) =>
    createPipelineItemFromRecord(batchDir, record, extractRoute ? { extractRoute } : {})
  )
  await updateManifest(batchDir, (manifest) => ({
    ...manifest,
    items: completedItems
  }))
  if (command === 'write' || (command === 'extract' && extractRoute === 'document')) {
    await writeOcrBatchDiagnostics(batchDir)
  }

  const failureExitCode = acc.failureExit()
  return {
    ok,
    partial,
    incomplete,
    fail,
    batchDir,
    ...(failureExitCode !== undefined ? { failureExitCode } : {})
  }
}

export const processBatch = async <TOptions extends object>(
  items: string[],
  batchLabel: string,
  command: ProcessCommand,
  opts: TOptions,
  processSingleTarget: BatchItemProcessor<TOptions>,
  runOpts: BatchRunOptions = {}
): Promise<BatchProcessResult> => {
  const sttLike = command === 'extract' && runOpts.extractRoute === 'media'

  const prepared = await prepareBatchRun(items, batchLabel, command, runOpts)
  if (prepared.done) {
    return prepared.result
  }
  const { batchDir, batchDirName, itemRecords } = prepared

  const concurrency = Math.max(1, runOpts.concurrency ?? DEFAULT_CLI_CONCURRENCY)
  const resultEntryIndexes = runOpts.resultEntryIndexes ?? items.map((_, index) => index)
  const acc = createBatchTallyAccumulator(itemRecords, resultEntryIndexes)
  const itemContext: ExecuteBatchItemContext<TOptions> = {
    command,
    batchDir,
    batchDirName,
    opts,
    runOpts,
    processSingleTarget,
    sttLike,
    itemCount: items.length
  }

  if (concurrency === 1) {
    for (let index = 0; index < items.length; index++) {
      const result = await executeBatchItem(itemContext, items[index] as string, index)
      acc.applyItemResult(result, index)
    }
  } else {
    l.write('info', `Processing ${items.length} items with concurrency ${concurrency}`)
    const sem = { active: 0 }
    const results = await Promise.allSettled(
      items.map((item, index) =>
        runWithSemaphore(concurrency, sem, async () => await executeBatchItem(itemContext, item, index))
      )
    )
    for (const [index, r] of results.entries()) {
      if (r.status === 'fulfilled') {
        acc.applyItemResult(r.value, index)
      } else {
        acc.recordRejectedItem(r.reason)
        const message = r.reason instanceof Error ? r.reason.message : String(r.reason)
        l.error(`Batch item failed: ${message}`)
      }
    }
  }

  return finalizeBatch({ command, batchDir, extractRoute: runOpts.extractRoute, sttLike, acc })
}
