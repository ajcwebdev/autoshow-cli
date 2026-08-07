import { getVideoEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { estimateVideoCosts } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import type { ComputeEstimatedCostsInput, CostStepsResult } from '~/types'
import { pushGenerationEstimates } from './cost-steps-shared'

export const buildVideoCostSteps = (input: ComputeEstimatedCostsInput): CostStepsResult => {
  const hasVideo = input.videoTargets?.length
    || input.geminiVideoModel
    || input.minimaxVideoModel
    || input.glmVideoModel
    || input.grokVideoModel
    || input.runwayVideoModel
    || input.ltxVideoModel
    || input.replicateVideoModel
    || input.lumalabsVideoModel
    || input.falVideoModel
  if (!hasVideo) {
    return { steps: [], cost: 0 }
  }

  const videoEstimates = estimateVideoCosts({
    geminiVideoModels: input.videoTargets?.filter((target) => target.service === 'gemini').map((target) => target.model),
    geminiVideoModel: input.geminiVideoModel,
    minimaxVideoModels: input.videoTargets?.filter((target) => target.service === 'minimax').map((target) => target.model),
    minimaxVideoModel: input.minimaxVideoModel,
    glmVideoModels: input.videoTargets?.filter((target) => target.service === 'glm').map((target) => target.model),
    glmVideoModel: input.glmVideoModel,
    grokVideoModels: input.videoTargets?.filter((target) => target.service === 'grok').map((target) => target.model),
    grokVideoModel: input.grokVideoModel,
    runwayVideoModels: input.videoTargets?.filter((target) => target.service === 'runway').map((target) => target.model),
    runwayVideoModel: input.runwayVideoModel,
    ltxVideoModels: input.videoTargets?.filter((target) => target.service === 'ltx').map((target) => target.model),
    ltxVideoModel: input.ltxVideoModel,
    replicateVideoModels: input.videoTargets?.filter((target) => target.service === 'replicate').map((target) => target.model),
    replicateVideoModel: input.replicateVideoModel,
    lumalabsVideoModels: input.videoTargets?.filter((target) => target.service === 'lumalabs').map((target) => target.model),
    lumalabsVideoModel: input.lumalabsVideoModel,
    falVideoModels: input.videoTargets?.filter((target) => target.service === 'fal').map((target) => target.model),
    falVideoModel: input.falVideoModel,
    videoDuration: input.videoTargets?.find((target) => typeof target.durationSeconds === 'number')?.durationSeconds ?? input.videoDuration,
    videoSize: input.videoSize,
    videoAspectRatio: input.videoAspectRatio,
    videoResolution: input.videoResolution,
    videoMode: input.videoMode,
    ...(input.grokInputImageCount !== undefined ? { grokInputImageCount: input.grokInputImageCount } : {}),
    ...(input.grokInputVideoDurationSeconds !== undefined ? { grokInputVideoDurationSeconds: input.grokInputVideoDurationSeconds } : {}),
    ...(input.replicateVideoReferenceVideoCount !== undefined ? { replicateVideoReferenceVideoCount: input.replicateVideoReferenceVideoCount } : {})
  })

  return pushGenerationEstimates(
    videoEstimates,
    input,
    (estimate) => getVideoEstimation(estimate.provider, estimate.model).costMultiplier,
    'video',
    (estimate) => ({ durationSeconds: estimate.durationSeconds })
  )
}
