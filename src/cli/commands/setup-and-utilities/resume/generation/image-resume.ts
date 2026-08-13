import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { buildUpdatedGenerationCostTiming } from '../generation-resume'
import { collectImageTargets } from '~/cli/commands/process-steps/step-5-image/image-generation-targets'
import { runImageTargets } from '~/cli/commands/process-steps/step-5-image/run-image-gen'
import { deriveGenerationResumeModelFields, deriveGenerationResumeProviderFlags, IMAGE_GENERATION_SELECTION } from '~/cli/flags/service-selector-normalization/provider-targets'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeActualProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { buildImageEstimates } from '~/cli/commands/pricing-orchestration/aggregate-pricing/generation-estimates'
import type { EstimateImageCostOptions, GenerationResumeConfig, ImageGenOptions, ImageTarget, Step5Metadata } from '~/types'

export const imageResumeConfig = {
  kind: 'image' as const,
  metadataKey: 'image',
  stepLabel: 'Image',
  providerFlags: deriveGenerationResumeProviderFlags(IMAGE_GENERATION_SELECTION, 'all-image'),
  selectionMode: 'additive-stored' as const,
  modelFields: deriveGenerationResumeModelFields(IMAGE_GENERATION_SELECTION),
  getSuccessKey: (entry: Step5Metadata) =>
    getGenerationTargetKey(entry.imageService, entry.imageModel),
  collectTargets: (opts: ImageGenOptions) => collectImageTargets(opts),
  runMissingTargets: async (
    targets: ImageTarget[],
    input: string,
    outputDir: string,
    opts: ImageGenOptions
  ) => {
    const { metadata } = await runImageTargets(targets, input, outputDir, opts)
    return metadata
  },
  buildEstimates: (opts: EstimateImageCostOptions) => buildImageEstimates(opts),
  rebuildRunMetadata: (
    metadata: Step5Metadata[],
    currentManifestMetadata: Record<string, unknown>
  ) => buildUpdatedGenerationCostTiming(
    currentManifestMetadata,
    computeActualCosts({ step5: metadata }),
    computeActualProcessingTimes({ step5: metadata })
  )
} satisfies GenerationResumeConfig<ImageTarget, Step5Metadata, ImageGenOptions>
