import { partialCompletionError } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-batch-state'
import { isRecord } from '~/utils/rest-client'
import { join, resolve as resolvePath } from 'node:path'
import * as l from '~/utils/app-logger/app-logger'
import { createHumanTable } from '~/utils/app-logger/human-table/human-table'
import type { AggregatedPriceEstimate, NormalizedResumeProviderBatchRunOptions, PipelineItemRecord, ProviderResumePassResult, ResumeDisplayOptions, ResumeProviderBatchRunOptions, ResumeResult, ResumeSttEntry, ResumeTarget, SttExtractionOptions, SttResumePassContext, SttTarget } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { processStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/process-stt'
import { logSttBatchFinalSummary } from '~/cli/commands/process-steps/step-1-download/download-targets/download-batch/download-batch-summary'
import { buildSttBatchSchedulerRows } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-batch/stt-batch-policy'
import { SttBatchCoordinator } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-batch/stt-batch-coordinator'
import {
  buildMissingTargetsFromEntry,
  resolveCanonicalCompletionStatus,
  isSttPartialCompletionError,
  parseStoredRequestedTargets
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-batch/stt-run-state'
import { collectSttTargets, formatSttTargetLabel } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { getStep2ActiveModelsForService } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import { PIPELINE_MANIFEST_FILE, readSinglePipelineItemRecord } from '~/cli/commands/process-steps/pipeline-manifest'
import { YOUTUBE_CAPTIONS_SERVICE } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/youtube-captions'
import { resolveAdditiveResumeProviderSelection } from '../resume-provider-selection'
import { hasResumableProviderTargetWork, priceProviderResumeTarget, providerResumeSourceInput, resolveProviderResumeOutputDir, runProviderResumePass, selectedProviderTargetsComplete, selectedProvidersCompleteResult, toProviderResumeResult, toProviderResumeSource } from '../provider-batch-resume'
import { buildSttEstimatesForTargets } from '~/cli/commands/pricing-orchestration/aggregate-pricing/stt-estimates'


const assertStoredMissingSttTargetsAreActive = (
  targets: readonly SttTarget[]
): void => {
  for (const target of targets) {
    const activeModels = getStep2ActiveModelsForService('stt', target.service)
    if (activeModels?.includes(target.model)) {
      continue
    }

    const nextStep = activeModels && activeModels.length > 0
      ? `Start a new target with an active ${target.service} model.`
      : 'Start a new target with an active STT provider.'
    throw UsageError(
      `Stored STT target ${formatSttTargetLabel(target)} is incomplete, but that model is no longer in the active registry. AutoShow will not substitute a different model because that would change the stored target identity. ${nextStep}`
    )
  }
}

const toSourceFromStep1 = (record: PipelineItemRecord): { url?: string, filePath?: string } => {
  const step1 = isRecord(record['step1']) ? record['step1'] : undefined
  const rawUrl = typeof step1?.['url'] === 'string' ? step1['url'] : undefined
  if (!rawUrl) {
    throw UsageError('Pipeline item record is missing step1.url and cannot be resumed.')
  }

  return toProviderResumeSource(rawUrl)
}

const parseResumeRecord = async (
  record: unknown,
  selectedTargets: SttTarget[] | undefined,
  options: Pick<ResumeProviderBatchRunOptions, 'ignoreUnresumableEntries'>
    & { youtubeCaptions: boolean, currentTargets: SttTarget[] }
): Promise<ResumeSttEntry | undefined> => {
  if (!isRecord(record)) {
    return undefined
  }

  const outputDir = resolveProviderResumeOutputDir(record)
  if (!outputDir) {
    if (options.ignoreUnresumableEntries) {
      l.warn('Skipping STT item record with no resumable output directory', { category: 'pipeline' })
      return undefined
    }
    throw UsageError('Pipeline item record is missing outputDir and could not be matched to an STT output directory.')
  }

  const storedRequestedTargets = parseStoredRequestedTargets(record)
  const storedCaptionOnly = storedRequestedTargets.length === 1
    && storedRequestedTargets[0]?.service === YOUTUBE_CAPTIONS_SERVICE

  const requestedBaseTargets = storedCaptionOnly && !options.youtubeCaptions
    ? []
    : storedRequestedTargets
  const fallbackSelectedTargets = storedCaptionOnly && !options.youtubeCaptions
    ? (selectedTargets && selectedTargets.length > 0 ? selectedTargets : options.currentTargets)
    : selectedTargets

  if (requestedBaseTargets.length === 0 && (!fallbackSelectedTargets || fallbackSelectedTargets.length === 0)) {
    throw UsageError('Could not determine the original STT provider set for this output. Re-run with explicit provider flags.')
  }

  let source: { url?: string, filePath?: string }
  try {
    source = toSourceFromStep1(record)
  } catch (error) {
    if (options.ignoreUnresumableEntries) {
      l.warn(error instanceof Error ? error.message : String(error), { category: 'pipeline' })
      return undefined
    }
    throw error
  }

  const storedMissingTargets = buildMissingTargetsFromEntry(record, requestedBaseTargets)
  assertStoredMissingSttTargetsAreActive(storedMissingTargets)
  const resolvedTargets = resolveAdditiveResumeProviderSelection({
    storedProviders: requestedBaseTargets,
    runnableStoredProviders: storedMissingTargets,
    ...(fallbackSelectedTargets ? { selectedProviders: fallbackSelectedTargets } : {})
  })
  const requestedTargets = resolvedTargets.requestedProviders
  const completionStatus = resolveCanonicalCompletionStatus(record, requestedTargets)

  return {
    outputDir,
    source,
    requestedTargets,
    missingTargets: resolvedTargets.providersToRun,
    completionStatus,
    rawRecord: record
  }
}

const readItemRecord = async (outputDir: string): Promise<PipelineItemRecord> => {
  const record = await readSinglePipelineItemRecord(outputDir, { command: 'extract', extractRoute: 'media' })
  if (!isRecord(record)) {
    throw UsageError(`Invalid STT manifest at ${outputDir}/${PIPELINE_MANIFEST_FILE}`)
  }

  return record
}

const selectedSttTargetsComplete = (
  record: PipelineItemRecord,
  selectedTargets: SttTarget[] | undefined
): boolean => selectedProviderTargetsComplete(
  record,
  selectedTargets,
  parseStoredRequestedTargets,
  buildMissingTargetsFromEntry
)

export const hasResumableSttTargetWork = async (
  target: ResumeTarget,
  selectedTargets: SttTarget[] | undefined,
  options: { youtubeCaptions: boolean, currentTargets: SttTarget[] }
): Promise<boolean> =>
  await hasResumableProviderTargetWork(target, {
    readItemRecord,
    parseRecord: async (record) =>
      await parseResumeRecord(record, selectedTargets, {
        ignoreUnresumableEntries: true,
        ...options
      })
  })

const collectPartialFailureLabels = (
  record: PipelineItemRecord,
  partialFailureLabels: Map<string, number>
): void => {
  const errors = Array.isArray(record['errors'])
    ? record['errors'].filter((value): value is Record<string, unknown> => isRecord(value))
    : []
  for (const failure of errors) {
    if (failure['skipped'] === true) {
      continue
    }
    if (typeof failure['service'] !== 'string' || typeof failure['model'] !== 'string') {
      continue
    }
    const label = formatSttTargetLabel({
      service: failure['service'] as SttTarget['service'],
      model: failure['model']
    })
    partialFailureLabels.set(label, (partialFailureLabels.get(label) ?? 0) + 1)
  }
}

const runResumePass = async (
  target: ResumeTarget,
  opts: SttExtractionOptions,
  selectedTargets: SttTarget[] | undefined,
  options: NormalizedResumeProviderBatchRunOptions & { youtubeCaptions: boolean, currentTargets: SttTarget[] },
  pass: number,
  totalPasses: number,
  displayOptions: ResumeDisplayOptions = {}
): Promise<ProviderResumePassResult> =>
  await runProviderResumePass<SttTarget, ResumeSttEntry, SttResumePassContext, SttExtractionOptions>(
    target,
    opts,
    {
      stepLabel: 'STT',
      processingDetail: 'resuming missing providers',
      readItemRecord,
      parseRecord: async (record) =>
        await parseResumeRecord(record, selectedTargets, options),
      getProviderLabels: (targets) => targets.map(formatSttTargetLabel),
      classifyNoMatchingRecord: (record) =>
        selectedSttTargetsComplete(record, selectedTargets)
          ? 'full'
          : record['completionStatus'] === 'failed' ? 'failed' : 'incomplete',
      createPassContext: ({ parsedEntries }) => ({
        batchCoordinator: parsedEntries.filter((entry) => entry !== undefined).length > 1
          ? new SttBatchCoordinator({ batchConcurrency: opts.batchConcurrency })
          : undefined,
        partialFailureLabels: new Map<string, number>()
      }),
      onNoMatchingRecord: ({ record, context }) => {
        collectPartialFailureLabels(record, context.partialFailureLabels)
      },
      processEntry: async ({ target, opts, entry, context }) => {
        try {
          const outputDir = await processStt(entry.source, target.dir, opts, undefined, {
            outputDir: entry.outputDir,
            requestedTargets: entry.requestedTargets,
            targetsToRun: entry.missingTargets,
            batchCoordinator: context.batchCoordinator
          })

          const record = await readItemRecord(outputDir)
          if (selectedSttTargetsComplete(record, selectedTargets) && record['completionStatus'] !== 'full') {
            return selectedProvidersCompleteResult(outputDir, record)
          }
          return {
            outputDir,
            record,
            completionStatus: 'full',
            detail: 'resume complete',
            level: 'success'
          }
        } catch (error) {
          if (!isSttPartialCompletionError(error)) {
            throw error
          }

          const record = await readItemRecord(error.outputDir)
          if (selectedSttTargetsComplete(record, selectedTargets) && record['completionStatus'] !== 'full') {
            return selectedProvidersCompleteResult(error.outputDir, record)
          }
          return {
            outputDir: error.outputDir,
            record,
            completionStatus: error.completionStatus,
            detail: error.message,
            level: error.completionStatus === 'failed' ? 'error' : 'warn'
          }
        }
      },
      onProcessedResult: ({ result, context }) => {
        if (result.completionStatus !== 'full') {
          collectPartialFailureLabels(result.record, context.partialFailureLabels)
        }
      },
      afterPass: ({ context }) => {
        if (context.partialFailureLabels.size > 0) {
          const rows = [...context.partialFailureLabels.entries()]
            .sort((left, right) => left[0].localeCompare(right[0]))
            .map(([provider, failures]) => ({ provider, failures }))
          l.write('warn', 'Partial provider failures', {
            category: 'pipeline',
            humanTable: createHumanTable(rows, ['provider', 'failures']),
            metadata: { failures: rows }
          })
        }

        if (context.batchCoordinator) {
          const snapshot = context.batchCoordinator.getSchedulerSnapshot()
          if (snapshot.providers.length > 0) {
            const rows = buildSttBatchSchedulerRows(snapshot)
            l.write('info', 'STT batch backfill scheduler summary', {
              category: 'pipeline',
              humanTable: createHumanTable(
                rows,
                ['provider', 'kind', 'launchSlots', 'pollSlots', 'launched', 'completed', 'queueWaitMs', 'polls', 'blocked', 'degraded', 'backfill', 'warm']
              ),
              metadata: { providers: rows }
            })
          }
        }
      }
    },
    pass,
    totalPasses,
    displayOptions
  )

const runResumeSttTarget = async (
  target: ResumeTarget,
  opts: SttExtractionOptions,
  selectedTargets?: SttTarget[],
  runOptions: ResumeProviderBatchRunOptions = {},
  displayOptions: ResumeDisplayOptions = {}
): Promise<ProviderResumePassResult> => {
  const currentTargets = selectedTargets && selectedTargets.length > 0 ? selectedTargets : collectSttTargets(opts)
  const normalizedOptions: NormalizedResumeProviderBatchRunOptions = {
    maxPasses: Math.max(1, runOptions.maxPasses ?? 1),
    ignoreUnresumableEntries: runOptions.ignoreUnresumableEntries === true
  }

  let result = await runResumePass(target, opts, selectedTargets, {
    ...normalizedOptions,
    youtubeCaptions: opts.youtubeCaptions,
    currentTargets
  }, 1, normalizedOptions.maxPasses, displayOptions)

  for (let pass = 2; pass <= normalizedOptions.maxPasses; pass++) {
    if (result.incomplete === 0 && result.fail === 0) {
      break
    }
    if (result.attemptedEntries === 0) {
      break
    }
    result = await runResumePass(target, opts, selectedTargets, {
      ...normalizedOptions,
      youtubeCaptions: opts.youtubeCaptions,
      currentTargets
    }, pass, normalizedOptions.maxPasses, displayOptions)
  }

  return result
}

export const runResumeSttMissingFromBatchDir = async (
  batchDirInput: string,
  opts: SttExtractionOptions,
  selectedTargets?: SttTarget[],
  runOptions: ResumeProviderBatchRunOptions = {}
): Promise<ProviderResumePassResult> =>
  await runResumeSttTarget({
    kind: 'extract',
    extractRoute: 'media',
    scope: 'batch',
    dir: resolvePath(batchDirInput),
    manifestPath: join(resolvePath(batchDirInput), PIPELINE_MANIFEST_FILE)
  }, opts, selectedTargets, runOptions)

export const resumeSttTarget = async (
  target: ResumeTarget,
  opts: SttExtractionOptions,
  selectedTargets?: SttTarget[],
  displayOptions: ResumeDisplayOptions = {}
): Promise<ResumeResult> => {
  const result = await runResumeSttTarget(target, opts, selectedTargets, {}, displayOptions)
  if (target.scope === 'batch' && result.batchDir) {
    await logSttBatchFinalSummary(result.batchDir)
  }
  if (result.incomplete > 0 || result.fail > 0) {
    throw partialCompletionError(`STT resume still has ${result.incomplete} incomplete and ${result.fail} failed item(s)`, {
      stage: 'resume:stt',
      metadata: { incomplete: result.incomplete, failed: result.fail }
    })
  }
  return toProviderResumeResult(result)
}

export const priceSttTarget = async (
  target: ResumeTarget,
  opts: SttExtractionOptions,
  selectedTargets?: SttTarget[]
): Promise<AggregatedPriceEstimate> => {
  const currentTargets = selectedTargets && selectedTargets.length > 0 ? selectedTargets : collectSttTargets(opts)
  return await priceProviderResumeTarget<SttTarget, ResumeSttEntry, SttExtractionOptions>(target, opts, {
    stepLabel: 'STT',
    readItemRecord,
    parseRecord: (record) => parseResumeRecord(record, selectedTargets, {
      ignoreUnresumableEntries: false,
      youtubeCaptions: opts.youtubeCaptions,
      currentTargets
    }),
    buildEstimates: (entry, estimateOpts) =>
      buildSttEstimatesForTargets(
        providerResumeSourceInput(entry.source, 'STT'),
        estimateOpts,
        entry.missingTargets
      )
  })
}
