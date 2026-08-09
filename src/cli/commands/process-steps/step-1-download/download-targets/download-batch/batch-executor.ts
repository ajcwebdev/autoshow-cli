import { join, relative } from 'node:path'
import * as l from '~/utils/app-logger/app-logger'
import { logLocationsTable } from '~/utils/app-logger/human-table/human-table'
import { ensureDirectory } from '~/utils/cli-utils'
import { resolveRunDirectory } from '~/cli/commands/process-steps/run-dir'
import { isExtractCommand } from '~/cli/commands/process-steps/process-command-kinds'
import { readBatchManifest, writeExtractBatchManifest } from '~/cli/commands/process-steps/manifest-utils'
import { getOutputRoot } from '~/cli/commands/process-steps/output-root'
import { runSttBatch, throwIfSttBatchIncomplete } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/batch'
import type { BatchExecutionPlan, BatchManifestEntry, BatchProcessResult, BatchSource, ExtractBatchManifest, ExtractChildBatchPlan, ExtractRoute, ProcessCommand, RuntimeOptions } from '~/types'
import { processSingleTarget } from '../single/single-target-runner'
import { processBatch } from './process-download-batch'

const createExtractChildBatchPlan = (
  route: ExtractRoute
): ExtractChildBatchPlan => ({
  route,
  items: [],
  initialEntries: [],
  resultEntryIndexes: [],
  parentIndexes: []
})

const isBatchEntryCompletionStatus = (
  value: unknown
): value is ExtractBatchManifest['items'][number]['completionStatus'] =>
  value === 'full' || value === 'incomplete' || value === 'failed' || value === 'skipped'

const toRelativeOutputDir = (
  batchDir: string,
  outputDir: unknown
): string | undefined => {
  if (typeof outputDir !== 'string' || outputDir.length === 0) {
    return undefined
  }

  const relativePath = relative(batchDir, outputDir)
  return relativePath.length > 0 ? relativePath : '.'
}

const partitionExtractBatchPlan = (
  batchPlan: BatchExecutionPlan
): {
  childPlans: Record<ExtractRoute, ExtractChildBatchPlan>
  manifestItems: ExtractBatchManifest['items']
} => {
  const childPlans: Record<ExtractRoute, ExtractChildBatchPlan> = {
    media: createExtractChildBatchPlan('media'),
    document: createExtractChildBatchPlan('document'),
    article: createExtractChildBatchPlan('article'),
    'x-space': createExtractChildBatchPlan('x-space')
  }
  const manifestItems: ExtractBatchManifest['items'] = []
  let runnableIndex = 0

  for (const [index, plannedInput] of batchPlan.plannedInputs.entries()) {
    const initialEntry = batchPlan.initialEntries[index] as BatchManifestEntry | undefined
    const extractRoute = plannedInput.extractRoute

    if (!extractRoute || batchPlan.items[runnableIndex] === undefined) {
      manifestItems.push({
        input: plannedInput.input,
        inputFamily: plannedInput.inputFamily,
        completionStatus: 'skipped',
        ...(typeof initialEntry?.['skipReason'] === 'string' ? { skipReason: initialEntry['skipReason'] } : {})
      })
      continue
    }

    const childPlan = childPlans[extractRoute]
    const selectedItem = batchPlan.selectedItems?.[runnableIndex]
    childPlan.items.push(batchPlan.items[runnableIndex] as string)
    childPlan.initialEntries.push((initialEntry ?? {}) as Record<string, unknown>)
    childPlan.resultEntryIndexes.push(childPlan.initialEntries.length - 1)
    childPlan.parentIndexes.push(index)
    if (batchPlan.selectedItems) {
      childPlan.selectedItems ??= []
      childPlan.selectedItems.push(selectedItem)
    }

    manifestItems.push({
      input: plannedInput.input,
      inputFamily: plannedInput.inputFamily,
      extractRoute,
      completionStatus: 'incomplete'
    })
    runnableIndex += 1
  }

  return { childPlans, manifestItems }
}

const runExtractDocumentChildBatch = async (
  batchDir: string,
  opts: RuntimeOptions,
  batchPlan: ExtractChildBatchPlan,
  source?: BatchSource
): Promise<BatchProcessResult> =>
  await processBatch(
    batchPlan.items,
    batchPlan.route,
    'extract',
    opts,
    async (commandName, item, childBatchDir, batchOpts, batchItem) =>
      await processSingleTarget(commandName, item, childBatchDir, batchOpts, undefined, {
        batchChildContext: {
          batchDir: childBatchDir,
          ...(batchItem ? { batchItem } : {})
        }
      }, batchItem),
    {
      ...(source ? { source } : {}),
      ...(batchPlan.selectedItems ? { selectedItems: batchPlan.selectedItems } : {}),
      initialEntries: batchPlan.initialEntries,
      resultEntryIndexes: batchPlan.resultEntryIndexes,
      concurrency: opts.batchConcurrency,
      parentBatchDir: batchDir,
      extractRoute: batchPlan.route
    }
  )

const runExtractXSpaceChildBatch = async (
  batchDir: string,
  opts: RuntimeOptions,
  batchPlan: ExtractChildBatchPlan,
  source?: BatchSource
): Promise<BatchProcessResult> =>
  await processBatch(
    batchPlan.items,
    batchPlan.route,
    'extract',
    opts,
    async (_commandName, item, childBatchDir, batchOpts, batchItem) =>
      await processSingleTarget('extract', item, childBatchDir, batchOpts, undefined, {
        batchChildContext: {
          batchDir: childBatchDir,
          ...(batchItem ? { batchItem } : {})
        }
      }, batchItem),
    {
      ...(source ? { source } : {}),
      ...(batchPlan.selectedItems ? { selectedItems: batchPlan.selectedItems } : {}),
      initialEntries: batchPlan.initialEntries,
      resultEntryIndexes: batchPlan.resultEntryIndexes,
      concurrency: opts.batchConcurrency,
      parentBatchDir: batchDir,
      extractRoute: batchPlan.route
    }
  )

const executeExtractBatchPlan = async (
  opts: RuntimeOptions,
  batchPlan: BatchExecutionPlan
): Promise<void> => {
  const batchDir = resolveRunDirectory(getOutputRoot(), batchPlan.label, 'batch')
  await ensureDirectory(batchDir)
  logLocationsTable(l, [{ artifact: 'outputDir', path: batchDir }])

  const { childPlans, manifestItems } = partitionExtractBatchPlan(batchPlan)
  const childBatches = {
    ...(childPlans.media.items.length > 0 ? { media: 'media' } : {}),
    ...(childPlans.document.items.length > 0 ? { document: 'document' } : {}),
    ...(childPlans.article.items.length > 0 ? { article: 'article' } : {}),
    ...(childPlans['x-space'].items.length > 0 ? { 'x-space': 'x-space' } : {})
  }

  const initialManifest: ExtractBatchManifest = {
    schemaVersion: 3,
    createdAt: new Date().toISOString(),
    items: manifestItems,
    childBatches
  }

  await writeExtractBatchManifest(batchDir, initialManifest)
  logLocationsTable(l, [{ artifact: 'extractBatchManifest', path: `${batchDir}/extract-batch.json` }])

  if (childPlans.media.items.length === 0 && childPlans.document.items.length === 0 && childPlans.article.items.length === 0 && childPlans['x-space'].items.length === 0) {
    l.warn('No supported inputs to process')
    return
  }

  const [sttResult, ocrResult, articleResult, xSpaceResult] = await Promise.all([
    childPlans.media.items.length > 0
      ? runSttBatch(childPlans.media.items, childPlans.media.route, opts, {
          ...(batchPlan.source ? { source: batchPlan.source } : {}),
          ...(childPlans.media.selectedItems ? { selectedItems: childPlans.media.selectedItems } : {}),
          initialEntries: childPlans.media.initialEntries,
          resultEntryIndexes: childPlans.media.resultEntryIndexes,
          concurrency: opts.batchConcurrency,
          parentBatchDir: batchDir,
          extractRoute: 'media'
        })
      : Promise.resolve(undefined),
    childPlans.document.items.length > 0
      ? runExtractDocumentChildBatch(batchDir, opts, childPlans.document, batchPlan.source)
      : Promise.resolve(undefined),
    childPlans.article.items.length > 0
      ? runExtractDocumentChildBatch(batchDir, opts, childPlans.article, batchPlan.source)
      : Promise.resolve(undefined),
    childPlans['x-space'].items.length > 0
      ? runExtractXSpaceChildBatch(batchDir, opts, childPlans['x-space'], batchPlan.source)
      : Promise.resolve(undefined)
  ])

  const finalItems = initialManifest.items.map((item) => ({ ...item }))
  for (const route of ['media', 'document', 'article', 'x-space'] as const) {
    const childPlan = childPlans[route]
    if (childPlan.items.length === 0) {
      continue
    }

    const childManifest = await readBatchManifest(join(batchDir, route), 'extract')
    const childEntries = childManifest?.manifest.items ?? []

    childPlan.parentIndexes.forEach((parentIndex, childIndex) => {
      const existingItem = finalItems[parentIndex]
      if (!existingItem) {
        return
      }

      const childEntry = childEntries[childIndex] as BatchManifestEntry | undefined
      const outputDir = toRelativeOutputDir(batchDir, childEntry?.['outputDir'])
      finalItems[parentIndex] = {
        ...existingItem,
        extractRoute: route,
        childBatchEntry: { route, index: childIndex },
        completionStatus: isBatchEntryCompletionStatus(childEntry?.['completionStatus'])
          ? childEntry['completionStatus']
          : 'failed',
        ...(typeof childEntry?.['skipReason'] === 'string' ? { skipReason: childEntry['skipReason'] } : {}),
        ...(outputDir ? { outputDir } : {})
      }
    })
  }

  await writeExtractBatchManifest(batchDir, {
    ...initialManifest,
    items: finalItems
  })

  if (sttResult) {
    throwIfSttBatchIncomplete(sttResult)
  }

  if (ocrResult && ocrResult.ok === 0 && ocrResult.fail > 0) {
    const error = new Error(`Batch processing failed for ${ocrResult.fail} item(s)`)
    if (ocrResult.failureExitCode !== undefined) {
      ;(error as Error & { exitCode?: number }).exitCode = ocrResult.failureExitCode
    }
    throw error
  }

  if (articleResult && articleResult.ok === 0 && articleResult.fail > 0) {
    const error = new Error(`Article batch processing failed for ${articleResult.fail} item(s)`)
    if (articleResult.failureExitCode !== undefined) {
      ;(error as Error & { exitCode?: number }).exitCode = articleResult.failureExitCode
    }
    throw error
  }

  if (xSpaceResult && xSpaceResult.ok === 0 && xSpaceResult.fail > 0) {
    const error = new Error(`X Space batch processing failed for ${xSpaceResult.fail} item(s)`)
    if (xSpaceResult.failureExitCode !== undefined) {
      ;(error as Error & { exitCode?: number }).exitCode = xSpaceResult.failureExitCode
    }
    throw error
  }
}

export const executeBatchPlan = async (
  command: ProcessCommand,
  opts: RuntimeOptions,
  batchPlan: BatchExecutionPlan
): Promise<void> => {
  if (isExtractCommand(command)) {
    await executeExtractBatchPlan(opts, batchPlan)
    return
  }

  const { ok, fail, failureExitCode } = await processBatch(
    batchPlan.items,
    batchPlan.label,
    command,
    opts,
    async (commandName, item, batchDir, batchOpts, batchItem) =>
      await processSingleTarget(commandName, item, batchDir, batchOpts, undefined, {
        batchChildContext: {
          batchDir,
          ...(batchItem ? { batchItem } : {})
        }
      }, batchItem),
    {
      ...(batchPlan.source ? { source: batchPlan.source } : {}),
      ...(batchPlan.selectedItems ? { selectedItems: batchPlan.selectedItems } : {}),
      ...(typeof batchPlan.totalCount === 'number' ? { totalCount: batchPlan.totalCount } : {}),
      initialEntries: batchPlan.initialEntries,
      resultEntryIndexes: batchPlan.resultEntryIndexes,
      concurrency: opts.batchConcurrency
    }
  )

  if (ok === 0 && fail > 0) {
    const error = new Error(`Batch processing failed for ${fail} item(s)`)
    if (failureExitCode !== undefined) {
      ;(error as Error & { exitCode?: number }).exitCode = failureExitCode
    }
    throw error
  }
}
