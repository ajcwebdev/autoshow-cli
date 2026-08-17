import { getVideoEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { estimateVideoCosts, VIDEO_PRICING_PROVIDERS } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import type { ComputeEstimatedCostsInput, CostStepsResult } from '~/types'
import { optionsForService } from '~/utils/pricing/model-selection'
import { pushGenerationEstimates } from './cost-steps-shared'

export const buildVideoCostSteps = (input: ComputeEstimatedCostsInput): CostStepsResult => {
  const hasVideo = input.videoTargets?.length
    || VIDEO_PRICING_PROVIDERS.some((provider) => !!input[provider.modelKey])
  if (!hasVideo) {
    return { steps: [], cost: 0 }
  }

  const sharedOptions = {
    videoAspectRatio: input.videoAspectRatio,
    videoResolution: input.videoResolution,
    videoMode: input.videoMode,
    ...(input.grokInputImageCount !== undefined ? { grokInputImageCount: input.grokInputImageCount } : {}),
    ...(input.grokInputVideoDurationSeconds !== undefined ? { grokInputVideoDurationSeconds: input.grokInputVideoDurationSeconds } : {}),
    ...(input.replicateVideoReferenceVideoCount !== undefined ? { replicateVideoReferenceVideoCount: input.replicateVideoReferenceVideoCount } : {})
  }
  const selectionOptions = Object.assign({}, ...VIDEO_PRICING_PROVIDERS.map((provider) => {
    const model = input[provider.modelKey]
    return model ? optionsForService(VIDEO_PRICING_PROVIDERS, provider.service, model) : {}
  }))
  const videoEstimates = input.videoTargets === undefined
    ? estimateVideoCosts({ ...selectionOptions, ...sharedOptions, videoDuration: input.videoDuration })
    : input.videoTargets.length === 0
      ? estimateVideoCosts({ ...sharedOptions, videoDuration: input.videoDuration })
      : VIDEO_PRICING_PROVIDERS.flatMap((provider) =>
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
