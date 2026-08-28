import type { ComputeEstimatedProcessingTimesInput, EstimateConfidence, TimingStepEntry, TimingStepsResult } from '~/types'
import { mergeEstimateConfidence, resolveOcrConcurrencyMode } from './timing-shared'
import { buildExtractTimingStep } from './extract-timing-step-builder'
import { countHostedExtractTargetsByProvider, resolveExtractTimingTargets } from './extract-timing-targets'

export const buildExtractTimingSteps = (input: ComputeEstimatedProcessingTimesInput): TimingStepsResult => {
  const steps: TimingStepEntry[] = []
  let estimateConfidence: EstimateConfidence = 'registry'
  const ocrConcurrencyMode = resolveOcrConcurrencyMode(input)
  const targets = resolveExtractTimingTargets(input)
  const hostedCounts = countHostedExtractTargetsByProvider(targets)
  for (const target of targets) {
    const { entry, confidence } = buildExtractTimingStep(
      target,
      input,
      ocrConcurrencyMode,
      hostedCounts.get(target.provider) ?? 1
    )
    estimateConfidence = mergeEstimateConfidence(estimateConfidence, confidence)
    steps.push(entry)
  }
  return { steps, confidence: estimateConfidence }
}
