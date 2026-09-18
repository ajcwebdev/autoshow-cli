import type { ComputeEstimatedProcessingTimesInput } from '~/types'
import { isHostedOcrTimingProvider } from './timing-shared'

type ExtractTarget = NonNullable<ComputeEstimatedProcessingTimesInput['extractTargets']>[number]

export const resolveExtractTimingTargets = (
  input: ComputeEstimatedProcessingTimesInput
): ExtractTarget[] => {
  return input.extractTargets && input.extractTargets.length > 0 ? [...input.extractTargets] : []
}

export const countHostedExtractTargetsByProvider = (
  targets: readonly ExtractTarget[]
): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>()
  for (const target of targets) {
    if (isHostedOcrTimingProvider(target.provider)) {
      counts.set(target.provider, (counts.get(target.provider) ?? 0) + 1)
    }
  }
  return counts
}
