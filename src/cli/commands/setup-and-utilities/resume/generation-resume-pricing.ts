import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { UsageError } from '~/utils/error-handler'
import { aggregateExplicitPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import type { AggregatedPriceEstimate, GenerationModelFieldTable, GenerationResumeConfig, PipelineManifest, ProviderIdentity, ResumeTarget } from '~/types'
import { clearProviderModelFields, prepareGenerationResume, resolveGenerationInput, resolveGenerationTargetsToRunOrThrow } from './generation-resume-preparation'

const buildGenerationPriceOptions = <TOptions extends object>(
  targets: ProviderIdentity[],
  opts: TOptions,
  fields: GenerationModelFieldTable
): TOptions => {
  const priceOpts = clearProviderModelFields(opts, fields)
  for (const [service, modelsField] of Object.entries(fields)) {
    const models = targets
      .filter((target) => target.service === service)
      .map((target) => target.model)
    if (models.length > 0) {
      Reflect.set(priceOpts, modelsField, models)
    }
  }
  return priceOpts
}

const priceGenerationItem = async <TTarget extends ProviderIdentity, TMetadata, TOptions extends object>(
  target: ResumeTarget,
  config: GenerationResumeConfig<TTarget, TMetadata, TOptions>,
  opts: TOptions,
  explicitFlags: Set<string>,
  itemIndex: number,
  manifestSnapshot?: PipelineManifest
): Promise<{ steps: Awaited<ReturnType<GenerationResumeConfig<TTarget, TMetadata, TOptions>['buildEstimates']>>, input: string, priceOpts: TOptions }> => {
  const prep = await prepareGenerationResume(target, config, opts, explicitFlags, true, itemIndex, manifestSnapshot)
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
    explicitFlags,
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
      throw UsageError(`Invalid ${config.stepLabel} manifest at ${target.dir}/manifest.json`)
    }
    const steps: Awaited<ReturnType<GenerationResumeConfig<TTarget, TMetadata, TOptions>['buildEstimates']>> = []
    let priceOpts = opts
    for (const [itemIndex] of manifest.items.entries()) {
      const priced = await priceGenerationItem(target, config, opts, explicitFlags, itemIndex, manifest)
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
