import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { buildGenerationPriceOptions, buildUpdatedGenerationCostTiming, collectGenerationTargetsForProviders, hasResumableGenerationWork, priceGenerationTarget, resumeGenerationTarget } from '../generation-resume'
import { collectImageTargets } from '~/cli/commands/process-steps/step-5-image/image-generation-targets'
import { runImageTargets } from '~/cli/commands/process-steps/step-5-image/run-image-gen'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeActualProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { aggregateExplicitPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import { buildImageEstimates } from '~/utils/pricing/aggregate-pricing/generation-estimates'
import type { AggregatedPriceEstimate, ImageTarget, ResumeDisplayOptions, ResumeResult, ResumeTarget, RuntimeOptions, Step5Metadata } from '~/types'

const IMAGE_PROVIDER_FLAGS = [
  'all-image',
  'gemini-image',
  'openai-image',
  'grok-image',
  'bfl-image',
  'recraft-image',
  'replicate-image',
  'lumalabs-image',
  'fal-image'
] as const

const IMAGE_MODEL_FIELDS = {
  gemini: ['geminiImageModels', 'geminiImageModel'],
  openai: ['openaiImageModels', 'openaiImageModel'],
  grok: ['grokImageModels', 'grokImageModel'],
  bfl: ['bflImageModels', 'bflImageModel'],
  recraft: ['recraftImageModels', 'recraftImageModel'],
  replicate: ['replicateImageModels', 'replicateImageModel'],
  lumalabs: ['lumalabsImageModels', 'lumalabsImageModel'],
  fal: ['falImageModels', 'falImageModel']
} as const

const collectImageTargetsForProviders = (
  providers: Array<{ service: string, model: string }>,
  opts: RuntimeOptions
): ImageTarget[] =>
  collectGenerationTargetsForProviders(providers, opts, IMAGE_MODEL_FIELDS, collectImageTargets)

const priceImageTargets = async (
  targets: ImageTarget[],
  _input: string,
  opts: RuntimeOptions
): Promise<AggregatedPriceEstimate> => {
  const priceOpts = buildGenerationPriceOptions(targets, opts, IMAGE_MODEL_FIELDS)
  return aggregateExplicitPriceEstimate(buildImageEstimates(priceOpts), priceOpts)
}

const imageResumeConfig = {
  kind: 'image' as const,
  metadataKey: 'image',
  stepLabel: 'Image',
  providerFlags: IMAGE_PROVIDER_FLAGS,
  getSuccessKey: (entry: Step5Metadata) =>
    getGenerationTargetKey(entry.imageService, entry.imageModel),
  collectTargets: (opts: RuntimeOptions) => collectImageTargets(opts),
  collectTargetsForProviders: collectImageTargetsForProviders,
  runMissingTargets: async (
    targets: ImageTarget[],
    input: string,
    outputDir: string,
    opts: RuntimeOptions
  ) => {
    const { metadata } = await runImageTargets(targets, input, outputDir, opts)
    return metadata
  },
  priceTargets: priceImageTargets,
  rebuildRunMetadata: (
    metadata: Step5Metadata[],
    currentManifestMetadata: Record<string, unknown>
  ) => buildUpdatedGenerationCostTiming(
    currentManifestMetadata,
    computeActualCosts({ step5: metadata }),
    computeActualProcessingTimes({ step5: metadata })
  )
}

export const hasResumableImageWork = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set()
): Promise<boolean> =>
  await hasResumableGenerationWork(target, imageResumeConfig, opts, explicitFlags)

export const resumeImageTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set(),
  displayOptions: ResumeDisplayOptions = {}
): Promise<ResumeResult> =>
  await resumeGenerationTarget(target, imageResumeConfig, opts, explicitFlags, displayOptions)

export const priceImageTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set()
): Promise<AggregatedPriceEstimate> =>
  await priceGenerationTarget(target, imageResumeConfig, opts, explicitFlags)
