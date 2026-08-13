import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { buildUpdatedGenerationCostTiming } from '../generation-resume'
import { collectVideoTargets } from '~/cli/commands/process-steps/step-6-video/video-targets'
import { runVideoTargets } from '~/cli/commands/process-steps/step-6-video/run-video-gen'
import { deriveGenerationResumeModelFields, deriveGenerationResumeProviderFlags, VIDEO_GENERATION_SELECTION } from '~/cli/flags/service-selector-normalization/provider-targets'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeActualProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { buildVideoEstimates } from '~/cli/commands/pricing-orchestration/aggregate-pricing/generation-estimates'
import type { GenerationResumeConfig, Step6VideoMetadata, VideoGenOptions, VideoTarget } from '~/types'

export const videoResumeConfig = {
  kind: 'video' as const,
  metadataKey: 'video',
  stepLabel: 'Video',
  providerFlags: deriveGenerationResumeProviderFlags(VIDEO_GENERATION_SELECTION, 'all-video'),
  selectionMode: 'additive-stored' as const,
  modelFields: deriveGenerationResumeModelFields(VIDEO_GENERATION_SELECTION),
  getSuccessKey: (entry: Step6VideoMetadata) =>
    getGenerationTargetKey(entry.videoGenService, entry.videoGenModel),
  collectTargets: (opts: VideoGenOptions) => collectVideoTargets(opts),
  runMissingTargets: async (
    targets: VideoTarget[],
    input: string,
    outputDir: string,
    opts: VideoGenOptions
  ) => {
    const { metadata } = await runVideoTargets(targets, input, outputDir, opts)
    return metadata
  },
  buildEstimates: async (opts: VideoGenOptions) => await buildVideoEstimates(opts),
  rebuildRunMetadata: (
    metadata: Step6VideoMetadata[],
    currentManifestMetadata: Record<string, unknown>
  ) => buildUpdatedGenerationCostTiming(
    currentManifestMetadata,
    computeActualCosts({ step6: metadata }),
    computeActualProcessingTimes({ step6: metadata })
  )
} satisfies GenerationResumeConfig<VideoTarget, Step6VideoMetadata, VideoGenOptions>
