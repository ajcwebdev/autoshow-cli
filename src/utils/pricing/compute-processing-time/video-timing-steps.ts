import type { ComputeEstimatedProcessingTimesInput, TimingStepEntry, TimingStepsResult } from '~/types'
import { estimateVideoCosts, VIDEO_PRICING_PROVIDERS } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { getVideoEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { optionsForService } from '~/utils/pricing/model-selection'
import { roundMs, withNormalizedTiming } from './timing-shared'

const resolveVideoTimingDurationSeconds = (
  target: NonNullable<ComputeEstimatedProcessingTimesInput['videoTargets']>[number],
  input: Pick<ComputeEstimatedProcessingTimesInput, 'videoSize' | 'videoAspectRatio' | 'videoResolution' | 'videoMode'>
): number | undefined => {
  const estimates = estimateVideoCosts({
    ...optionsForService(VIDEO_PRICING_PROVIDERS, target.service, target.model),
    videoDuration: target.durationSeconds,
    videoSize: input.videoSize,
    videoAspectRatio: input.videoAspectRatio,
    videoResolution: input.videoResolution,
    videoMode: input.videoMode,
  })
  return estimates.find((estimate) => estimate.provider === target.service && estimate.model === target.model)?.durationSeconds
}

export const buildVideoTimingSteps = (input: ComputeEstimatedProcessingTimesInput): TimingStepsResult => {
  const steps: TimingStepEntry[] = []

  const videoTargets = input.videoTargets && input.videoTargets.length > 0
    ? input.videoTargets
    : input.videoService && input.videoModel
      ? [{
          service: input.videoService,
          model: input.videoModel,
          ...(input.videoDurationSeconds !== undefined ? { durationSeconds: input.videoDurationSeconds } : {})
        }]
      : []

  for (const videoTarget of videoTargets) {
    const durationSeconds = resolveVideoTimingDurationSeconds(videoTarget, input)
    if (typeof durationSeconds === 'number') {
      const estimation = getVideoEstimation(videoTarget.service, videoTarget.model)
      steps.push(withNormalizedTiming({
        step: 'video',
        provider: videoTarget.service,
        model: videoTarget.model,
        processingTimeMs: roundMs(durationSeconds * estimation.msPerSecond),
        inputMetric: 'durationSeconds',
        inputValue: durationSeconds,
      }, 'estimated'))
    }
  }

  return { steps }
}
