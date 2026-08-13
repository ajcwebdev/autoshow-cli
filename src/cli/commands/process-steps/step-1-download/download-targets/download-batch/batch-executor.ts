import { join } from 'node:path'
import * as l from '~/utils/app-logger/app-logger'
import { logLocationsTable } from '~/utils/app-logger/human-table/human-table'
import { ensureDirectory } from '~/utils/cli-utils'
import { resolveRunDirectory } from '~/cli/commands/process-steps/run-dir'
import { isExtractCommand } from '~/cli/commands/process-steps/process-command-kinds'
import { createManifest, createManifestItem, PIPELINE_MANIFEST_FILE, readManifest, resolveManifestRelativePath, toManifestRelativePath, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { getOutputRoot } from '~/cli/commands/process-steps/output-root'
import { runSttBatch, throwIfSttBatchIncomplete } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/batch'
import type { BatchExecutionPlan, BatchProcessResult, BatchRuntimeOptions, BatchSource, ExtractChildBatchPlan, ExtractCommandOptions, ExtractRoute, PipelineItemRecord, PipelineManifest, PipelineManifestItem, ProcessCommand, SingleTargetCommandOptions } from '~/types'
import { processSingleTarget } from '../single/single-target-runner'
import { processBatch } from './process-download-batch'
import { CLIUsageError } from '~/utils/error-handler'
import { createHostedOcrScheduler } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-scheduler'

type BatchCommandOptions = SingleTargetCommandOptions & Pick<BatchRuntimeOptions, 'batchConcurrency'>

function assertExtractCommandOptions (
  opts: BatchCommandOptions
): asserts opts is ExtractCommandOptions {
  if (!('whisperModel' in opts) || !('step2SelectionOrigins' in opts)) {
    throw new Error('Extract command options are incomplete')
  }
}

const createExtractChildBatchPlan = (
  route: ExtractRoute
): ExtractChildBatchPlan => ({
  route,
  items: [],
  initialRecords: [],
  resultEntryIndexes: [],
  parentIndexes: []
})

const partitionExtractBatchPlan = (
  batchDir: string,
  batchPlan: BatchExecutionPlan
): {
  childPlans: Record<ExtractRoute, ExtractChildBatchPlan>
  manifestItems: PipelineManifestItem[]
} => {
  const childPlans: Record<ExtractRoute, ExtractChildBatchPlan> = {
    media: createExtractChildBatchPlan('media'),
    document: createExtractChildBatchPlan('document'),
    article: createExtractChildBatchPlan('article'),
    'x-space': createExtractChildBatchPlan('x-space')
  }
  const manifestItems: PipelineManifestItem[] = []
  let runnableIndex = 0

  for (const [index, plannedInput] of batchPlan.plannedInputs.entries()) {
    const initialRecord = batchPlan.initialRecords[index] as PipelineItemRecord | undefined
    const extractRoute = plannedInput.extractRoute

    if (!extractRoute || batchPlan.items[runnableIndex] === undefined) {
      manifestItems.push(createManifestItem(batchDir, {
        input: plannedInput.input,
        inputFamily: plannedInput.inputFamily,
        status: 'skipped',
        metadata: typeof initialRecord?.['skipReason'] === 'string'
          ? { skipReason: initialRecord['skipReason'] }
          : {}
      }))
      continue
    }

    const childPlan = childPlans[extractRoute]
    const childIndex = childPlan.initialRecords.length
    const selectedItem = batchPlan.selectedItems?.[runnableIndex]
    childPlan.items.push(batchPlan.items[runnableIndex] as string)
    childPlan.initialRecords.push(initialRecord ?? {})
    childPlan.resultEntryIndexes.push(childPlan.initialRecords.length - 1)
    childPlan.parentIndexes.push(index)
    if (batchPlan.selectedItems) {
      childPlan.selectedItems ??= []
      childPlan.selectedItems.push(selectedItem)
    }

    manifestItems.push(createManifestItem(batchDir, {
      input: plannedInput.input,
      inputFamily: plannedInput.inputFamily,
      extractRoute,
      child: {
        route: extractRoute,
        index: childIndex,
        manifestDir: join(batchDir, extractRoute)
      },
      status: 'incomplete',
      metadata: {}
    }))
    runnableIndex += 1
  }

  return { childPlans, manifestItems }
}

const readExtractChildManifest = async (
  batchDir: string,
  route: ExtractRoute
): Promise<{ childDir: string, manifest: PipelineManifest }> => {
  const childDir = join(batchDir, route)
  const manifest = await readManifest(childDir)
  if (!manifest) {
    throw CLIUsageError(`Missing canonical child manifest at ${join(childDir, PIPELINE_MANIFEST_FILE)}.`)
  }
  if (manifest.command !== 'extract' || manifest.scope !== 'batch') {
    throw CLIUsageError(`Invalid extract child manifest at ${join(childDir, PIPELINE_MANIFEST_FILE)}.`)
  }
  return { childDir, manifest }
}

const runExtractDocumentChildBatch = async (
  batchDir: string,
  opts: ExtractCommandOptions,
  batchPlan: ExtractChildBatchPlan,
  source?: BatchSource
): Promise<BatchProcessResult> => {
  const hostedOcrScheduler = batchPlan.route === 'document'
    ? createHostedOcrScheduler({
        mode: opts.ocrConcurrencyMode ?? (typeof opts.ocrConcurrency === 'number' ? 'fixed' : 'auto'),
        fixedCap: opts.ocrConcurrency,
        pageCount: 0,
        lifetime: 'run'
      })
    : undefined
  const result = await processBatch(
    batchPlan.items,
    batchPlan.route,
    'extract',
    opts,
    async (commandName, item, childBatchDir, batchOpts, batchItem) =>
      await processSingleTarget(commandName, item, childBatchDir, batchOpts, undefined, {
        batchChildContext: {
          batchDir: childBatchDir,
          ...(hostedOcrScheduler ? { hostedOcrScheduler } : {}),
          ...(batchItem ? { batchItem } : {})
        }
      }, batchItem),
    {
      ...(source ? { source } : {}),
      ...(batchPlan.selectedItems ? { selectedItems: batchPlan.selectedItems } : {}),
      initialRecords: batchPlan.initialRecords,
      resultEntryIndexes: batchPlan.resultEntryIndexes,
      concurrency: opts.batchConcurrency,
      parentBatchDir: batchDir,
      extractRoute: batchPlan.route
    }
  )
  return result
}

const runExtractXSpaceChildBatch = async (
  batchDir: string,
  opts: ExtractCommandOptions,
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
      initialRecords: batchPlan.initialRecords,
      resultEntryIndexes: batchPlan.resultEntryIndexes,
      concurrency: opts.batchConcurrency,
      parentBatchDir: batchDir,
      extractRoute: batchPlan.route
    }
  )

const executeExtractBatchPlan = async (
  opts: ExtractCommandOptions,
  batchPlan: BatchExecutionPlan
): Promise<void> => {
  const batchDir = resolveRunDirectory(getOutputRoot(), batchPlan.label, 'batch')
  await ensureDirectory(batchDir)
  logLocationsTable(l, [{ artifact: 'outputDir', path: batchDir }])

  const { childPlans, manifestItems } = partitionExtractBatchPlan(batchDir, batchPlan)
  const source = batchPlan.source
    ? {
        sourceKind: batchPlan.source.sourceKind,
        sourceUrl: batchPlan.source.sourceUrl,
        ...(batchPlan.source.title ? { title: batchPlan.source.title } : {}),
        ...(batchPlan.source.author ? { author: batchPlan.source.author } : {}),
        selectedCount: batchPlan.plannedInputs.length
      }
    : undefined
  const initialManifest = createManifest('extract', 'batch', manifestItems, source)

  await writeManifest(batchDir, initialManifest)
  logLocationsTable(l, [{ artifact: 'manifest', path: `${batchDir}/${PIPELINE_MANIFEST_FILE}` }])

  if (childPlans.media.items.length === 0 && childPlans.document.items.length === 0 && childPlans.article.items.length === 0 && childPlans['x-space'].items.length === 0) {
    l.warn('No supported inputs to process')
    return
  }

  const [sttResult, ocrResult, articleResult, xSpaceResult] = await Promise.all([
    childPlans.media.items.length > 0
      ? runSttBatch(childPlans.media.items, childPlans.media.route, opts, {
          ...(batchPlan.source ? { source: batchPlan.source } : {}),
          ...(childPlans.media.selectedItems ? { selectedItems: childPlans.media.selectedItems } : {}),
          initialRecords: childPlans.media.initialRecords,
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

    const { childDir, manifest: childManifest } = await readExtractChildManifest(batchDir, route)

    childPlan.parentIndexes.forEach((parentIndex, childIndex) => {
      const existingItem = finalItems[parentIndex]
      if (!existingItem) {
        return
      }

      const childEntry = childManifest.items[childIndex]
      if (!childEntry) {
        throw CLIUsageError(`Canonical child manifest ${join(childDir, PIPELINE_MANIFEST_FILE)} is missing item ${childIndex}.`)
      }
      if (childEntry.extractRoute !== route) {
        throw CLIUsageError(`Canonical child manifest ${join(childDir, PIPELINE_MANIFEST_FILE)} item ${childIndex} has route ${childEntry.extractRoute ?? 'missing'}, expected ${route}.`)
      }
      const outputDir = childEntry.outputDir === undefined
        ? undefined
        : toManifestRelativePath(batchDir, resolveManifestRelativePath(childDir, childEntry.outputDir))
      finalItems[parentIndex] = {
        ...existingItem,
        status: childEntry.status,
        ...(outputDir ? { outputDir } : {})
      }
    })
  }

  await writeManifest(batchDir, {
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
  opts: BatchCommandOptions,
  batchPlan: BatchExecutionPlan
): Promise<void> => {
  if (isExtractCommand(command)) {
    assertExtractCommandOptions(opts)
    await executeExtractBatchPlan(opts, batchPlan)
    return
  }

  const hostedOcrScheduler = command === 'write'
    ? createHostedOcrScheduler({
        mode: 'ocrConcurrencyMode' in opts && opts.ocrConcurrencyMode
          ? opts.ocrConcurrencyMode
          : 'ocrConcurrency' in opts && typeof opts.ocrConcurrency === 'number'
            ? 'fixed'
            : 'auto',
        fixedCap: 'ocrConcurrency' in opts && typeof opts.ocrConcurrency === 'number' ? opts.ocrConcurrency : undefined,
        pageCount: 0,
        lifetime: 'run'
      })
    : undefined
  const batchResult = await processBatch(
    batchPlan.items,
    batchPlan.label,
    command,
    opts,
    async (commandName, item, batchDir, batchOpts, batchItem) =>
      await processSingleTarget(commandName, item, batchDir, batchOpts, undefined, {
        batchChildContext: {
          batchDir,
          ...(hostedOcrScheduler ? { hostedOcrScheduler } : {}),
          ...(batchItem ? { batchItem } : {})
        }
      }, batchItem),
    {
      ...(batchPlan.source ? { source: batchPlan.source } : {}),
      ...(batchPlan.selectedItems ? { selectedItems: batchPlan.selectedItems } : {}),
      ...(typeof batchPlan.totalCount === 'number' ? { totalCount: batchPlan.totalCount } : {}),
      initialRecords: batchPlan.initialRecords,
      resultEntryIndexes: batchPlan.resultEntryIndexes,
      concurrency: opts.batchConcurrency
    }
  )
  const { ok, fail, failureExitCode } = batchResult

  if (ok === 0 && fail > 0) {
    const error = new Error(`Batch processing failed for ${fail} item(s)`)
    if (failureExitCode !== undefined) {
      ;(error as Error & { exitCode?: number }).exitCode = failureExitCode
    }
    throw error
  }
}
