import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { buildUpdatedGenerationCostTiming } from '../generation-resume'
import { collectImageTargets } from '~/cli/commands/process-steps/step-5-image/image-generation-targets'
import { runImageTargets } from '~/cli/commands/process-steps/step-5-image/run-image-gen'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeActualProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { buildImageEstimates } from '~/utils/pricing/aggregate-pricing/generation-estimates'
import type { GenerationResumeConfig, ImageTarget, RuntimeOptions, Step5Metadata } from '~/types'

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

export const imageResumeConfig = {
  kind: 'image' as const,
  metadataKey: 'image',
  stepLabel: 'Image',
  providerFlags: IMAGE_PROVIDER_FLAGS,
  selectionMode: 'additive-stored' as const,
  modelFields: IMAGE_MODEL_FIELDS,
  getSuccessKey: (entry: Step5Metadata) =>
    getGenerationTargetKey(entry.imageService, entry.imageModel),
  collectTargets: (opts: RuntimeOptions) => collectImageTargets(opts),
  runMissingTargets: async (
    targets: ImageTarget[],
    input: string,
    outputDir: string,
    opts: RuntimeOptions
  ) => {
    const { metadata } = await runImageTargets(targets, input, outputDir, opts)
    return metadata
  },
  buildEstimates: (opts: RuntimeOptions) => buildImageEstimates(opts),
  rebuildRunMetadata: (
    metadata: Step5Metadata[],
    currentManifestMetadata: Record<string, unknown>
  ) => buildUpdatedGenerationCostTiming(
    currentManifestMetadata,
    computeActualCosts({ step5: metadata }),
    computeActualProcessingTimes({ step5: metadata })
  )
} satisfies GenerationResumeConfig<ImageTarget, Step5Metadata>
