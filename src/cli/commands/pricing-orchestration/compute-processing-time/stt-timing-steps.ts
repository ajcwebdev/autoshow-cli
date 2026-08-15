import type { ComputeEstimatedProcessingTimesInput, TimingStepEntry, TimingStepsResult } from '~/types'
import { getSttEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { roundMs, withNormalizedTiming } from './timing-shared'

export const buildSttTimingSteps = (input: ComputeEstimatedProcessingTimesInput): TimingStepsResult => {
  const steps: TimingStepEntry[] = []

  if (input.sttTargets && input.sttTargets.length > 0 && typeof input.audioDurationSeconds === 'number') {
    for (const target of input.sttTargets) {
      const estimation = getSttEstimation(target.service, target.model)
      steps.push(withNormalizedTiming({
        step: 'stt',
        provider: target.service,
        model: target.model,
        processingTimeMs: roundMs(input.audioDurationSeconds * estimation.msPerSecond),
        inputMetric: 'durationSeconds',
        inputValue: input.audioDurationSeconds,
      }, 'estimated'))
    }
  } else if (
    input.transcriptionService
    && input.transcriptionModel
    && typeof input.audioDurationSeconds === 'number'
  ) {
    const estimation = getSttEstimation(input.transcriptionService, input.transcriptionModel)
    steps.push(withNormalizedTiming({
      step: 'stt',
      provider: input.transcriptionService,
      model: input.transcriptionModel,
      processingTimeMs: roundMs(input.audioDurationSeconds * estimation.msPerSecond),
      inputMetric: 'durationSeconds',
      inputValue: input.audioDurationSeconds,
    }, 'estimated'))
  }

  return { steps }
}
