import { join, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as l from '~/utils/app-logger/app-logger'
import { createHumanTable } from '~/utils/app-logger/human-table/human-table'
import type { AggregatedPriceEstimate, BatchManifestEntry, NormalizedResumeProviderBatchRunOptions, ProviderResumePassResult, ResumeDisplayOptions, ResumeProviderBatchRunOptions, ResumeResult, ResumeSttEntry, ResumeTarget, RuntimeOptions, StepEstimate, SttResumePassContext, SttTarget } from '~/types'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import { processStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/process-stt'
import { logSttBatchFinalSummary } from '~/cli/commands/process-steps/step-1-download/download-targets/download-batch/download-batch-summary'
import { buildSttBatchSchedulerRows } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-batch/stt-batch-policy'
import { SttBatchCoordinator } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-batch/stt-batch-coordinator'
import {
  buildMissingTargetsFromEntry,
  inferStoredCompletionStatus,
  isSttPartialCompletionError,
  parseStoredRequestedTargets
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-batch/stt-run-state'
import { collectSttTargets, formatSttTargetLabel } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { readSttRunManifestEntry, writeSttBatchManifest, writeSttRunManifest } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-manifest'
import { YOUTUBE_CAPTIONS_SERVICE } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/youtube-captions'
import { resolveAdditiveResumeProviderSelection } from '../resume-provider-selection'
import { hasResumableProviderTargetWork, readProviderResumeTargetManifest, runProviderResumePass } from '../provider-batch-resume'
import { aggregateExplicitPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import { buildSttEstimatesForTargets } from '~/utils/pricing/aggregate-pricing/stt-estimates'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toSourceFromStep1 = (entry: Record<string, unknown>): { url?: string, filePath?: string } => {
  const step1 = isRecord(entry['step1']) ? entry['step1'] : undefined
  const rawUrl = typeof step1?.['url'] === 'string' ? step1['url'] : undefined
  if (!rawUrl) {
    throw CLIUsageError('Batch entry is missing step1.url and cannot be resumed.')
  }

  if (rawUrl.startsWith('file://')) {
    try {
      return { filePath: fileURLToPath(rawUrl) }
    } catch {
      return { filePath: decodeURIComponent(rawUrl.replace(/^file:\/\/+/, '/')) }
    }
  }

  return { url: rawUrl }
}

const resolveStoredOutputDir = async (
  entry: Record<string, unknown>
): Promise<string | undefined> => {
  if (typeof entry['outputDir'] === 'string' && entry['outputDir'].length > 0) {
    return resolvePath(entry['outputDir'])
  }
  return undefined
}

const parseResumeEntry = async (
  entry: unknown,
  selectedTargets: SttTarget[] | undefined,
  options: Pick<ResumeProviderBatchRunOptions, 'ignoreUnresumableEntries'>
    & { youtubeCaptions: boolean, currentTargets: SttTarget[] }
): Promise<ResumeSttEntry | undefined> => {
  if (!isRecord(entry)) {
    return undefined
  }

  const outputDir = await resolveStoredOutputDir(entry)
  if (!outputDir) {
    if (options.ignoreUnresumableEntries) {
      l.warn('Skipping STT entry with no resumable output directory')
      return undefined
    }
    throw CLIUsageError('Run entry is missing outputDir and could not be matched to an STT output directory.')
  }

  const storedRequestedTargets = parseStoredRequestedTargets(entry)
  const storedCaptionOnly = storedRequestedTargets.length === 1
    && storedRequestedTargets[0]?.service === YOUTUBE_CAPTIONS_SERVICE

  const requestedBaseTargets = storedCaptionOnly && !options.youtubeCaptions
    ? []
    : storedRequestedTargets
  const fallbackSelectedTargets = storedCaptionOnly && !options.youtubeCaptions
    ? (selectedTargets && selectedTargets.length > 0 ? selectedTargets : options.currentTargets)
    : selectedTargets

  if (requestedBaseTargets.length === 0 && (!fallbackSelectedTargets || fallbackSelectedTargets.length === 0)) {
    throw CLIUsageError('Could not determine the original STT provider set for this output. Re-run with explicit provider flags.')
  }

  let source: { url?: string, filePath?: string }
  try {
    source = toSourceFromStep1(entry)
  } catch (error) {
    if (options.ignoreUnresumableEntries) {
      l.warn(error instanceof Error ? error.message : String(error))
      return undefined
    }
    throw error
  }

  const storedMissingTargets = buildMissingTargetsFromEntry(entry, requestedBaseTargets)
  const resolvedTargets = resolveAdditiveResumeProviderSelection({
    storedProviders: requestedBaseTargets,
    runnableStoredProviders: storedMissingTargets,
    ...(fallbackSelectedTargets ? { selectedProviders: fallbackSelectedTargets } : {})
  })
  const requestedTargets = resolvedTargets.requestedProviders
  const completionStatus = inferStoredCompletionStatus(entry, requestedTargets)

  return {
    outputDir,
    source,
    requestedTargets,
    missingTargets: resolvedTargets.providersToRun,
    completionStatus,
    rawEntry: entry
  }
}

const readOutputMetadata = async (outputDir: string): Promise<BatchManifestEntry> => {
  const metadata = await readSttRunManifestEntry(outputDir)
  if (!isRecord(metadata)) {
    throw CLIUsageError(`Invalid STT manifest at ${outputDir}/run.json`)
  }

  return metadata
}

const toResumeResult = (
  result: ProviderResumePassResult
): ResumeResult => ({
  full: result.ok,
  incomplete: result.incomplete,
  failed: result.fail
})

const selectedSttTargetsComplete = (
  metadata: BatchManifestEntry,
  selectedTargets: SttTarget[] | undefined
): boolean => {
  if (selectedTargets === undefined) {
    return false
  }

  const storedRequestedTargets = parseStoredRequestedTargets(metadata)
  const storedMissingTargets = buildMissingTargetsFromEntry(metadata, storedRequestedTargets)
  const resolvedTargets = resolveAdditiveResumeProviderSelection({
    storedProviders: storedRequestedTargets,
    runnableStoredProviders: storedMissingTargets,
    selectedProviders: selectedTargets
  })
  return resolvedTargets.providersToRun.length === 0
}

export const hasResumableSttTargetWork = async (
  target: ResumeTarget,
  selectedTargets: SttTarget[] | undefined,
  options: { youtubeCaptions: boolean, currentTargets: SttTarget[] }
): Promise<boolean> =>
  await hasResumableProviderTargetWork(target, {
    readOutputMetadata,
    parseEntry: async (entry) =>
      await parseResumeEntry(entry, selectedTargets, {
        ignoreUnresumableEntries: true,
        ...options
      })
  })

const collectPartialFailureLabels = (
  metadata: Record<string, unknown>,
  partialFailureLabels: Map<string, number>
): void => {
  const errors = Array.isArray(metadata['errors'])
    ? metadata['errors'].filter((value): value is Record<string, unknown> => isRecord(value))
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
  opts: RuntimeOptions,
  selectedTargets: SttTarget[] | undefined,
  options: NormalizedResumeProviderBatchRunOptions & { youtubeCaptions: boolean, currentTargets: SttTarget[] },
  pass: number,
  totalPasses: number,
  displayOptions: ResumeDisplayOptions = {}
): Promise<ProviderResumePassResult> =>
  await runProviderResumePass<SttTarget, ResumeSttEntry, SttResumePassContext>(
    target,
    opts,
    {
      stepLabel: 'STT',
      processingDetail: 'resuming missing providers',
      readOutputMetadata,
      writeBatchManifest: writeSttBatchManifest,
      writeRunManifest: writeSttRunManifest,
      parseEntry: async (entry) =>
        await parseResumeEntry(entry, selectedTargets, options),
      getProviderLabels: (targets) => targets.map(formatSttTargetLabel),
      classifyNoMatchingMetadata: (metadata) =>
        selectedSttTargetsComplete(metadata, selectedTargets)
          ? 'full'
          : metadata['completionStatus'] === 'failed' ? 'failed' : 'incomplete',
      createPassContext: ({ parsedEntries }) => ({
        batchCoordinator: parsedEntries.filter((entry) => entry !== undefined).length > 1
          ? new SttBatchCoordinator({ batchConcurrency: opts.batchConcurrency })
          : undefined,
        partialFailureLabels: new Map<string, number>()
      }),
      onNoMatchingMetadata: ({ metadata, context }) => {
        collectPartialFailureLabels(metadata, context.partialFailureLabels)
      },
      processEntry: async ({ target, opts, entry, context }) => {
        try {
          const outputDir = await processStt(entry.source, target.dir, opts, undefined, {
            outputDir: entry.outputDir,
            requestedTargets: entry.requestedTargets,
            targetsToRun: entry.missingTargets,
            batchCoordinator: context.batchCoordinator
          })

          const metadata = await readOutputMetadata(outputDir)
          if (selectedSttTargetsComplete(metadata, selectedTargets) && metadata['completionStatus'] !== 'full') {
            return {
              outputDir,
              metadata,
              completionStatus: 'full',
              detail: 'selected providers complete; run manifest still incomplete',
              level: 'success'
            }
          }
          return {
            outputDir,
            metadata,
            completionStatus: 'full',
            detail: 'resume complete',
            level: 'success'
          }
        } catch (error) {
          if (!isSttPartialCompletionError(error)) {
            throw error
          }

          const metadata = await readOutputMetadata(error.outputDir)
          if (selectedSttTargetsComplete(metadata, selectedTargets) && metadata['completionStatus'] !== 'full') {
            return {
              outputDir: error.outputDir,
              metadata,
              completionStatus: 'full',
              detail: 'selected providers complete; run manifest still incomplete',
              level: 'success'
            }
          }
          return {
            outputDir: error.outputDir,
            metadata,
            completionStatus: error.completionStatus,
            detail: error.message,
            level: error.completionStatus === 'failed' ? 'error' : 'warn'
          }
        }
      },
      onProcessedResult: ({ result, context }) => {
        if (result.completionStatus !== 'full') {
          collectPartialFailureLabels(result.metadata, context.partialFailureLabels)
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
  opts: RuntimeOptions,
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
  opts: RuntimeOptions,
  selectedTargets?: SttTarget[],
  runOptions: ResumeProviderBatchRunOptions = {}
): Promise<ProviderResumePassResult> =>
  await runResumeSttTarget({
    kind: 'extract',
    extractRoute: 'media',
    scope: 'batch',
    dir: resolvePath(batchDirInput),
    manifestPath: join(resolvePath(batchDirInput), 'batch.json')
  }, opts, selectedTargets, runOptions)

export const resumeSttTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  selectedTargets?: SttTarget[],
  displayOptions: ResumeDisplayOptions = {}
): Promise<ResumeResult> => {
  const result = await runResumeSttTarget(target, opts, selectedTargets, {}, displayOptions)
  if (target.scope === 'batch' && result.batchDir) {
    await logSttBatchFinalSummary(result.batchDir)
  }
  if (result.incomplete > 0 || result.fail > 0) {
    throw InfraError(`STT resume still has ${result.incomplete} incomplete and ${result.fail} failed item(s)`, { stage: 'resume:stt', exitCode: 2 })
  }
  return toResumeResult(result)
}

const sttSourceInput = (
  source: ResumeSttEntry['source']
): string => {
  const input = source.filePath ?? source.url
  if (!input) {
    throw CLIUsageError('STT resume entry is missing a resumable source file or URL.')
  }
  return input
}

export const priceSttTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  selectedTargets?: SttTarget[]
): Promise<AggregatedPriceEstimate> => {
  const manifest = await readProviderResumeTargetManifest(target, readOutputMetadata)
  if (!manifest) {
    throw CLIUsageError(
      target.scope === 'batch'
        ? `Invalid STT batch manifest at ${join(target.dir, 'batch.json')}`
        : `Invalid STT manifest at ${join(target.dir, 'run.json')}`
    )
  }

  const currentTargets = selectedTargets && selectedTargets.length > 0 ? selectedTargets : collectSttTargets(opts)
  const steps: StepEstimate[] = []
  for (const entry of manifest.entries) {
    const parsed = await parseResumeEntry(entry, selectedTargets, {
      ignoreUnresumableEntries: false,
      youtubeCaptions: opts.youtubeCaptions,
      currentTargets
    })
    if (!parsed || parsed.missingTargets.length === 0) {
      continue
    }
    steps.push(...await buildSttEstimatesForTargets(sttSourceInput(parsed.source), opts, parsed.missingTargets))
  }

  return aggregateExplicitPriceEstimate(steps, opts)
}
