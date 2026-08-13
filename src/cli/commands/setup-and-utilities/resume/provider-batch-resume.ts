import { join, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPipelineItemFromRecord, derivePipelineItemRecord, PIPELINE_MANIFEST_FILE, readManifest, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import type { AggregatedPriceEstimate, PipelineItemRecord, ProviderBatchResumeConfig, ProviderCompletionStatus, ProviderIdentity, ProviderResumeEntry, ProviderResumePassResult, ProviderResumePriceConfig, ProviderResumeProcessResult, ProviderResumeSnapshot, ResumeDisplayOptions, ResumeResult, ResumeTarget, Step1SourceRef, StepEstimate } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { aggregateExplicitPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import * as l from '~/utils/app-logger/app-logger'
import { logResumeItem, logResumeSummary } from './resume-logging'
import { resolveAdditiveResumeProviderSelection } from './resume-provider-selection'

export const resolveProviderResumeOutputDir = (record: PipelineItemRecord): string | undefined =>
  typeof record['outputDir'] === 'string' && record['outputDir'].length > 0
    ? resolvePath(record['outputDir'])
    : undefined

export const toProviderResumeSource = (url: string): Step1SourceRef => {
  if (url.startsWith('file://')) {
    try {
      return { filePath: fileURLToPath(url) }
    } catch {
      return { filePath: decodeURIComponent(url.replace(/^file:\/\/+/, '/')) }
    }
  }

  return { url }
}

export const providerResumeSourceInput = (source: Step1SourceRef, stepLabel: string): string => {
  const input = source.filePath ?? source.url
  if (!input) {
    throw CLIUsageError(`${stepLabel} resume entry is missing a resumable source file or URL.`)
  }
  return input
}

export const selectedProviderTargetsComplete = <TTarget extends ProviderIdentity>(
  record: PipelineItemRecord,
  selectedTargets: TTarget[] | undefined,
  parseStoredTargets: (record: PipelineItemRecord) => TTarget[],
  buildMissingTargets: (record: PipelineItemRecord, storedTargets: TTarget[]) => TTarget[]
): boolean => {
  if (selectedTargets === undefined) {
    return false
  }

  const storedTargets = parseStoredTargets(record)
  const missingTargets = buildMissingTargets(record, storedTargets)
  return resolveAdditiveResumeProviderSelection({
    storedProviders: storedTargets,
    runnableStoredProviders: missingTargets,
    selectedProviders: selectedTargets
  }).providersToRun.length === 0
}

export const selectedProvidersCompleteResult = (outputDir: string, record: PipelineItemRecord): ProviderResumeProcessResult => ({
  outputDir,
  record,
  completionStatus: 'full',
  detail: 'selected providers complete; canonical item still incomplete',
  level: 'success'
})

export const toProviderResumeResult = (result: ProviderResumePassResult): ResumeResult => ({
  full: result.ok,
  incomplete: result.incomplete,
  failed: result.fail
})

export const withProviderResumeOutputDir = (
  record: PipelineItemRecord,
  outputDir: string
): PipelineItemRecord => ({
  ...record,
  outputDir
})

export const readProviderResumeSnapshot = async (
  target: ResumeTarget,
  readItemRecord: (outputDir: string) => Promise<PipelineItemRecord>
): Promise<ProviderResumeSnapshot | undefined> => {
  const manifest = await readManifest(target.dir)
  if (!manifest || manifest.command !== 'extract' || manifest.scope !== target.scope) {
    return undefined
  }

  if (target.scope === 'batch') {
    return {
      manifestPath: join(target.dir, PIPELINE_MANIFEST_FILE),
      manifest,
      records: manifest.items.map((item) => derivePipelineItemRecord(target.dir, item))
    }
  }

  const record = await readItemRecord(target.dir)
  return {
    manifestPath: join(target.dir, PIPELINE_MANIFEST_FILE),
    manifest,
    records: [withProviderResumeOutputDir(record, target.dir)]
  }
}

export const priceProviderResumeTarget = async <
  TTarget extends ProviderIdentity,
  TEntry extends ProviderResumeEntry<TTarget>,
  TOptions extends object
>(
  target: ResumeTarget,
  opts: TOptions,
  config: ProviderResumePriceConfig<TTarget, TEntry, TOptions>
): Promise<AggregatedPriceEstimate> => {
  const snapshot = await readProviderResumeSnapshot(target, config.readItemRecord)
  if (!snapshot) {
    throw CLIUsageError(
      `Invalid ${config.stepLabel} manifest at ${join(target.dir, PIPELINE_MANIFEST_FILE)}`
    )
  }

  const steps: StepEstimate[] = []
  for (const record of snapshot.records) {
    const parsed = await config.parseRecord(record)
    if (!parsed || parsed.missingTargets.length === 0) {
      continue
    }
    steps.push(...await config.buildEstimates(parsed, opts))
  }

  return aggregateExplicitPriceEstimate(steps, config.getAggregateTimingOptions?.(opts) ?? {})
}

export const hasResumableProviderTargetWork = async <
  TTarget extends ProviderIdentity,
  TEntry extends ProviderResumeEntry<TTarget>
>(
  target: ResumeTarget,
  config: Pick<ProviderBatchResumeConfig<TTarget, TEntry>, 'parseRecord' | 'readItemRecord'>
): Promise<boolean> => {
  const snapshot = await readProviderResumeSnapshot(target, config.readItemRecord)
  if (!snapshot) {
    return false
  }

  for (const record of snapshot.records) {
    try {
      const parsedEntry = await config.parseRecord(record)
      if (parsedEntry && parsedEntry.missingTargets.length > 0) {
        return true
      }
    } catch {
      continue
    }
  }

  return false
}

const defaultClassifyNoMatchingRecord = (
  record: PipelineItemRecord
): ProviderCompletionStatus => {
  if (record['completionStatus'] === 'failed' || record['completionStatus'] === 'full') {
    return record['completionStatus']
  }
  return 'incomplete'
}

const addStatusToTotals = (
  status: ProviderCompletionStatus,
  totals: { full: number, incomplete: number, failed: number }
): void => {
  if (status === 'failed') {
    totals.failed += 1
  } else if (status === 'full') {
    totals.full += 1
  } else {
    totals.incomplete += 1
  }
}

const toLogLevel = (
  status: ProviderCompletionStatus,
  override?: 'success' | 'warn' | 'error'
): 'success' | 'warn' | 'error' => {
  if (override) {
    return override
  }
  if (status === 'full') {
    return 'success'
  }
  return status === 'failed' ? 'error' : 'warn'
}

export const runProviderResumePass = async <
  TTarget extends ProviderIdentity,
  TEntry extends ProviderResumeEntry<TTarget>,
  TContext = undefined,
  TOptions extends object = object
>(
  target: ResumeTarget,
  opts: TOptions,
  config: ProviderBatchResumeConfig<TTarget, TEntry, TContext, TOptions>,
  pass = 1,
  totalPasses = 1,
  displayOptions: ResumeDisplayOptions = {}
): Promise<ProviderResumePassResult> => {
  const snapshot = await readProviderResumeSnapshot(target, config.readItemRecord)
  if (!snapshot) {
    throw CLIUsageError(
      `Invalid ${config.stepLabel} manifest at ${join(target.dir, PIPELINE_MANIFEST_FILE)}`
    )
  }

  const parsedEntries = await Promise.all(
    snapshot.records.map(async (record) => await config.parseRecord(record))
  )
  const context = config.createPassContext
    ? await config.createPassContext({ target, opts, parsedEntries })
    : undefined as TContext

  const totals = {
    full: 0,
    incomplete: 0,
    failed: 0
  }
  let attemptedEntries = 0
  const updatedRecords: PipelineItemRecord[] = []

  if (totalPasses > 1) {
    l.write('info', `${config.stepLabel} resume pass ${pass}/${totalPasses}`)
  }

  for (let index = 0; index < parsedEntries.length; index++) {
    const entry = parsedEntries[index]
    if (!entry) {
      const rawRecord = snapshot.records[index]
      if (rawRecord) {
        updatedRecords.push(rawRecord)
      }
      continue
    }

    const entryLabel = target.scope === 'single' && displayOptions.itemLabel
      ? displayOptions.itemLabel
      : `${index + 1}/${parsedEntries.length}`
    const providerLabels = config.getProviderLabels(entry.missingTargets)
    const wasComplete = entry.completionStatus === 'full' && entry.missingTargets.length === 0
    if (wasComplete) {
      logResumeItem(l, {
        item: entryLabel,
        status: 'full',
        outputDir: entry.outputDir,
        providers: 'none',
        detail: 'already full'
      }, 'success')
      totals.full += 1
      const normalizedRecord = config.normalizeAlreadyFullRecord
        ? config.normalizeAlreadyFullRecord(entry.rawRecord)
        : entry.rawRecord
      updatedRecords.push(withProviderResumeOutputDir(normalizedRecord, entry.outputDir))
      continue
    }

    if (entry.missingTargets.length === 0) {
      const record = await config.readItemRecord(entry.outputDir)
      const noMatchingStatus = config.classifyNoMatchingRecord
        ? config.classifyNoMatchingRecord(record)
        : defaultClassifyNoMatchingRecord(record)
      const detail = config.formatNoMatchingDetail
        ? config.formatNoMatchingDetail({
          target,
          opts,
          entry,
          index,
          entryCount: parsedEntries.length,
          context
        })
        : 'no matching failed or missing providers selected'
      logResumeItem(l, {
        item: entryLabel,
        status: noMatchingStatus,
        outputDir: entry.outputDir,
        providers: 'none',
        detail
      }, toLogLevel(noMatchingStatus))
      updatedRecords.push(withProviderResumeOutputDir(record, entry.outputDir))
      await config.onNoMatchingRecord?.({ target, opts, context, record })
      addStatusToTotals(noMatchingStatus, totals)
      continue
    }

    attemptedEntries += 1
    logResumeItem(l, {
      item: entryLabel,
      status: 'processing',
      outputDir: entry.outputDir,
      providers: providerLabels,
      detail: config.processingDetail ?? 'resuming providers'
    }, 'info')

    const result = await config.processEntry({
      target,
      opts,
      entry,
      index,
      entryCount: parsedEntries.length,
      providerLabels,
      context
    })
    updatedRecords.push(withProviderResumeOutputDir(result.record, result.outputDir))
    addStatusToTotals(result.completionStatus, totals)
    await config.onProcessedResult?.({ target, opts, context, result })
    logResumeItem(l, {
      item: entryLabel,
      status: result.completionStatus,
      outputDir: result.outputDir,
      providers: providerLabels,
      detail: result.detail
    }, toLogLevel(result.completionStatus, result.level))
  }

  if (updatedRecords.length > 0) {
    await writeManifest(target.dir, {
      ...snapshot.manifest,
      items: updatedRecords.map((record) => createPipelineItemFromRecord(target.dir, record))
    })
  }

  await config.afterPass?.({ target, opts, context })
  logResumeSummary(l, totals)

  return {
    ok: totals.full,
    partial: 0,
    incomplete: totals.incomplete,
    fail: totals.failed,
    ...(target.scope === 'batch' ? { batchDir: target.dir } : {}),
    attemptedEntries,
    ...(totals.incomplete > 0 || totals.failed > 0 ? { failureExitCode: 2 } : {})
  }
}
