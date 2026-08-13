import type { ComputeEstimatedProcessingTimesInput, TimingStepEntry, TimingStepsResult } from '~/types'
import { getImageEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { roundMs, withNormalizedTiming } from './timing-shared'

export const buildImageTimingSteps = (input: ComputeEstimatedProcessingTimesInput): TimingStepsResult => {
  const steps: TimingStepEntry[] = []

  const imageTargets = input.imageTargets && input.imageTargets.length > 0
    ? input.imageTargets
    : input.imageService && input.imageModel
      ? [{ service: input.imageService, model: input.imageModel, count: Math.max(1, input.imageCount ?? 1) }]
      : []

  for (const imageTarget of imageTargets) {
    const estimation = getImageEstimation(imageTarget.service, imageTarget.model)
    const imageCount = Math.max(1, imageTarget.count)
    steps.push(withNormalizedTiming({
      step: 'image',
      provider: imageTarget.service,
      model: imageTarget.model,
      processingTimeMs: roundMs(imageCount * estimation.msPerImage),
      inputMetric: 'images',
      inputValue: imageCount,
    }, 'estimated'))
  }

  return { steps }
}
