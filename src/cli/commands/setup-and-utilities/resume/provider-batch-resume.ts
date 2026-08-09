import { join, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertManifestEntriesCanBeRewritten, readBatchManifest } from '~/cli/commands/process-steps/manifest-utils'
import type { AggregatedPriceEstimate, BatchManifestEntry, ProviderBatchResumeConfig, ProviderCompletionStatus, ProviderIdentity, ProviderResumeEntry, ProviderResumeManifest, ProviderResumePassResult, ProviderResumePriceConfig, ProviderResumeProcessResult, ResumeDisplayOptions, ResumeResult, ResumeTarget, RuntimeOptions, Step1SourceRef, StepEstimate } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { aggregateExplicitPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import * as l from '~/utils/app-logger/app-logger'
import { logResumeItem, logResumeSummary } from './resume-logging'
import { resolveAdditiveResumeProviderSelection } from './resume-provider-selection'

export const resolveProviderResumeOutputDir = (entry: Record<string, unknown>): string | undefined =>
  typeof entry['outputDir'] === 'string' && entry['outputDir'].length > 0
    ? resolvePath(entry['outputDir'])
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
  metadata: BatchManifestEntry,
  selectedTargets: TTarget[] | undefined,
  parseStoredTargets: (metadata: Record<string, unknown>) => TTarget[],
  buildMissingTargets: (metadata: Record<string, unknown>, storedTargets: TTarget[]) => TTarget[]
): boolean => {
  if (selectedTargets === undefined) {
    return false
  }

  const storedTargets = parseStoredTargets(metadata)
  const missingTargets = buildMissingTargets(metadata, storedTargets)
  return resolveAdditiveResumeProviderSelection({
    storedProviders: storedTargets,
    runnableStoredProviders: missingTargets,
    selectedProviders: selectedTargets
  }).providersToRun.length === 0
}

export const selectedProvidersCompleteResult = (outputDir: string, metadata: BatchManifestEntry): ProviderResumeProcessResult => ({
  outputDir,
  metadata,
  completionStatus: 'full',
  detail: 'selected providers complete; run manifest still incomplete',
  level: 'success'
})

export const toProviderResumeResult = (result: ProviderResumePassResult): ResumeResult => ({
  full: result.ok,
  incomplete: result.incomplete,
  failed: result.fail
})

export const withProviderResumeOutputDir = (
  metadata: BatchManifestEntry,
  outputDir: string
): BatchManifestEntry => ({
  ...metadata,
  outputDir
})

export const stripProviderResumeOutputDir = (
  metadata: BatchManifestEntry
): Record<string, unknown> => {
  const { outputDir: _outputDir, ...rest } = metadata
  return rest
}

export const readProviderResumeTargetManifest = async (
  target: ResumeTarget,
  readOutputMetadata: (outputDir: string) => Promise<BatchManifestEntry>
): Promise<ProviderResumeManifest | undefined> => {
  if (target.scope === 'batch') {
    const manifest = await readBatchManifest(target.dir, 'extract')
    if (!manifest) {
      return undefined
    }

    return {
      infoPath: manifest.manifestPath,
      entries: manifest.manifest.items,
      rawItemCount: manifest.rawItemCount,
      ...(manifest.firstUnparseableEntryIndex !== undefined ? { firstUnparseableEntryIndex: manifest.firstUnparseableEntryIndex } : {}),
      ...(manifest.manifest.source ? { source: manifest.manifest.source } : {})
    }
  }

  const metadata = await readOutputMetadata(target.dir)
  return {
    infoPath: target.manifestPath,
    entries: [withProviderResumeOutputDir(metadata, target.dir)]
  }
}

export const priceProviderResumeTarget = async <
  TTarget extends ProviderIdentity,
  TEntry extends ProviderResumeEntry<TTarget>
>(
  target: ResumeTarget,
  opts: RuntimeOptions,
  config: ProviderResumePriceConfig<TTarget, TEntry>
): Promise<AggregatedPriceEstimate> => {
  const manifest = await readProviderResumeTargetManifest(target, config.readOutputMetadata)
  if (!manifest) {
    throw CLIUsageError(
      target.scope === 'batch'
        ? `Invalid ${config.stepLabel} batch manifest at ${join(target.dir, 'batch.json')}`
        : `Invalid ${config.stepLabel} manifest at ${join(target.dir, 'run.json')}`
    )
  }

  const steps: StepEstimate[] = []
  for (const entry of manifest.entries) {
    const parsed = await config.parseEntry(entry)
    if (!parsed || parsed.missingTargets.length === 0) {
      continue
    }
    steps.push(...await config.buildEstimates(parsed, opts))
  }

  return aggregateExplicitPriceEstimate(steps, opts)
}

export const hasResumableProviderTargetWork = async <
  TTarget extends ProviderIdentity,
  TEntry extends ProviderResumeEntry<TTarget>
>(
  target: ResumeTarget,
  config: Pick<ProviderBatchResumeConfig<TTarget, TEntry>, 'parseEntry' | 'readOutputMetadata'>
): Promise<boolean> => {
  const manifest = await readProviderResumeTargetManifest(target, config.readOutputMetadata)
  if (!manifest) {
    return false
  }

  for (const entry of manifest.entries) {
    try {
      const parsedEntry = await config.parseEntry(entry)
      if (parsedEntry && parsedEntry.missingTargets.length > 0) {
        return true
      }
    } catch {
      continue
    }
  }

  return false
}

const defaultClassifyNoMatchingMetadata = (
  metadata: BatchManifestEntry
): ProviderCompletionStatus => {
  if (metadata['completionStatus'] === 'failed' || metadata['completionStatus'] === 'full') {
    return metadata['completionStatus']
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
  TContext = undefined
>(
  target: ResumeTarget,
  opts: RuntimeOptions,
  config: ProviderBatchResumeConfig<TTarget, TEntry, TContext>,
  pass = 1,
  totalPasses = 1,
  displayOptions: ResumeDisplayOptions = {}
): Promise<ProviderResumePassResult> => {
  const manifest = await readProviderResumeTargetManifest(target, config.readOutputMetadata)
  if (!manifest) {
    throw CLIUsageError(
      target.scope === 'batch'
        ? `Invalid batch manifest at ${join(target.dir, 'batch.json')}`
        : `Invalid ${config.stepLabel} manifest at ${join(target.dir, 'run.json')}`
    )
  }
  if (target.scope === 'batch') {
    assertManifestEntriesCanBeRewritten({
      manifestPath: manifest.infoPath,
      manifest: { items: manifest.entries },
      rawItemCount: manifest.rawItemCount ?? manifest.entries.length,
      ...(manifest.firstUnparseableEntryIndex !== undefined ? { firstUnparseableEntryIndex: manifest.firstUnparseableEntryIndex } : {})
    })
  }

  const parsedEntries = await Promise.all(
    manifest.entries.map(async (entry) => await config.parseEntry(entry))
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
  const updatedEntries: BatchManifestEntry[] = []

  if (totalPasses > 1) {
    l.write('info', `${config.stepLabel} resume pass ${pass}/${totalPasses}`)
  }

  for (let index = 0; index < parsedEntries.length; index++) {
    const entry = parsedEntries[index]
    if (!entry) {
      const rawEntry = manifest.entries[index]
      if (rawEntry) {
        updatedEntries.push(rawEntry)
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
      const normalizedMetadata = config.normalizeAlreadyFullMetadata
        ? config.normalizeAlreadyFullMetadata(entry.rawEntry)
        : entry.rawEntry
      updatedEntries.push(withProviderResumeOutputDir(normalizedMetadata, entry.outputDir))
      continue
    }

    if (entry.missingTargets.length === 0) {
      const metadata = await config.readOutputMetadata(entry.outputDir)
      const noMatchingStatus = config.classifyNoMatchingMetadata
        ? config.classifyNoMatchingMetadata(metadata)
        : defaultClassifyNoMatchingMetadata(metadata)
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
      updatedEntries.push(withProviderResumeOutputDir(metadata, entry.outputDir))
      await config.onNoMatchingMetadata?.({ target, opts, context, metadata })
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
    updatedEntries.push(withProviderResumeOutputDir(result.metadata, result.outputDir))
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

  if (target.scope === 'batch') {
    await config.writeBatchManifest(target.dir, updatedEntries, manifest.source)
  } else if (updatedEntries[0]) {
    await config.writeRunManifest(target.dir, stripProviderResumeOutputDir(updatedEntries[0]))
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
