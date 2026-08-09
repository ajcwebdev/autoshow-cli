import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { buildUpdatedGenerationCostTiming } from '../generation-resume'
import { collectVideoTargets } from '~/cli/commands/process-steps/step-6-video/video-targets'
import { runVideoTargets } from '~/cli/commands/process-steps/step-6-video/run-video-gen'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeActualProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { buildVideoEstimates } from '~/utils/pricing/aggregate-pricing/generation-estimates'
import type { GenerationResumeConfig, RuntimeOptions, Step6VideoMetadata, VideoTarget } from '~/types'

const VIDEO_PROVIDER_FLAGS = [
  'all-video',
  'gemini-video',
  'minimax-video',
  'glm-video',
  'grok-video',
  'runway-video',
  'ltx-video',
  'replicate-video',
  'lumalabs-video',
  'fal-video'
] as const

const VIDEO_MODEL_FIELDS = {
  gemini: ['geminiVideoModels', 'geminiVideoModel'],
  minimax: ['minimaxVideoModels', 'minimaxVideoModel'],
  glm: ['glmVideoModels', 'glmVideoModel'],
  grok: ['grokVideoModels', 'grokVideoModel'],
  runway: ['runwayVideoModels', 'runwayVideoModel'],
  ltx: ['ltxVideoModels', 'ltxVideoModel'],
  replicate: ['replicateVideoModels', 'replicateVideoModel'],
  lumalabs: ['lumalabsVideoModels', 'lumalabsVideoModel'],
  fal: ['falVideoModels', 'falVideoModel']
} as const

export const videoResumeConfig = {
  kind: 'video' as const,
  metadataKey: 'video',
  stepLabel: 'Video',
  providerFlags: VIDEO_PROVIDER_FLAGS,
  selectionMode: 'additive-stored' as const,
  modelFields: VIDEO_MODEL_FIELDS,
  getSuccessKey: (entry: Step6VideoMetadata) =>
    getGenerationTargetKey(entry.videoGenService, entry.videoGenModel),
  collectTargets: (opts: RuntimeOptions) => collectVideoTargets(opts),
  runMissingTargets: async (
    targets: VideoTarget[],
    input: string,
    outputDir: string,
    opts: RuntimeOptions
  ) => {
    const { metadata } = await runVideoTargets(targets, input, outputDir, opts)
    return metadata
  },
  buildEstimates: async (opts: RuntimeOptions) => await buildVideoEstimates(opts),
  rebuildRunMetadata: (
    metadata: Step6VideoMetadata[],
    currentManifestMetadata: Record<string, unknown>
  ) => buildUpdatedGenerationCostTiming(
    currentManifestMetadata,
    computeActualCosts({ step6: metadata }),
    computeActualProcessingTimes({ step6: metadata })
  )
} satisfies GenerationResumeConfig<VideoTarget, Step6VideoMetadata>
