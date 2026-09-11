import { partialCompletionError } from '~/cli/commands/command-shared/provider-batch-state'
import { createBatchedManifestUpdater, readManifest, updateManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { logResumeItem, logResumeSummary } from './resume-logging'
import { UsageError } from '~/utils/error-handler'
import type { GenerationResumeConfig, GenerationResumeProviderIdentity, PipelineManifest, ProviderIdentity, ResumeDisplayOptions, ResumeHandler, ResumeResult, ResumeTarget, ResumeTargetKind } from '~/types'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { mapWithConcurrency } from '~/utils/run-with-concurrency'
import { getConfiguredProviderKey, hasResumableGenerationWork, prepareGenerationResume, resolveGenerationInput, resolveGenerationTargetsToRunOrThrow } from './generation-resume-preparation'
import { priceGenerationTarget } from './generation-resume-pricing'
import { reconcileGenerationBatchSummary, reconcileGenerationManifest } from './generation-resume-reconciliation'
export { clearProviderModelFields, collectGenerationTargetsForProviders, hasResumableGenerationWork } from './generation-resume-preparation'
export { priceGenerationTarget } from './generation-resume-pricing'
export { buildUpdatedGenerationCostTiming } from './generation-resume-reconciliation'

const allProvidersSucceeded = (
  providers: GenerationResumeProviderIdentity[],
  successKeys: ReadonlySet<string>,
  getKey: (provider: ProviderIdentity) => string
): boolean =>
  providers.every((provider) => successKeys.has(getKey(provider)))

const addResumeTotals = (left: ResumeResult, right: ResumeResult): ResumeResult => ({
  full: left.full + right.full,
  incomplete: left.incomplete + right.incomplete,
  failed: left.failed + right.failed
})

const resolveResumeBatchConcurrency = (opts: object): number => {
  const configured = Reflect.get(opts, 'batchConcurrency')
  return typeof configured === 'number' && Number.isFinite(configured)
    ? Math.max(1, Math.floor(configured))
    : DEFAULT_CLI_CONCURRENCY
}

const resumeGenerationItems = async <TTarget extends ProviderIdentity, TMetadata, TOptions extends object>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata, TOptions>,
  opts: TOptions,
  explicitFlags: Set<string>,
  displayOptions: ResumeDisplayOptions
): Promise<ResumeResult> => {
  const manifest = await readManifest(target.dir)
  if (!manifest || manifest.command !== config.kind || manifest.scope !== target.scope || manifest.items.length === 0) {
    throw UsageError(`Invalid ${config.stepLabel} manifest at ${target.dir}/manifest.json`)
  }
  const manifestUpdater = createBatchedManifestUpdater(
    async (update) => await updateManifest(target.dir, update)
  )
  const results = await mapWithConcurrency(
    resolveResumeBatchConcurrency(opts),
    manifest.items,
    async (_item, itemIndex) => await resumeGenerationTarget(target, config, opts, explicitFlags, {
      ...displayOptions,
      itemIndex,
      itemLabel: `${itemIndex + 1}/${manifest.items.length}`,
      deferItemFailure: true
    }, manifestUpdater, manifest)
  )
  const totals = results.reduce(addResumeTotals, { full: 0, incomplete: 0, failed: 0 })
  await reconcileGenerationBatchSummary(
    config,
    manifestUpdater
  )
  if (totals.failed > 0) {
    throw partialCompletionError(
      `${config.stepLabel} resume still has failed items`,
      { stage: 'resume:generation', metadata: { failed: totals.failed } }
    )
  }
  if (totals.incomplete > 0) {
    throw partialCompletionError(
      `${config.stepLabel} resume still has incomplete items`,
      { stage: 'resume:generation', metadata: { incomplete: totals.incomplete } }
    )
  }
  return totals
}

const buildGenerationFailureMessage = <TTarget extends ProviderIdentity, TMetadata, TOptions extends object>(
  config: GenerationResumeConfig<TTarget, TMetadata, TOptions>,
  failure: 'failed' | 'incomplete',
  providers: ProviderIdentity[]
): string => {
  if (config.failureMessage) {
    return config.failureMessage(failure, providers)
  }
  if (failure === 'failed') {
    return `${config.stepLabel} resume still has failed providers: ${providers.map((provider) => `${provider.service}/${provider.model}`).join(', ')}`
  }
  return `${config.stepLabel} resume still has ${providers.length} incomplete provider(s)`
}

export const resumeGenerationTarget = async <TTarget extends ProviderIdentity, TMetadata, TOptions extends object>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata, TOptions>,
  opts: TOptions,
  explicitFlags: Set<string> = new Set(),
  displayOptions: ResumeDisplayOptions = {},
  manifestUpdater: (
    update: (manifest: PipelineManifest) => PipelineManifest | Promise<PipelineManifest>
  ) => Promise<PipelineManifest> = async (update) => await updateManifest(target.dir, update),
  manifestSnapshot?: PipelineManifest
): Promise<ResumeResult> => {
  if (target.scope === 'batch' && config.kind === 'tts' && displayOptions.itemIndex === undefined) {
    return await resumeGenerationItems(target, config, opts, explicitFlags, displayOptions)
  }
  const itemIndex = displayOptions.itemIndex ?? 0
  const itemLabel = displayOptions.itemLabel ?? '1/1'
  const prep = await prepareGenerationResume(target, config, opts, explicitFlags, true, itemIndex, manifestSnapshot)
  const { item, existingEntries, successKeys, selectedProviders, resolved } = prep
  const hasExplicitSelectedProviders = selectedProviders !== undefined
  const getProviderKey = (provider: ProviderIdentity): string =>
    getConfiguredProviderKey(config, provider)

  if (resolved.providersToRun.length === 0) {
    const unresolvedProviders = resolved.requestedProviders.filter(
      (provider) => !successKeys.has(getProviderKey(provider))
    )
    logResumeItem({
      item: itemLabel,
      status: 'full',
      outputDir: target.dir,
      providers: 'none',
      detail: config.selectionMode === 'selected-only'
        ? hasExplicitSelectedProviders
          ? `all selected ${config.stepLabel.toLowerCase()} LLM providers already complete`
          : `no ${config.stepLabel.toLowerCase()} LLM providers selected`
        : hasExplicitSelectedProviders && unresolvedProviders.length > 0
          ? 'selected providers complete; canonical item still incomplete'
          : hasExplicitSelectedProviders
            ? 'all selected providers already complete'
            : 'all providers already complete'
    }, 'success')
    logResumeSummary({ full: 1, incomplete: 0, failed: 0 })
    return { full: 1, incomplete: 0, failed: 0 }
  }

  const input = await resolveGenerationInput(target, prep, config)
  const targetsToRun = await resolveGenerationTargetsToRunOrThrow(target, prep, config, opts)

  const providerLabels = targetsToRun.map((t) => `${t.service}/${t.model}`)
  logResumeItem({
    item: itemLabel,
    status: 'processing',
    outputDir: target.dir,
    providers: providerLabels,
    detail: config.selectionMode === 'selected-only'
      ? `resuming missing ${config.stepLabel.toLowerCase()} LLM providers`
      : 'resuming missing providers'
  }, 'info')

  let newMetadata: TMetadata[]
  try {
    newMetadata = await config.runMissingTargets(targetsToRun, input, target.dir, opts, {
      outputDir: target.dir,
      runtimeOptions: opts,
      explicitFlags,
      targets: targetsToRun,
      existingEntries,
      currentManifestMetadata: item.metadata,
      currentProviderStates: item.providers,
      itemIndex,
      manifestUpdater
    })
  } catch (error) {
    logResumeItem({
      item: itemLabel,
      status: 'failed',
      outputDir: target.dir,
      providers: providerLabels,
      detail: error instanceof Error ? error.message : String(error)
    }, 'error')
    logResumeSummary({ full: 0, incomplete: 0, failed: 1 })
    if (displayOptions.deferItemFailure) return { full: 0, incomplete: 0, failed: 1 }
    throw partialCompletionError(
      buildGenerationFailureMessage(config, 'failed', targetsToRun),
      { stage: 'resume:generation' }
    )
  }

  const { mergedSuccessKeys, stillMissing } = await reconcileGenerationManifest(
    target, config, prep, newMetadata, targetsToRun, input, itemIndex, manifestUpdater
  )

  if (stillMissing.length > 0) {
    if (
      hasExplicitSelectedProviders
      && selectedProviders
      && allProvidersSucceeded(selectedProviders, mergedSuccessKeys, getProviderKey)
    ) {
      logResumeItem({
        item: itemLabel,
        status: 'full',
        outputDir: target.dir,
        providers: providerLabels,
        detail: 'selected providers complete; canonical item still incomplete'
      }, 'success')
      logResumeSummary({ full: 1, incomplete: 0, failed: 0 })
      return { full: 1, incomplete: 0, failed: 0 }
    }

    logResumeItem({
      item: itemLabel,
      status: 'incomplete',
      outputDir: target.dir,
      providers: providerLabels,
      detail: `${stillMissing.length} provider(s) still missing`
    }, 'warn')
    logResumeSummary({ full: 0, incomplete: 1, failed: 0 })
    if (displayOptions.deferItemFailure) return { full: 0, incomplete: 1, failed: 0 }
    throw partialCompletionError(
      buildGenerationFailureMessage(config, 'incomplete', stillMissing),
      { stage: 'resume:generation' }
    )
  }

  logResumeItem({
    item: itemLabel,
    status: 'full',
    outputDir: target.dir,
    providers: providerLabels,
    detail: 'resume complete'
  }, 'success')
  logResumeSummary({ full: 1, incomplete: 0, failed: 0 })
  return { full: 1, incomplete: 0, failed: 0 }
}

export const buildGenerationResumeHandler = <TTarget extends ProviderIdentity, TMetadata, TOptions extends object>(
  kind: ResumeTargetKind,
  config: GenerationResumeConfig<TTarget, TMetadata, TOptions>
): ResumeHandler<TOptions> => ({
  kind,
  hasResumableWork: async (target, opts, explicitFlags) =>
    await hasResumableGenerationWork(target, config, opts, explicitFlags),
  resume: async (target, opts, explicitFlags, displayOptions) =>
    await resumeGenerationTarget(target, config, opts, explicitFlags, displayOptions),
  price: async (target, opts, explicitFlags) =>
    await priceGenerationTarget(target, config, opts, explicitFlags)
})
