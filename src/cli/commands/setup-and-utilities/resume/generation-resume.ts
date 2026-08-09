import { isRecord } from '~/utils/rest-client'
import * as l from '~/utils/app-logger/app-logger'
import { readRunManifest, writeRunManifest } from '~/cli/commands/process-steps/manifest-utils'
import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { logResumeItem, logResumeSummary } from './resume-logging'
import { getResumeProviderKey, resolveAdditiveResumeProviderSelection, uniqueResumeProviders } from './resume-provider-selection'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import { aggregateExplicitPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import type { AdditiveResumeProviderSelection, AggregatedPriceEstimate, GenerationModelFieldTable, GenerationResumeConfig, ProviderIdentity, ResumeDisplayOptions, ResumeHandler, ResumeResult, ResumeTarget, ResumeTargetKind, RunManifest, RuntimeOptions } from '~/types'

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

export const clearProviderModelFields = (
  opts: RuntimeOptions,
  fields: GenerationModelFieldTable
): RuntimeOptions => {
  const cleared: Record<string, unknown> = { ...opts }
  for (const [modelsField, modelField] of Object.values(fields)) {
    cleared[modelsField] = undefined
    cleared[modelField] = undefined
  }
  return cleared as RuntimeOptions
}

export const collectGenerationTargetsForProviders = <TTarget extends ProviderIdentity>(
  providers: ProviderIdentity[],
  opts: RuntimeOptions,
  fields: GenerationModelFieldTable,
  collect: (opts: RuntimeOptions) => TTarget[]
): TTarget[] =>
  providers.flatMap((provider) => {
    const providerFields = fields[provider.service]
    if (!providerFields) {
      return []
    }
    const [modelsField, modelField] = providerFields
    return collect({
      ...clearProviderModelFields(opts, fields),
      [modelsField]: [provider.model],
      [modelField]: provider.model
    } as RuntimeOptions).filter((target) =>
      target.service === provider.service && target.model === provider.model
    )
  })

export const buildGenerationPriceOptions = (
  targets: ProviderIdentity[],
  opts: RuntimeOptions,
  fields: GenerationModelFieldTable
): RuntimeOptions => {
  const priceOpts: Record<string, unknown> = { ...clearProviderModelFields(opts, fields) }
  for (const [service, [modelsField]] of Object.entries(fields)) {
    const models = targets
      .filter((target) => target.service === service)
      .map((target) => target.model)
    if (models.length > 0) {
      priceOpts[modelsField] = models
    }
  }
  return priceOpts as RuntimeOptions
}

const parseStoredRequestedProviders = (
  metadata: Record<string, unknown>
): ProviderIdentity[] | undefined => {
  const requestedProviders = Array.isArray(metadata['requestedProviders'])
    ? metadata['requestedProviders'].filter(
        (entry): entry is ProviderIdentity =>
          isRecord(entry)
          && typeof entry['service'] === 'string'
          && typeof entry['model'] === 'string'
      )
    : undefined

  return requestedProviders && requestedProviders.length > 0
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
): ProviderIdentity => ({
  service: provider.service,
  model: provider.model
})

const selectTargetsForProviders = <TTarget extends { service: string, model: string }>(
  providers: ProviderIdentity[],
  selectedTargets: TTarget[],
  buildTargets: (providers: ProviderIdentity[]) => TTarget[]
): TTarget[] => {
  if (providers.length === 0) {
    return []
  }

  const providerKeys = new Set(providers.map(getResumeProviderKey))
  const selected = uniqueResumeProviders(selectedTargets)
    .filter((target) => providerKeys.has(getResumeProviderKey(target)))
  if (selected.length > 0) {
    return selected
  }

  return buildTargets(providers)
}

const allProvidersSucceeded = (
  providers: ProviderIdentity[],
  successKeys: ReadonlySet<string>
): boolean =>
  providers.every((provider) => successKeys.has(getGenerationTargetKey(provider.service, provider.model)))

type GenerationResumePreparation<TTarget extends ProviderIdentity, TMetadata> = {
  manifest: RunManifest
  existingEntries: TMetadata[]
  successKeys: Set<string>
  selectedTargets: TTarget[]
  selectedProviders: ProviderIdentity[] | undefined
  resolved: AdditiveResumeProviderSelection<ProviderIdentity>
}

async function prepareGenerationResume<TTarget extends ProviderIdentity, TMetadata>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata>,
  opts: RuntimeOptions,
  explicitFlags: Set<string>,
  throwOnInvalid: true
): Promise<GenerationResumePreparation<TTarget, TMetadata>>
async function prepareGenerationResume<TTarget extends ProviderIdentity, TMetadata>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata>,
  opts: RuntimeOptions,
  explicitFlags: Set<string>,
  throwOnInvalid: false
): Promise<GenerationResumePreparation<TTarget, TMetadata> | undefined>
async function prepareGenerationResume<TTarget extends ProviderIdentity, TMetadata>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata>,
  opts: RuntimeOptions,
  explicitFlags: Set<string>,
  throwOnInvalid: boolean
): Promise<GenerationResumePreparation<TTarget, TMetadata> | undefined> {
  if (config.selectionMode === 'selected-only' && target.scope !== 'single') {
    if (throwOnInvalid) {
      throw CLIUsageError(`${config.stepLabel} resume currently supports single-run run.json outputs only.`)
    }
    return undefined
  }

  const manifest = await readRunManifest(target.dir, config.kind)
  if (!manifest) {
    if (throwOnInvalid) {
      const manifestLabel = config.selectionMode === 'selected-only'
        ? config.stepLabel.toLowerCase()
        : config.stepLabel
      throw CLIUsageError(`Invalid ${manifestLabel} manifest at ${target.dir}/run.json`)
    }
    return undefined
  }

  const existingEntries = config.parseManifestEntries
    ? config.parseManifestEntries(manifest.metadata)
    : Array.isArray(manifest.metadata[config.metadataKey])
      ? manifest.metadata[config.metadataKey] as TMetadata[]
      : []
  const storedProviders = config.selectionMode === 'additive-stored'
    ? parseStoredRequestedProviders(manifest.metadata)
    : undefined
  const hasStoredInput = typeof manifest.metadata['input'] === 'string'
    && manifest.metadata['input'].length > 0
  const invalidManifest = existingEntries === undefined
    || (config.selectionMode === 'additive-stored' && (!hasStoredInput || !storedProviders))

  if (invalidManifest) {
    if (throwOnInvalid) {
      throw CLIUsageError(config.selectionMode === 'additive-stored'
        ? `This ${config.stepLabel} run.json does not contain resume metadata (input/requestedProviders). `
          + 'Re-run the original command to produce a resumable manifest.'
        : `This ${config.stepLabel.toLowerCase()} run.json does not contain resumable ${config.metadataKey} LLM metadata. `
          + `Re-run the original command to produce a resumable ${config.stepLabel.toLowerCase()} manifest.`
      )
    }
    return undefined
  }

  const successKeys = new Set(
    existingEntries.map(config.getSuccessKey)
  )

  const storedMissingProviders = (storedProviders ?? []).filter(
    (provider) => !successKeys.has(getGenerationTargetKey(provider.service, provider.model))
  )
  const selectedTargets = hasExplicitGenerationProviderSelection(config.providerFlags, explicitFlags)
    ? uniqueResumeProviders(config.collectTargets(opts, target))
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
      })
    : resolveAdditiveResumeProviderSelection({
        storedProviders: [],
        runnableStoredProviders: [],
        ...(selectedProviders ? { selectedProviders } : {}),
        successfulProviderKeys: successKeys
      })

  return {
    manifest,
    existingEntries,
    successKeys,
    selectedTargets,
    selectedProviders,
    resolved
  }
}

const resolveGenerationTargetsToRunOrThrow = <TTarget extends ProviderIdentity, TMetadata>(
  target: ResumeTarget,
  prep: GenerationResumePreparation<TTarget, TMetadata>,
  config: GenerationResumeConfig<TTarget, TMetadata>,
  opts: RuntimeOptions
): TTarget[] => {
  const targetsToRun = selectTargetsForProviders(
    prep.resolved.providersToRun,
    prep.selectedTargets,
    (providers) => config.modelFields
      ? collectGenerationTargetsForProviders(
          providers,
          opts,
          config.modelFields,
          (providerOpts) => config.collectTargets(providerOpts, target)
        )
      : []
  )

  if (targetsToRun.length === 0) {
    throw CLIUsageError(
      `Could not reconstruct targets for missing providers: ${prep.resolved.providersToRun.map((p) => `${p.service}/${p.model}`).join(', ')}. `
      + 'Pass explicit provider flags matching the original models.'
    )
  }

  return targetsToRun
}

const resolveGenerationInput = async <TTarget extends ProviderIdentity, TMetadata>(
  target: ResumeTarget,
  prep: GenerationResumePreparation<TTarget, TMetadata>,
  config: GenerationResumeConfig<TTarget, TMetadata>
): Promise<string> => {
  if (config.resolveInput) {
    return await config.resolveInput(target, prep.manifest.metadata)
  }
  return prep.manifest.metadata['input'] as string
}

const buildGenerationFailureMessage = <TTarget extends ProviderIdentity, TMetadata>(
  config: GenerationResumeConfig<TTarget, TMetadata>,
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

export const hasResumableGenerationWork = async <TTarget extends ProviderIdentity, TMetadata>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata>,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set()
): Promise<boolean> => {
  const prep = await prepareGenerationResume(target, config, opts, explicitFlags, false)
  return prep !== undefined && prep.resolved.providersToRun.length > 0
}

export const resumeGenerationTarget = async <TTarget extends ProviderIdentity, TMetadata>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata>,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set(),
  displayOptions: ResumeDisplayOptions = {}
): Promise<ResumeResult> => {
  const itemLabel = displayOptions.itemLabel ?? '1/1'
  const prep = await prepareGenerationResume(target, config, opts, explicitFlags, true)
  const { manifest, existingEntries, successKeys, selectedProviders, resolved } = prep
  const hasExplicitSelectedProviders = selectedProviders !== undefined

  if (resolved.providersToRun.length === 0) {
    const unresolvedProviders = resolved.requestedProviders.filter(
      (provider) => !successKeys.has(getGenerationTargetKey(provider.service, provider.model))
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
          ? 'selected providers complete; run manifest still incomplete'
          : hasExplicitSelectedProviders
            ? 'all selected providers already complete'
            : 'all providers already complete'
    }, 'success')
    logResumeSummary(l, { full: 1, incomplete: 0, failed: 0 })
    return { full: 1, incomplete: 0, failed: 0 }
  }

  const input = await resolveGenerationInput(target, prep, config)
  const targetsToRun = resolveGenerationTargetsToRunOrThrow(target, prep, config, opts)

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
      targets: targetsToRun,
      existingEntries,
      currentManifestMetadata: manifest.metadata
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
    throw InfraError(
      buildGenerationFailureMessage(config, 'failed', targetsToRun),
      { stage: 'resume:generation', exitCode: 2 }
    )
  }

  const mergedMetadata = [...existingEntries, ...newMetadata]

  const mergedSuccessKeys = new Set(mergedMetadata.map(config.getSuccessKey))
  const stillMissing = resolved.requestedProviders.filter(
    (p) => !mergedSuccessKeys.has(getGenerationTargetKey(p.service, p.model))
  )
  const rebuiltMetadata = config.rebuildRunMetadata
    ? config.rebuildRunMetadata(mergedMetadata, manifest.metadata, input)
    : {}

  await writeRunManifest(target.dir, config.kind, {
    ...manifest.metadata,
    ...rebuiltMetadata,
    ...(config.selectionMode === 'additive-stored'
      ? { requestedProviders: resolved.requestedProviders.map(toProviderIdentity) }
      : {}),
    [config.metadataKey]: config.serializeEntries
      ? config.serializeEntries(mergedMetadata)
      : mergedMetadata
  })

  if (stillMissing.length > 0) {
    if (
      hasExplicitSelectedProviders
      && selectedProviders
      && allProvidersSucceeded(selectedProviders, mergedSuccessKeys)
    ) {
      logResumeItem(l, {
        item: itemLabel,
        status: 'full',
        outputDir: target.dir,
        providers: providerLabels,
        detail: 'selected providers complete; run manifest still incomplete'
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

export const priceGenerationTarget = async <TTarget extends ProviderIdentity, TMetadata>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata>,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set()
): Promise<AggregatedPriceEstimate> => {
  const prep = await prepareGenerationResume(target, config, opts, explicitFlags, true)
  if (prep.resolved.providersToRun.length === 0) {
    return aggregateExplicitPriceEstimate([], opts)
  }

  const input = await resolveGenerationInput(target, prep, config)
  const targetsToRun = resolveGenerationTargetsToRunOrThrow(target, prep, config, opts)
  const priceOpts = config.modelFields
    ? buildGenerationPriceOptions(targetsToRun, opts, config.modelFields)
    : opts
  const steps = await config.buildEstimates(priceOpts, input, {
    targets: targetsToRun,
    existingEntries: prep.existingEntries,
    currentManifestMetadata: prep.manifest.metadata
  })
  return aggregateExplicitPriceEstimate(
    steps,
    priceOpts,
    config.priceAggregateOptions?.(input)
  )
}

export const buildGenerationResumeHandler = <TTarget extends ProviderIdentity, TMetadata>(
  kind: ResumeTargetKind,
  config: GenerationResumeConfig<TTarget, TMetadata>
): ResumeHandler => ({
  kind,
  hasResumableWork: async (target, opts, explicitFlags) =>
    await hasResumableGenerationWork(target, config, opts, explicitFlags),
  resume: async (target, opts, explicitFlags, displayOptions) =>
    await resumeGenerationTarget(target, config, opts, explicitFlags, displayOptions),
  price: async (target, opts, explicitFlags) =>
    await priceGenerationTarget(target, config, opts, explicitFlags)
})
