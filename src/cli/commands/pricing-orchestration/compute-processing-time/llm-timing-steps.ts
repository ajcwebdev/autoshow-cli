import type { ComputeEstimatedProcessingTimesInput, TimingStepEntry, TimingStepsResult } from '~/types'
import { getLlmEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { roundMs, withNormalizedTiming } from './timing-shared'

export const buildLlmTimingSteps = (input: ComputeEstimatedProcessingTimesInput): TimingStepsResult => {
  const steps: TimingStepEntry[] = []

  for (const llmTarget of input.llmTargets ?? []) {
    const registryService = llmTarget.service
    const estimation = getLlmEstimation(registryService, llmTarget.model)
    const tokenCount = Math.max(0, (llmTarget.inputTokens ?? 0) + (llmTarget.outputTokens ?? 0))
    steps.push(withNormalizedTiming({
      step: 'llm',
      provider: llmTarget.service,
      model: llmTarget.model,
      processingTimeMs: roundMs((tokenCount / 1000) * estimation.msPer1KTokens),
      inputMetric: 'tokens',
      inputValue: tokenCount,
    }, 'estimated'))
  }

  return { steps }
}
