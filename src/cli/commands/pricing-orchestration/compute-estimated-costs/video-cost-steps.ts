import { getVideoEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { estimateVideoCosts, VIDEO_PRICING_PROVIDERS } from '~/cli/commands/visuals/video/video-utils/video-pricing'
import type { ComputeEstimatedCostsInput, CostStepsResult } from '~/types'
import { optionsForService } from '~/utils/pricing/model-selection'
import { pushGenerationEstimates } from './cost-steps-shared'

export const buildVideoCostSteps = (input: ComputeEstimatedCostsInput): CostStepsResult => {
  if (!input.videoTargets?.length) {
    return { steps: [], cost: 0 }
  }

  const sharedOptions = {
    videoAspectRatio: input.videoAspectRatio,
    videoResolution: input.videoResolution,
    videoMode: input.videoMode,
    ...(input.grokInputImageCount !== undefined ? { grokInputImageCount: input.grokInputImageCount } : {}),
    ...(input.grokInputVideoDurationSeconds !== undefined ? { grokInputVideoDurationSeconds: input.grokInputVideoDurationSeconds } : {}),
    falVideoReferenceVideoCount: input.falVideoReferenceVideoCount,
    falInputVideoDurationSeconds: input.falInputVideoDurationSeconds,
    ...(input.replicateVideoReferenceVideoCount !== undefined ? { replicateVideoReferenceVideoCount: input.replicateVideoReferenceVideoCount } : {})
  }
  const videoEstimates = VIDEO_PRICING_PROVIDERS.flatMap((provider) =>
    input.videoTargets!
      .filter((target) => target.service === provider.service)
      .flatMap((target) => estimateVideoCosts({
        ...optionsForService(VIDEO_PRICING_PROVIDERS, provider.service, target.model),
        ...sharedOptions,
        videoDuration: target.durationSeconds ?? input.videoDuration
      }))
  )

  return pushGenerationEstimates(
    videoEstimates,
    input,
    (estimate) => getVideoEstimation(estimate.provider, estimate.model).costMultiplier,
    'video',
    (estimate) => ({ durationSeconds: estimate.durationSeconds })
  )
}
