import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { buildGenerationPriceOptions, buildUpdatedGenerationCostTiming, collectGenerationTargetsForProviders, hasResumableGenerationWork, priceGenerationTarget, resumeGenerationTarget } from '../generation-resume'
import { collectVideoTargets } from '~/cli/commands/process-steps/step-6-video/video-targets'
import { runVideoTargets } from '~/cli/commands/process-steps/step-6-video/run-video-gen'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeActualProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { aggregateExplicitPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import { buildVideoEstimates } from '~/utils/pricing/aggregate-pricing/generation-estimates'
import type { AggregatedPriceEstimate, ResumeDisplayOptions, ResumeResult, ResumeTarget, RuntimeOptions, Step6VideoMetadata, VideoTarget } from '~/types'

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

const collectVideoTargetsForProviders = (
  providers: Array<{ service: string, model: string }>,
  opts: RuntimeOptions
): VideoTarget[] =>
  collectGenerationTargetsForProviders(providers, opts, VIDEO_MODEL_FIELDS, collectVideoTargets)

const priceVideoTargets = async (
  targets: VideoTarget[],
  _input: string,
  opts: RuntimeOptions
): Promise<AggregatedPriceEstimate> => {
  const priceOpts = buildGenerationPriceOptions(targets, opts, VIDEO_MODEL_FIELDS)
  return aggregateExplicitPriceEstimate(await buildVideoEstimates(priceOpts), priceOpts)
}

const videoResumeConfig = {
  kind: 'video' as const,
  metadataKey: 'video',
  stepLabel: 'Video',
  providerFlags: VIDEO_PROVIDER_FLAGS,
  getSuccessKey: (entry: Step6VideoMetadata) =>
    getGenerationTargetKey(entry.videoGenService, entry.videoGenModel),
  collectTargets: (opts: RuntimeOptions) => collectVideoTargets(opts),
  collectTargetsForProviders: collectVideoTargetsForProviders,
  runMissingTargets: async (
    targets: VideoTarget[],
    input: string,
    outputDir: string,
    opts: RuntimeOptions
  ) => {
    const { metadata } = await runVideoTargets(targets, input, outputDir, opts)
    return metadata
  },
  priceTargets: priceVideoTargets,
  rebuildRunMetadata: (
    metadata: Step6VideoMetadata[],
    currentManifestMetadata: Record<string, unknown>
  ) => buildUpdatedGenerationCostTiming(
    currentManifestMetadata,
    computeActualCosts({ step6: metadata }),
    computeActualProcessingTimes({ step6: metadata })
  )
}

export const hasResumableVideoWork = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set()
): Promise<boolean> =>
  await hasResumableGenerationWork(target, videoResumeConfig, opts, explicitFlags)

export const resumeVideoTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set(),
  displayOptions: ResumeDisplayOptions = {}
): Promise<ResumeResult> =>
  await resumeGenerationTarget(target, videoResumeConfig, opts, explicitFlags, displayOptions)

export const priceVideoTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set()
): Promise<AggregatedPriceEstimate> =>
  await priceGenerationTarget(target, videoResumeConfig, opts, explicitFlags)
