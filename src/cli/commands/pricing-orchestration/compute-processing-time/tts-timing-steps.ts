import type { ComputeEstimatedProcessingTimesInput, TimingStepEntry, TimingStepsResult } from '~/types'
import { estimateTtsSynthesisProcessingTimeMs } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { getTtsEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { roundMs, withNormalizedTiming } from './timing-shared'

export const buildTtsTimingSteps = (input: ComputeEstimatedProcessingTimesInput): TimingStepsResult => {
  const steps: TimingStepEntry[] = []

  const ttsTargets = input.ttsTargets && input.ttsTargets.length > 0
    ? input.ttsTargets
    : input.ttsService && input.ttsModel
      ? [{ service: input.ttsService, model: input.ttsModel }]
      : []

  for (const ttsTarget of ttsTargets) {
    const estimation = getTtsEstimation(ttsTarget.service, ttsTarget.model)
    const characterCount = Math.max(0, ttsTarget.characterCount ?? input.ttsCharacterCount ?? 0)
    steps.push(withNormalizedTiming({
      step: 'tts',
      provider: ttsTarget.service,
      model: ttsTarget.model,
      processingTimeMs: roundMs(estimateTtsSynthesisProcessingTimeMs({
        provider: ttsTarget.service,
        model: ttsTarget.model,
        text: ttsTarget.characterCount === undefined ? input.ttsInputText : undefined,
        characterCount,
        msPer1KChars: estimation.msPer1KChars,
        setupTimeMs: ttsTarget.setupTimeMs,
        chunkConcurrency: ttsTarget.chunkConcurrency ?? input.ttsChunkConcurrency,
        concurrencyMode: input.concurrencyMode ?? 'ramp',
      })),
      inputMetric: 'characters',
      inputValue: characterCount,
    }, 'estimated'))
  }

  return { steps }
}
