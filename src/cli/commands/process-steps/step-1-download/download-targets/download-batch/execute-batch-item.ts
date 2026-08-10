import { isSttPartialCompletionError } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/batch'
import type { BatchItemOutcome, ExecuteBatchItemContext } from '~/types'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import { attachOutputDir, getErrorOutputDir, getPipelineItemErrorCount, getPipelineItemStatus, readBatchChildItemRecord } from './pipeline-item-record-state'
import { buildSttBatchItemDetail, logBatchItemStatus } from './download-batch-summary'

const formatProviderFailureDetail = (count: number): string =>
  String(count) + ' provider failure' + (count === 1 ? '' : 's')

/**
 * Runs a single batch item to completion and classifies the result into an ok / partial /
 * incomplete / failed outcome. All errors are caught here: the three catch-classification
 * paths (STT-partial, non-STT `errorOutputDir`, generic) reduce to a resolved outcome so
 * the caller only tallies.
 */
export const executeBatchItem = async <TOptions extends object>(
  ctx: ExecuteBatchItemContext<TOptions>,
  item: string,
  index: number
): Promise<BatchItemOutcome> =>
  await runWithLogContext({ batchId: ctx.batchDirName, itemIndex: index + 1, itemCount: ctx.itemCount }, async () => {
    logBatchItemStatus('info', item, 'processing')

    try {
      const batchItem = ctx.runOpts.selectedItems?.[index]
      const processed = await ctx.processSingleTarget(ctx.command, item, ctx.batchDir, ctx.opts, batchItem)
      const itemRecord = processed?.itemRecord
        ? (processed.outputDir ? attachOutputDir(processed.itemRecord, processed.outputDir) : processed.itemRecord)
        : processed?.outputDir
          ? attachOutputDir(await readBatchChildItemRecord(processed.outputDir, ctx.command), processed.outputDir)
          : null
      const errorCount = getPipelineItemErrorCount(itemRecord)

      if (ctx.sttLike) {
        const completionStatus = getPipelineItemStatus(itemRecord) ?? (errorCount > 0 ? 'incomplete' : 'full')
        if (completionStatus === 'full') {
          logBatchItemStatus('success', item, 'done')
          return { itemRecord, errorCount, status: 'ok' }
        }

        if (completionStatus === 'failed') {
          logBatchItemStatus('error', item, 'failed', 'no STT provider outputs completed')
          return { itemRecord, errorCount, status: 'failed' }
        }

        logBatchItemStatus('warn', item, 'incomplete', buildSttBatchItemDetail(itemRecord))
        return { itemRecord, errorCount, status: 'incomplete' }
      }

      if (errorCount > 0) {
        logBatchItemStatus('warn', item, 'done', formatProviderFailureDetail(errorCount))
        return { itemRecord, errorCount, status: 'partial' }
      }

      logBatchItemStatus('success', item, 'done')
      return { itemRecord, errorCount, status: 'ok' }
    } catch (error) {
      if (ctx.sttLike && isSttPartialCompletionError(error)) {
        const itemRecord = attachOutputDir(await readBatchChildItemRecord(error.outputDir, ctx.command), error.outputDir)
        const errorCount = getPipelineItemErrorCount(itemRecord)
        if (error.completionStatus === 'failed') {
          logBatchItemStatus('error', item, 'failed', error.message)
          return { itemRecord, errorCount, status: 'failed', failureError: error }
        }

        logBatchItemStatus('warn', item, 'incomplete', buildSttBatchItemDetail(itemRecord))
        return { itemRecord, errorCount, status: 'incomplete', failureError: error }
      }

      const errorOutputDir = getErrorOutputDir(error)
      if (errorOutputDir && !ctx.sttLike) {
        const itemRecord = attachOutputDir(await readBatchChildItemRecord(errorOutputDir, ctx.command), errorOutputDir)
        const errorCount = getPipelineItemErrorCount(itemRecord)
        const completionStatus = getPipelineItemStatus(itemRecord) ?? (errorCount > 0 ? 'incomplete' : undefined)

        if (completionStatus === 'failed') {
          logBatchItemStatus('error', item, 'failed', error instanceof Error ? error.message : String(error))
          return { itemRecord, errorCount, status: 'failed', failureError: error }
        }

        if (completionStatus === 'incomplete') {
          logBatchItemStatus('warn', item, 'done', formatProviderFailureDetail(errorCount))
          return { itemRecord, errorCount, status: 'partial', failureError: error }
        }
      }

      const message = error instanceof Error ? error.message : String(error)
      logBatchItemStatus('error', item, 'failed', message)
      return { itemRecord: null, errorCount: 0, status: 'failed', failureError: error }
    }
  })
