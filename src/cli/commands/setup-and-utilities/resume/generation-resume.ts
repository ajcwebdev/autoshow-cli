import { isRecord } from '~/utils/rest-client'
import * as l from '~/utils/app-logger/app-logger'
import { readRunManifest, writeRunManifest } from '~/cli/commands/process-steps/manifest-utils'
import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { logResumeItem, logResumeSummary } from './resume-logging'
import { getResumeProviderKey, resolveAdditiveResumeProviderSelection, uniqueResumeProviders } from './resume-provider-selection'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import { aggregateExplicitPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import type { AdditiveResumeProviderSelection, AggregatedPriceEstimate, GenerationResumeConfig, ResumeDisplayOptions, ProviderIdentity, ResumeResult, ResumeTarget, RunManifest, RuntimeOptions } from '~/types'

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

export type GenerationModelFieldTable = Record<string, readonly [modelsField: string, modelField: string]>

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

const parseGenerationManifest = (
  metadata: Record<string, unknown>,
  metadataKey: string
): {
  input: string
  requestedProviders: Array<{ service: string, model: string }>
  existingEntries: unknown[]
} | undefined => {
  const input = typeof metadata['input'] === 'string' ? metadata['input'] : undefined
  const requestedProviders = Array.isArray(metadata['requestedProviders'])
    ? metadata['requestedProviders'].filter(
        (entry): entry is { service: string, model: string } =>
          isRecord(entry)
          && typeof entry['service'] === 'string'
          && typeof entry['model'] === 'string'
      )
    : undefined

  if (!input || !requestedProviders || requestedProviders.length === 0) {
    return undefined
  }

  const existingEntries = Array.isArray(metadata[metadataKey]) ? metadata[metadataKey] : []

  return { input, requestedProviders, existingEntries }
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

type GenerationResumePreparation<TTarget extends ProviderIdentity> = {
  manifest: RunManifest
  input: string
  existingEntries: unknown[]
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
): Promise<GenerationResumePreparation<TTarget>>
async function prepareGenerationResume<TTarget extends ProviderIdentity, TMetadata>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata>,
  opts: RuntimeOptions,
  explicitFlags: Set<string>,
  throwOnInvalid: false
): Promise<GenerationResumePreparation<TTarget> | undefined>
async function prepareGenerationResume<TTarget extends ProviderIdentity, TMetadata>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata>,
  opts: RuntimeOptions,
  explicitFlags: Set<string>,
  throwOnInvalid: boolean
): Promise<GenerationResumePreparation<TTarget> | undefined> {
  const manifest = await readRunManifest(target.dir, config.kind)
  if (!manifest) {
    if (throwOnInvalid) {
      throw CLIUsageError(`Invalid ${config.stepLabel} manifest at ${target.dir}/run.json`)
    }
    return undefined
  }

  const parsed = parseGenerationManifest(manifest.metadata, config.metadataKey)
  if (!parsed) {
    if (throwOnInvalid) {
      throw CLIUsageError(
        `This ${config.stepLabel} run.json does not contain resume metadata (input/requestedProviders). `
        + 'Re-run the original command to produce a resumable manifest.'
      )
    }
    return undefined
  }

  const successKeys = new Set(
    (parsed.existingEntries as TMetadata[]).map(config.getSuccessKey)
  )

  const storedMissingProviders = parsed.requestedProviders.filter(
    (provider) => !successKeys.has(getGenerationTargetKey(provider.service, provider.model))
  )
  const selectedTargets = hasExplicitGenerationProviderSelection(config.providerFlags, explicitFlags)
    ? config.collectTargets(opts)
    : []
  const selectedProviders = selectedTargets.length > 0
    ? selectedTargets.map(toProviderIdentity)
    : undefined
  const resolved = resolveAdditiveResumeProviderSelection({
    storedProviders: parsed.requestedProviders,
    runnableStoredProviders: storedMissingProviders,
    ...(selectedProviders ? { selectedProviders } : {}),
    successfulProviderKeys: successKeys
  })

  return {
    manifest,
    input: parsed.input,
    existingEntries: parsed.existingEntries,
    successKeys,
    selectedTargets,
    selectedProviders,
    resolved
  }
}

const resolveGenerationTargetsToRunOrThrow = <TTarget extends ProviderIdentity, TMetadata>(
  prep: GenerationResumePreparation<TTarget>,
  config: GenerationResumeConfig<TTarget, TMetadata>,
  opts: RuntimeOptions
): TTarget[] => {
  const targetsToRun = selectTargetsForProviders(
    prep.resolved.providersToRun,
    prep.selectedTargets,
    (providers) => config.collectTargetsForProviders(providers, opts)
  )

  if (targetsToRun.length === 0) {
    throw CLIUsageError(
      `Could not reconstruct targets for missing providers: ${prep.resolved.providersToRun.map((p) => `${p.service}/${p.model}`).join(', ')}. `
      + 'Pass explicit provider flags matching the original models.'
    )
  }

  return targetsToRun
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
  const { manifest, input, existingEntries, successKeys, selectedProviders, resolved } = prep
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
      detail: hasExplicitSelectedProviders && unresolvedProviders.length > 0
        ? 'selected providers complete; run manifest still incomplete'
        : hasExplicitSelectedProviders
          ? 'all selected providers already complete'
          : 'all providers already complete'
    }, 'success')
    logResumeSummary(l, { full: 1, incomplete: 0, failed: 0 })
    return { full: 1, incomplete: 0, failed: 0 }
  }

  const targetsToRun = resolveGenerationTargetsToRunOrThrow(prep, config, opts)

  const providerLabels = targetsToRun.map((t) => `${t.service}/${t.model}`)
  logResumeItem(l, {
    item: itemLabel,
    status: 'processing',
    outputDir: target.dir,
    providers: providerLabels,
    detail: 'resuming missing providers'
  }, 'info')

  let newMetadata: TMetadata[]
  try {
    newMetadata = await config.runMissingTargets(targetsToRun, input, target.dir, opts)
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
      `${config.stepLabel} resume still has failed providers: ${providerLabels.join(', ')}`,
      { stage: 'resume:generation', exitCode: 2 }
    )
  }

  const mergedMetadata = [...(existingEntries as TMetadata[]), ...newMetadata]

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
    requestedProviders: resolved.requestedProviders.map(toProviderIdentity),
    [config.metadataKey]: mergedMetadata
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
      `${config.stepLabel} resume still has ${stillMissing.length} incomplete provider(s)`,
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

  const targetsToRun = resolveGenerationTargetsToRunOrThrow(prep, config, opts)
  return await config.priceTargets(targetsToRun, prep.input, opts)
}
