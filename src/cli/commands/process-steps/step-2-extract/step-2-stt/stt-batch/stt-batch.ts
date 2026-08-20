import * as l from '~/utils/app-logger/app-logger'
import { createHumanTable } from '~/utils/app-logger/human-table/human-table'
import type { BatchProcessResult, BatchRunOptions, SttExtractionOptions } from '~/types'
import { collectSttTargets } from '../stt-targets'
import { buildSttBatchSchedulerRows } from './stt-batch-policy'
import { SttBatchCoordinator } from './stt-batch-coordinator'
import { runResumeSttMissingFromBatchDir } from '~/cli/commands/setup-and-utilities/resume/extract/stt-resume'
import { logSttBatchFinalSummary } from '~/cli/commands/process-steps/step-1-download/download-targets/download-batch/download-batch-summary'
import { processBatch } from '~/cli/commands/process-steps/step-1-download/download-targets/download-batch/process-download-batch'
import { isLikelyUrl } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-classifier'
import { processStt } from '../process-stt'
import { createMistralSttPassController } from '../stt-services/stt-mistral/mistral-stt-pass-controller'
import { partialCompletionError } from '../../step-2-shared/provider-batch-state'

// Was a separate error hierarchy duplicating ProviderBatchCompletionError's job; it now
// uses the one shared "partial completion -> exit 2" spelling, with the counts as metadata.
const sttBatchIncompleteError = (result: BatchProcessResult) => partialCompletionError(
  `STT batch incomplete: ${result.ok} full, ${result.incomplete} incomplete, ${result.fail} failed${result.batchDir ? `. See ${result.batchDir}` : ''}`,
  {
    stage: 'stt:batch',
    metadata: {
      ...(result.batchDir ? { batchDir: result.batchDir } : {}),
      full: result.ok,
      incomplete: result.incomplete,
      failed: result.fail
    }
  }
)

const shouldEnableCoordinator = (
  items: string[],
  opts: SttExtractionOptions
): boolean => items.length > 1 && collectSttTargets(opts).length > 1

export const runSttBatch = async (
  items: string[],
  batchLabel: string,
  opts: SttExtractionOptions,
  runOpts: BatchRunOptions = {}
): Promise<BatchProcessResult> => {
  const requestedTargets = collectSttTargets(opts)
  const coordinator = shouldEnableCoordinator(items, opts)
    ? new SttBatchCoordinator({ batchConcurrency: opts.batchConcurrency })
    : undefined
  const mistralPassController = requestedTargets.some((target) => target.service === 'mistral')
    ? createMistralSttPassController()
    : undefined

  let result = await processBatch(
    items,
    batchLabel,
    'extract',
    opts,
    async (_command, item, batchDir, batchOpts, batchItem) => ({
      outputDir: await processStt(
        isLikelyUrl(item) ? { url: item } : { filePath: item },
        batchDir,
        batchOpts,
        undefined,
        {
          ...(coordinator ? { batchCoordinator: coordinator } : {}),
          ...(mistralPassController ? { mistralPassController } : {}),
          batchChildContext: {
            batchDir,
            ...(batchItem ? { batchItem } : {})
          }
        }
      )
    }),
    {
      ...runOpts,
      extractRoute: 'media'
    }
  )

  if (coordinator && result.batchDir && (result.incomplete > 0 || result.fail > 0)) {
    l.warn(`Starting automatic STT batch backfill for missing providers: ${result.batchDir}`)
    result = await runResumeSttMissingFromBatchDir(result.batchDir, opts, undefined, {
      maxPasses: 1,
      ignoreUnresumableEntries: true
    })
  }

  if (coordinator) {
    const snapshot = coordinator.getSchedulerSnapshot()
    if (snapshot.providers.length > 0) {
      const rows = buildSttBatchSchedulerRows(snapshot)
      l.write('info', 'STT batch scheduler summary', {
        category: 'pipeline',
        humanTable: createHumanTable(
          rows,
          ['provider', 'kind', 'launchSlots', 'pollSlots', 'launched', 'completed', 'queueWaitMs', 'polls', 'blocked', 'degraded', 'backfill', 'warm']
        ),
        metadata: { providers: rows }
      })
    }
  }

  if (result.batchDir) {
    await logSttBatchFinalSummary(result.batchDir)
  }

  return result
}

export const throwIfSttBatchIncomplete = (
  result: BatchProcessResult
): void => {
  if (result.incomplete > 0 || result.fail > 0) {
    throw sttBatchIncompleteError(result)
  }
}
