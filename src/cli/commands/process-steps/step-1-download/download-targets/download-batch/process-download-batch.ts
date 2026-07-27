import { basename, join } from 'node:path'
import { writeBatchManifest } from '~/cli/commands/process-steps/manifest-utils'
import { resolveRunDirectory } from '~/cli/commands/process-steps/run-dir'
import { getOutputRoot } from '~/cli/commands/process-steps/output-root'
import { buildBatchManifestEntryForItem } from '~/cli/commands/process-steps/step-0-metadata/metadata-batch/batch-manifest-entry'
import { writeSttBatchManifest } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-manifest'
import type { BatchItemOutcome, BatchItemProcessor, BatchManifestEntry, BatchManifestErrorEntry, BatchManifestSummarySource, BatchProcessResult, BatchRunOptions, BatchTallyAccumulator, ExecuteBatchItemContext, PrepareBatchRunResult, ProcessCommand, RuntimeOptions } from '~/types'
import { ensureDirectory, writeFile } from '~/utils/cli-utils'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import * as l from '~/utils/app-logger/app-logger'
import { logLocationsTable } from '~/utils/app-logger/human-table/human-table'
import { getBatchManifestErrors, toManifestKind } from './batch-manifest'
import { buildBatchPartialFailureTable, logBatchCompletionTable } from './download-batch-summary'
import { executeBatchItem } from './execute-batch-item'

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
 * Validates inputs, creates the batch directory, and writes `source.json` plus the initial
 * batch manifest. Returns `{ done: true }` with an early result when there is nothing to
 * process, otherwise the resolved batch directory and manifest entries.
 */
const prepareBatchRun = async (
  items: string[],
  batchLabel: string,
  command: ProcessCommand,
  runOpts: BatchRunOptions
): Promise<PrepareBatchRunResult> => {
  const prefilledEntries = runOpts.initialEntries ? [...runOpts.initialEntries] : undefined

  if (items.length === 0 && (!prefilledEntries || prefilledEntries.length === 0)) {
    l.warn('No inputs to process')
    return { done: true, result: { ok: 0, partial: 0, incomplete: 0, fail: 0 } }
  }

  if (typeof runOpts.totalCount === 'number' && runOpts.totalCount > items.length) {
    const selectedCount = prefilledEntries?.length ?? items.length
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
    ? join(runOpts.parentBatchDir, runOpts.extractRoute ?? toManifestKind(command))
    : resolveRunDirectory(getOutputRoot(), batchLabel, 'batch')
  const batchDirName = basename(batchDir)
  await ensureDirectory(batchDir)
  logLocationsTable(l, [{ artifact: 'outputDir', path: batchDir }])

  const batchSource: BatchManifestSummarySource | undefined = runOpts.source
    ? {
        sourceKind: runOpts.source.sourceKind,
        sourceUrl: runOpts.source.sourceUrl,
        title: runOpts.source.title,
        author: runOpts.source.author,
        selectedCount: prefilledEntries?.length ?? items.length
      }
    : undefined

  if (batchSource) {
    await writeFile(`${batchDir}/source.json`, JSON.stringify(batchSource, null, 2))
  }

  let infoEntries: BatchManifestEntry[]
  if (prefilledEntries && prefilledEntries.length > 0) {
    infoEntries = prefilledEntries
  } else if (runOpts.selectedItems && runOpts.selectedItems.length > 0) {
    infoEntries = runOpts.selectedItems.map((item, index) =>
      item
        ? buildBatchManifestEntryForItem(item.url, item)
        : buildBatchManifestEntryForItem(items[index] ?? `item-${index + 1}`)
    )
  } else {
    infoEntries = items.map((item) => buildBatchManifestEntryForItem(item))
  }

  if (infoEntries.length === 0) {
    l.warn('No supported inputs to process')
    return { done: true, result: { ok: 0, partial: 0, incomplete: 0, fail: 0, batchDir } }
  }

  await writeBatchManifest(batchDir, toManifestKind(command), infoEntries, batchSource)
  logLocationsTable(l, [{ artifact: 'batchManifest', path: `${batchDir}/batch.json` }])

  return { done: false, batchDir, batchDirName, batchSource, infoEntries }
}

/**
 * Accumulates per-item outcomes into batch counters and manifest entries, unifying the
 * serial and concurrent execution paths behind a single `applyItemResult`.
 */
const createBatchTallyAccumulator = (
  infoEntries: BatchManifestEntry[],
  resultEntryIndexes: number[]
) => {
  let ok = 0
  let partial = 0
  let incomplete = 0
  let fail = 0
  let failureExitCode: number | undefined
  let hasMixedFailureCodes = false
  const finalInfoEntries = [...infoEntries]
  const partialFailureEntries: BatchManifestErrorEntry[] = []

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
    if (result.manifestEntry) {
      const entryIndex = resultEntryIndexes[index] ?? index
      finalInfoEntries[entryIndex] = {
        ...(finalInfoEntries[entryIndex] ?? {}),
        ...result.manifestEntry
      }
    }
    partialFailureEntries.push(...getBatchManifestErrors(result.manifestEntry))

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
    finalInfoEntries,
    partialFailureEntries,
    tally: (): { ok: number, partial: number, incomplete: number, fail: number } => ({ ok, partial, incomplete, fail }),
    failureExit: (): number | undefined =>
      !hasMixedFailureCodes && failureExitCode !== undefined ? failureExitCode : undefined
  }
}

/**
 * Logs the partial-failure and completion tables and writes the final batch manifest.
 */
const finalizeBatch = async ({
  command,
  batchDir,
  batchSource,
  sttLike,
  acc
}: {
  command: ProcessCommand
  batchDir: string
  batchSource: BatchManifestSummarySource | undefined
  sttLike: boolean
  acc: BatchTallyAccumulator
}): Promise<BatchProcessResult> => {
  const { ok, partial, incomplete, fail } = acc.tally()

  if (acc.partialFailureEntries.length > 0) {
    const partialFailureTable = buildBatchPartialFailureTable(acc.partialFailureEntries)
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

  logBatchCompletionTable(command, ok, partial, incomplete, fail, sttLike)
  if (sttLike) {
    await writeSttBatchManifest(batchDir, acc.finalInfoEntries, batchSource)
  } else {
    await writeBatchManifest(batchDir, toManifestKind(command), acc.finalInfoEntries, batchSource)
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

export const processBatch = async (
  items: string[],
  batchLabel: string,
  command: ProcessCommand,
  opts: RuntimeOptions,
  processSingleTarget: BatchItemProcessor,
  runOpts: BatchRunOptions = {}
): Promise<BatchProcessResult> => {
  const sttLike = command === 'extract' && runOpts.extractRoute === 'media'

  const prepared = await prepareBatchRun(items, batchLabel, command, runOpts)
  if (prepared.done) {
    return prepared.result
  }
  const { batchDir, batchDirName, batchSource, infoEntries } = prepared

  const concurrency = Math.max(1, runOpts.concurrency ?? DEFAULT_CLI_CONCURRENCY)
  const resultEntryIndexes = runOpts.resultEntryIndexes ?? items.map((_, index) => index)
  const acc = createBatchTallyAccumulator(infoEntries, resultEntryIndexes)
  const itemContext: ExecuteBatchItemContext = {
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

  return finalizeBatch({ command, batchDir, batchSource, sttLike, acc })
}
