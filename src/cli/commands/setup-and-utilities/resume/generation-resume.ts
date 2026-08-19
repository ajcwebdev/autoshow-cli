import { isRecord } from '~/utils/rest-client'
import * as l from '~/utils/app-logger/app-logger'
import { readManifest, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { logResumeItem, logResumeSummary } from './resume-logging'
import { getResumeProviderKey, resolveAdditiveResumeProviderSelection, uniqueResumeProviders } from './resume-provider-selection'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import { aggregateExplicitPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import type { AggregatedPriceEstimate, GenerationModelFieldTable, GenerationResumeConfig, GenerationResumePreparation, GenerationResumeProviderIdentity, PipelineManifestItem, ProviderIdentity, ResumeDisplayOptions, ResumeHandler, ResumeResult, ResumeTarget, ResumeTargetKind } from '~/types'

export const buildUpdatedGenerationCostTiming = (
  currentMetadata: Record<string, unknown>,
  actual: unknown,
  actualTiming: unknown
): Record<string, unknown> => ({
  cost: {
    ...(isRecord(currentMetadata['cost']) ? currentMetadata['cost'] : {}),
    actual
  },
  timing: {
    ...(isRecord(currentMetadata['timing']) ? currentMetadata['timing'] : {}),
    actual: actualTiming
  }
})

export const clearProviderModelFields = <TOptions extends object>(
  opts: TOptions,
  fields: GenerationModelFieldTable
): TOptions => {
  const cleared = { ...opts }
  for (const [modelsField, modelField] of Object.values(fields)) {
    Reflect.set(cleared, modelsField, undefined)
    Reflect.set(cleared, modelField, undefined)
  }
  return cleared
}

export const collectGenerationTargetsForProviders = <TTarget extends ProviderIdentity, TOptions extends object>(
  providers: ProviderIdentity[],
  opts: TOptions,
  fields: GenerationModelFieldTable,
  collect: (opts: TOptions) => TTarget[]
): TTarget[] =>
  providers.flatMap((provider) => {
    const providerFields = fields[provider.service]
    if (!providerFields) {
      return []
    }
    const [modelsField, modelField] = providerFields
    const providerOptions = clearProviderModelFields(opts, fields)
    Reflect.set(providerOptions, modelsField, [provider.model])
    Reflect.set(providerOptions, modelField, provider.model)
    return collect(providerOptions).filter((target) =>
      target.service === provider.service && target.model === provider.model
    )
  })

export const buildGenerationPriceOptions = <TOptions extends object>(
  targets: ProviderIdentity[],
  opts: TOptions,
  fields: GenerationModelFieldTable
): TOptions => {
  const priceOpts = clearProviderModelFields(opts, fields)
  for (const [service, [modelsField]] of Object.entries(fields)) {
    const models = targets
      .filter((target) => target.service === service)
      .map((target) => target.model)
    if (models.length > 0) {
      Reflect.set(priceOpts, modelsField, models)
    }
  }
  return priceOpts
}

const parseStoredRequestedProviders = (
  item: PipelineManifestItem
): GenerationResumeProviderIdentity[] | undefined => {
  const requestedProviders = item.providers.flatMap((provider) =>
    typeof provider.model === 'string'
      ? [{
          service: provider.service,
          model: provider.model,
          ...(provider.operation !== undefined ? { operation: provider.operation } : {}),
          ...(provider.targetKey !== undefined ? { targetKey: provider.targetKey } : {}),
          ...(provider.transport !== undefined ? { transport: provider.transport } : {})
        }]
      : []
  )
  return requestedProviders.length > 0
    ? requestedProviders
    : undefined
}

const hasExplicitGenerationProviderSelection = (
  providerFlags: readonly string[],
  explicitFlags: Set<string>
): boolean =>
  providerFlags.some((flag) => explicitFlags.has(flag))

const toProviderIdentity = (
  provider: ProviderIdentity
): GenerationResumeProviderIdentity => {
  const operation = Reflect.get(provider, 'operation')
  const targetKey = Reflect.get(provider, 'targetKey')
  const transport = Reflect.get(provider, 'transport')
  return {
    service: provider.service,
    model: provider.model,
    ...(typeof operation === 'string' ? { operation } : {}),
    ...(typeof targetKey === 'string' ? { targetKey } : {}),
    ...(typeof transport === 'string' ? { transport } : {})
  }
}

const getConfiguredProviderKey = <TTarget extends ProviderIdentity, TMetadata, TOptions extends object>(
  config: GenerationResumeConfig<TTarget, TMetadata, TOptions>,
  provider: ProviderIdentity
): string => config.getProviderKey
  ? config.getProviderKey(toProviderIdentity(provider))
  : getResumeProviderKey(provider)

const allProvidersSucceeded = (
  providers: GenerationResumeProviderIdentity[],
  successKeys: ReadonlySet<string>,
  getKey: (provider: ProviderIdentity) => string
): boolean =>
  providers.every((provider) => successKeys.has(getKey(provider)))

async function prepareGenerationResume<TTarget extends ProviderIdentity, TMetadata, TOptions extends object>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata, TOptions>,
  opts: TOptions,
  explicitFlags: Set<string>,
  throwOnInvalid: true,
  itemIndex?: number
): Promise<GenerationResumePreparation<TTarget, TMetadata>>
async function prepareGenerationResume<TTarget extends ProviderIdentity, TMetadata, TOptions extends object>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata, TOptions>,
  opts: TOptions,
  explicitFlags: Set<string>,
  throwOnInvalid: false,
  itemIndex?: number
): Promise<GenerationResumePreparation<TTarget, TMetadata> | undefined>
async function prepareGenerationResume<TTarget extends ProviderIdentity, TMetadata, TOptions extends object>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata, TOptions>,
  opts: TOptions,
  explicitFlags: Set<string>,
  throwOnInvalid: boolean,
  itemIndex = 0
): Promise<GenerationResumePreparation<TTarget, TMetadata> | undefined> {
  if (
    target.scope !== 'single'
    && config.selectionMode === 'selected-only'
  ) {
    if (throwOnInvalid) {
      throw CLIUsageError(`${config.stepLabel} resume currently supports single-run manifest.json outputs only.`)
    }
    return undefined
  }

  const manifest = await readManifest(target.dir)
  if (!manifest || manifest.command !== config.kind || manifest.scope !== target.scope) {
    if (throwOnInvalid) {
      const manifestLabel = config.selectionMode === 'selected-only'
        ? config.stepLabel.toLowerCase()
        : config.stepLabel
      throw CLIUsageError(`Invalid ${manifestLabel} manifest at ${target.dir}/manifest.json`)
    }
    return undefined
  }

  const item = manifest.items[itemIndex]
  if (!item) {
    if (throwOnInvalid) {
      throw CLIUsageError(`Invalid ${config.stepLabel} manifest at ${target.dir}/manifest.json`)
    }
    return undefined
  }
  const existingEntries = config.parseManifestEntries
    ? config.parseManifestEntries(item.metadata)
    : Array.isArray(item.metadata[config.metadataKey])
      ? item.metadata[config.metadataKey] as TMetadata[]
      : []
  const storedProviders = config.selectionMode === 'additive-stored'
    ? parseStoredRequestedProviders(item)
    : undefined
  const hasStoredInput = typeof item.input === 'string' && item.input.length > 0
  const invalidManifest = existingEntries === undefined
    || (config.selectionMode === 'additive-stored' && (!hasStoredInput || !storedProviders))

  if (invalidManifest) {
    if (throwOnInvalid) {
      throw CLIUsageError(config.selectionMode === 'additive-stored'
        ? `This ${config.stepLabel} manifest.json does not contain canonical resume input/provider state. `
          + 'Re-run the original command to produce a resumable manifest.'
        : `This ${config.stepLabel.toLowerCase()} manifest.json does not contain resumable ${config.metadataKey} LLM metadata. `
          + `Re-run the original command to produce a resumable ${config.stepLabel.toLowerCase()} manifest.`
      )
    }
    return undefined
  }

  const resumeValidationError = config.validateManifestForResume?.(item, existingEntries, opts)
  if (resumeValidationError) {
    if (throwOnInvalid) {
      throw CLIUsageError(resumeValidationError)
    }
    return undefined
  }

  const successKeys = new Set(
    config.getInitialCompletedProviderKeys
      ? config.getInitialCompletedProviderKeys(item, existingEntries)
      : existingEntries.map(config.getSuccessKey)
  )
  const getProviderKey = (provider: ProviderIdentity): string =>
    getConfiguredProviderKey(config, provider)

  const storedMissingProviders = (storedProviders ?? []).filter(
    (provider) => !successKeys.has(getProviderKey(provider))
  )
  const selectedTargets = hasExplicitGenerationProviderSelection(config.providerFlags, explicitFlags)
    ? uniqueResumeProviders(config.collectTargets(opts, target), getProviderKey)
    : []
  const selectedProviders = selectedTargets.length > 0
    ? selectedTargets.map(toProviderIdentity)
    : undefined
  const resolved = config.selectionMode === 'additive-stored'
    ? resolveAdditiveResumeProviderSelection({
        storedProviders: storedProviders ?? [],
        runnableStoredProviders: storedMissingProviders,
        ...(selectedProviders ? { selectedProviders } : {}),
        successfulProviderKeys: successKeys
      }, getProviderKey)
    : resolveAdditiveResumeProviderSelection({
        storedProviders: [],
        runnableStoredProviders: [],
        ...(selectedProviders ? { selectedProviders } : {}),
        successfulProviderKeys: successKeys
      }, getProviderKey)

  return {
    manifest,
    item,
    existingEntries,
    successKeys,
    selectedTargets,
    selectedProviders,
    resolved
  }
}

const resolveGenerationTargetsToRunOrThrow = async <TTarget extends ProviderIdentity, TMetadata, TOptions extends object>(
  target: ResumeTarget,
  prep: GenerationResumePreparation<TTarget, TMetadata>,
  config: GenerationResumeConfig<TTarget, TMetadata, TOptions>,
  opts: TOptions
): Promise<TTarget[]> => {
  const getProviderKey = (provider: ProviderIdentity): string => getConfiguredProviderKey(config, provider)
  const providerKeys = new Set(prep.resolved.providersToRun.map(getProviderKey))
  const explicitlySelected = uniqueResumeProviders(prep.selectedTargets, getProviderKey)
    .filter((selected) => providerKeys.has(getProviderKey(selected)))
  let ordinaryReconstruction: TTarget[] = []
  let ordinaryReconstructionError: unknown
  if (explicitlySelected.length === 0 && config.modelFields) {
    try {
      ordinaryReconstruction = collectGenerationTargetsForProviders(
        prep.resolved.providersToRun,
        opts,
        config.modelFields,
        (providerOpts) => config.collectTargets(providerOpts, target)
      )
    } catch (error) {
      ordinaryReconstructionError = error
    }
  }
  const ordinaryKeys = new Set(ordinaryReconstruction.map(getProviderKey))
  const ordinaryIsComplete = prep.resolved.providersToRun.every((provider) => ordinaryKeys.has(getProviderKey(provider)))
  const reconstructed = explicitlySelected.length > 0
    ? explicitlySelected
    : ordinaryIsComplete
      ? ordinaryReconstruction
      : config.resolveStoredTargets
        ? await config.resolveStoredTargets(prep.resolved.providersToRun, opts, target, prep.item)
        : ordinaryReconstructionError !== undefined
          ? (() => { throw ordinaryReconstructionError })()
          : ordinaryReconstruction
  const targetsToRun = uniqueResumeProviders(reconstructed, getProviderKey)
    .filter((selected) => providerKeys.has(getProviderKey(selected)))

  if (targetsToRun.length === 0) {
    throw CLIUsageError(
      `Could not reconstruct targets for missing providers: ${prep.resolved.providersToRun.map((p) => `${p.service}/${p.model}`).join(', ')}. `
      + 'Pass explicit provider flags matching the original models.'
    )
  }

  return targetsToRun
}

const resolveGenerationInput = async <TTarget extends ProviderIdentity, TMetadata, TOptions extends object>(
  target: ResumeTarget,
  prep: GenerationResumePreparation<TTarget, TMetadata>,
  config: GenerationResumeConfig<TTarget, TMetadata, TOptions>
): Promise<string> => {
  if (config.resolveInput) {
    return await config.resolveInput(target, prep.item.metadata, prep.item)
  }
  return prep.item.input as string
}

const addResumeTotals = (left: ResumeResult, right: ResumeResult): ResumeResult => ({
  full: left.full + right.full,
  incomplete: left.incomplete + right.incomplete,
  failed: left.failed + right.failed
})

const resumeGenerationItems = async <TTarget extends ProviderIdentity, TMetadata, TOptions extends object>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata, TOptions>,
  opts: TOptions,
  explicitFlags: Set<string>,
  displayOptions: ResumeDisplayOptions
): Promise<ResumeResult> => {
  const manifest = await readManifest(target.dir)
  if (!manifest || manifest.command !== config.kind || manifest.scope !== target.scope || manifest.items.length === 0) {
    throw CLIUsageError(`Invalid ${config.stepLabel} manifest at ${target.dir}/manifest.json`)
  }
  let totals: ResumeResult = { full: 0, incomplete: 0, failed: 0 }
  for (const [itemIndex] of manifest.items.entries()) {
    const result = await resumeGenerationTarget(target, config, opts, explicitFlags, {
      ...displayOptions,
      itemIndex,
      itemLabel: `${itemIndex + 1}/${manifest.items.length}`,
      deferItemFailure: true
    })
    totals = addResumeTotals(totals, result)
  }
  if (totals.failed > 0) {
    throw InfraError(
      `${config.stepLabel} resume still has failed items`,
      { stage: 'resume:generation', exitCode: 2 }
    )
  }
  if (totals.incomplete > 0) {
    throw InfraError(
      `${config.stepLabel} resume still has incomplete items`,
      { stage: 'resume:generation', exitCode: 2 }
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

export const hasResumableGenerationWork = async <TTarget extends ProviderIdentity, TMetadata, TOptions extends object>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata, TOptions>,
  opts: TOptions,
  explicitFlags: Set<string> = new Set()
): Promise<boolean> => {
  if (target.scope === 'batch' && config.kind === 'tts') {
    const manifest = await readManifest(target.dir)
    if (!manifest || manifest.command !== 'tts' || manifest.scope !== 'batch') return false
    for (const [itemIndex] of manifest.items.entries()) {
      const prep = await prepareGenerationResume(target, config, opts, explicitFlags, false, itemIndex)
      if (prep !== undefined && prep.resolved.providersToRun.length > 0) return true
    }
    return false
  }
  const prep = await prepareGenerationResume(target, config, opts, explicitFlags, false)
  return prep !== undefined && prep.resolved.providersToRun.length > 0
}

export const resumeGenerationTarget = async <TTarget extends ProviderIdentity, TMetadata, TOptions extends object>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata, TOptions>,
  opts: TOptions,
  explicitFlags: Set<string> = new Set(),
  displayOptions: ResumeDisplayOptions = {}
): Promise<ResumeResult> => {
  if (target.scope === 'batch' && config.kind === 'tts' && displayOptions.itemIndex === undefined) {
    return await resumeGenerationItems(target, config, opts, explicitFlags, displayOptions)
  }
  const itemIndex = displayOptions.itemIndex ?? 0
  const itemLabel = displayOptions.itemLabel ?? '1/1'
  const prep = await prepareGenerationResume(target, config, opts, explicitFlags, true, itemIndex)
  const { item, existingEntries, successKeys, selectedProviders, resolved } = prep
  const hasExplicitSelectedProviders = selectedProviders !== undefined
  const getProviderKey = (provider: ProviderIdentity): string =>
    getConfiguredProviderKey(config, provider)

  if (resolved.providersToRun.length === 0) {
    const unresolvedProviders = resolved.requestedProviders.filter(
      (provider) => !successKeys.has(getProviderKey(provider))
    )
    logResumeItem(l, {
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
    logResumeSummary(l, { full: 1, incomplete: 0, failed: 0 })
    return { full: 1, incomplete: 0, failed: 0 }
  }

  const input = await resolveGenerationInput(target, prep, config)
  const targetsToRun = await resolveGenerationTargetsToRunOrThrow(target, prep, config, opts)

  const providerLabels = targetsToRun.map((t) => `${t.service}/${t.model}`)
  logResumeItem(l, {
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
      targets: targetsToRun,
      existingEntries,
      currentManifestMetadata: item.metadata,
      currentProviderStates: item.providers,
      itemIndex
    })
  } catch (error) {
    logResumeItem(l, {
      item: itemLabel,
      status: 'failed',
      outputDir: target.dir,
      providers: providerLabels,
      detail: error instanceof Error ? error.message : String(error)
    }, 'error')
    logResumeSummary(l, { full: 0, incomplete: 0, failed: 1 })
    if (displayOptions.deferItemFailure) return { full: 0, incomplete: 0, failed: 1 }
    throw InfraError(
      buildGenerationFailureMessage(config, 'failed', targetsToRun),
      { stage: 'resume:generation', exitCode: 2 }
    )
  }

  const mergedMetadata = [...existingEntries, ...newMetadata]

  const mergedSuccessKeys = new Set([
    ...successKeys,
    ...newMetadata.map(config.getSuccessKey)
  ])
  const stillMissing = resolved.requestedProviders.filter(
    (provider) => !mergedSuccessKeys.has(getProviderKey(provider))
  )
  const latestManifest = await readManifest(target.dir)
  const latestItem = latestManifest?.items[itemIndex]
  if (
    !latestManifest
    || !latestItem
    || latestManifest.command !== config.kind
    || latestManifest.scope !== target.scope
    || (target.scope === 'single' && latestManifest.items.length !== 1)
  ) {
    throw CLIUsageError(`Canonical ${config.stepLabel} manifest changed incompatibly during resume.`)
  }
  const rebuiltMetadata = config.rebuildRunMetadata
    ? config.rebuildRunMetadata(mergedMetadata, latestItem.metadata, input)
    : {}

  const nextProviders = config.reconcileProviderStates
    ? config.reconcileProviderStates({
        currentProviders: latestItem.providers,
        requestedProviders: resolved.requestedProviders,
        targetsToRun,
        existingEntries,
        newEntries: newMetadata,
        mergedEntries: mergedMetadata,
        completedProviderKeys: mergedSuccessKeys
      })
    : (() => {
        const nextProviderByKey = new Map(latestItem.providers.flatMap((provider) =>
          typeof provider.model === 'string'
            ? [[getProviderKey(provider as ProviderIdentity), provider] as const]
            : []
        ))
        for (const provider of resolved.requestedProviders) {
          const key = getProviderKey(provider)
          const current = nextProviderByKey.get(key)
          const succeeded = mergedSuccessKeys.has(key)
          nextProviderByKey.set(key, {
            service: provider.service,
            model: provider.model,
            artifactDir: current?.artifactDir ?? '.',
            status: succeeded ? 'succeeded' : 'missing',
            attempts: Math.max(current?.attempts ?? 0, succeeded ? 1 : 0),
            options: current?.options ?? {},
            metadata: current?.metadata ?? {},
            ...(succeeded ? {} : current?.error ? { error: current.error } : {})
          })
        }
        return [...nextProviderByKey.values()]
      })()
  const nextItem = {
    ...latestItem,
    input: config.kind === 'tts' ? latestItem.input : input,
    status: stillMissing.length > 0 ? 'incomplete' as const : 'full' as const,
    metadata: {
      ...latestItem.metadata,
      ...rebuiltMetadata,
      [config.metadataKey]: config.serializeEntries
        ? config.serializeEntries(mergedMetadata)
        : mergedMetadata
    },
    providers: nextProviders
  }
  await writeManifest(target.dir, {
    ...latestManifest,
    items: target.scope === 'batch'
      ? latestManifest.items.map((entry, index) => index === itemIndex ? nextItem : entry)
      : [nextItem]
  })

  if (stillMissing.length > 0) {
    if (
      hasExplicitSelectedProviders
      && selectedProviders
      && allProvidersSucceeded(selectedProviders, mergedSuccessKeys, getProviderKey)
    ) {
      logResumeItem(l, {
        item: itemLabel,
        status: 'full',
        outputDir: target.dir,
        providers: providerLabels,
        detail: 'selected providers complete; canonical item still incomplete'
      }, 'success')
      logResumeSummary(l, { full: 1, incomplete: 0, failed: 0 })
      return { full: 1, incomplete: 0, failed: 0 }
    }

    logResumeItem(l, {
      item: itemLabel,
      status: 'incomplete',
      outputDir: target.dir,
      providers: providerLabels,
      detail: `${stillMissing.length} provider(s) still missing`
    }, 'warn')
    logResumeSummary(l, { full: 0, incomplete: 1, failed: 0 })
    if (displayOptions.deferItemFailure) return { full: 0, incomplete: 1, failed: 0 }
    throw InfraError(
      buildGenerationFailureMessage(config, 'incomplete', stillMissing),
      { stage: 'resume:generation', exitCode: 2 }
    )
  }

  logResumeItem(l, {
    item: itemLabel,
    status: 'full',
    outputDir: target.dir,
    providers: providerLabels,
    detail: 'resume complete'
  }, 'success')
  logResumeSummary(l, { full: 1, incomplete: 0, failed: 0 })
  return { full: 1, incomplete: 0, failed: 0 }
}

const priceGenerationItem = async <TTarget extends ProviderIdentity, TMetadata, TOptions extends object>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata, TOptions>,
  opts: TOptions,
  explicitFlags: Set<string>,
  itemIndex: number
): Promise<{ steps: Awaited<ReturnType<GenerationResumeConfig<TTarget, TMetadata, TOptions>['buildEstimates']>>, input: string, priceOpts: TOptions }> => {
  const prep = await prepareGenerationResume(target, config, opts, explicitFlags, true, itemIndex)
  if (prep.resolved.providersToRun.length === 0) {
    return { steps: [], input: '', priceOpts: opts }
  }
  const input = await resolveGenerationInput(target, prep, config)
  const targetsToRun = await resolveGenerationTargetsToRunOrThrow(target, prep, config, opts)
  const priceOpts = config.modelFields
    ? buildGenerationPriceOptions(targetsToRun, opts, config.modelFields)
    : opts
  const steps = await config.buildEstimates(priceOpts, input, {
    outputDir: target.dir,
    runtimeOptions: opts,
    targets: targetsToRun,
    existingEntries: prep.existingEntries,
    currentManifestMetadata: prep.item.metadata,
    currentProviderStates: prep.item.providers,
    itemIndex
  })
  return { steps, input, priceOpts }
}

export const priceGenerationTarget = async <TTarget extends ProviderIdentity, TMetadata, TOptions extends object>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata, TOptions>,
  opts: TOptions,
  explicitFlags: Set<string> = new Set()
): Promise<AggregatedPriceEstimate> => {
  if (target.scope === 'batch' && config.kind === 'tts') {
    const manifest = await readManifest(target.dir)
    if (!manifest || manifest.command !== 'tts' || manifest.scope !== 'batch') {
      throw CLIUsageError(`Invalid ${config.stepLabel} manifest at ${target.dir}/manifest.json`)
    }
    const steps: Awaited<ReturnType<GenerationResumeConfig<TTarget, TMetadata, TOptions>['buildEstimates']>> = []
    let priceOpts = opts
    for (const [itemIndex] of manifest.items.entries()) {
      const priced = await priceGenerationItem(target, config, opts, explicitFlags, itemIndex)
      steps.push(...priced.steps)
      priceOpts = priced.priceOpts
    }
    const remainingCharacters = steps.reduce((total, step) => (
      step.step === 'tts' && typeof step.characterCount === 'number'
        ? total + step.characterCount
        : total
    ), 0)
    return aggregateExplicitPriceEstimate(
      steps,
      priceOpts,
      remainingCharacters > 0 ? { ttsTimingCharacterCount: remainingCharacters } : undefined
    )
  }

  const priced = await priceGenerationItem(target, config, opts, explicitFlags, 0)
  return aggregateExplicitPriceEstimate(
    priced.steps,
    priced.priceOpts,
    priced.input.length > 0 ? config.priceAggregateOptions?.(priced.input) : undefined
  )
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
