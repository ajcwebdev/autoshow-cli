import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { getResumeProviderKey, resolveAdditiveResumeProviderSelection, uniqueResumeProviders } from './resume-provider-selection'
import { UsageError } from '~/utils/error-handler'
import type { GenerationModelFieldTable, GenerationResumeConfig, GenerationResumePreparation, GenerationResumeProviderIdentity, PipelineManifest, PipelineManifestItem, ProviderIdentity, ResumeTarget } from '~/types'

export const clearProviderModelFields = <TOptions extends object>(
  opts: TOptions,
  fields: GenerationModelFieldTable
): TOptions => {
  const cleared = { ...opts }
  for (const modelsField of Object.values(fields)) {
    Reflect.set(cleared, modelsField, undefined)
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
    const modelsField = fields[provider.service]
    if (!modelsField) {
      return []
    }
    const providerOptions = clearProviderModelFields(opts, fields)
    Reflect.set(providerOptions, modelsField, [provider.model])
    return collect(providerOptions).filter((target) =>
      target.service === provider.service && target.model === provider.model
    )
  })

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

export const getConfiguredProviderKey = <TTarget extends ProviderIdentity, TMetadata, TOptions extends object>(
  config: GenerationResumeConfig<TTarget, TMetadata, TOptions>,
  provider: ProviderIdentity
): string => config.getProviderKey
  ? config.getProviderKey(toProviderIdentity(provider))
  : getResumeProviderKey(provider)

export async function prepareGenerationResume<TTarget extends ProviderIdentity, TMetadata, TOptions extends object>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata, TOptions>,
  opts: TOptions,
  explicitFlags: Set<string>,
  throwOnInvalid: true,
  itemIndex?: number,
  manifestSnapshot?: PipelineManifest
): Promise<GenerationResumePreparation<TTarget, TMetadata>>
export async function prepareGenerationResume<TTarget extends ProviderIdentity, TMetadata, TOptions extends object>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata, TOptions>,
  opts: TOptions,
  explicitFlags: Set<string>,
  throwOnInvalid: false,
  itemIndex?: number,
  manifestSnapshot?: PipelineManifest
): Promise<GenerationResumePreparation<TTarget, TMetadata> | undefined>
export async function prepareGenerationResume<TTarget extends ProviderIdentity, TMetadata, TOptions extends object>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata, TOptions>,
  opts: TOptions,
  explicitFlags: Set<string>,
  throwOnInvalid: boolean,
  itemIndex = 0,
  manifestSnapshot?: PipelineManifest
): Promise<GenerationResumePreparation<TTarget, TMetadata> | undefined> {
  if (
    target.scope !== 'single'
    && config.selectionMode === 'selected-only'
  ) {
    if (throwOnInvalid) {
      throw UsageError(`${config.stepLabel} resume currently supports single-run manifest.json outputs only.`)
    }
    return undefined
  }

  const manifest = manifestSnapshot ?? await readManifest(target.dir)
  if (!manifest || manifest.command !== config.kind || manifest.scope !== target.scope) {
    if (throwOnInvalid) {
      const manifestLabel = config.selectionMode === 'selected-only'
        ? config.stepLabel.toLowerCase()
        : config.stepLabel
      throw UsageError(`Invalid ${manifestLabel} manifest at ${target.dir}/manifest.json`)
    }
    return undefined
  }

  const item = manifest.items[itemIndex]
  if (!item) {
    if (throwOnInvalid) {
      throw UsageError(`Invalid ${config.stepLabel} manifest at ${target.dir}/manifest.json`)
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
      throw UsageError(config.selectionMode === 'additive-stored'
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
      throw UsageError(resumeValidationError)
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

export const resolveGenerationTargetsToRunOrThrow = async <TTarget extends ProviderIdentity, TMetadata, TOptions extends object>(
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
    throw UsageError(
      `Could not reconstruct targets for missing providers: ${prep.resolved.providersToRun.map((p) => `${p.service}/${p.model}`).join(', ')}. `
      + 'Pass explicit provider flags matching the original models.'
    )
  }

  return targetsToRun
}

export const resolveGenerationInput = async <TTarget extends ProviderIdentity, TMetadata, TOptions extends object>(
  target: ResumeTarget,
  prep: GenerationResumePreparation<TTarget, TMetadata>,
  config: GenerationResumeConfig<TTarget, TMetadata, TOptions>
): Promise<string> => {
  if (config.resolveInput) {
    return await config.resolveInput(target, prep.item.metadata, prep.item)
  }
  return prep.item.input as string
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
      const prep = await prepareGenerationResume(target, config, opts, explicitFlags, false, itemIndex, manifest)
      if (prep !== undefined && prep.resolved.providersToRun.length > 0) return true
    }
    return false
  }
  const prep = await prepareGenerationResume(target, config, opts, explicitFlags, false)
  return prep !== undefined && prep.resolved.providersToRun.length > 0
}
