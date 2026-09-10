import type { ComputeWriteCostAndTimingContext } from '~/types'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { buildAggregatedPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import { preflightToEstimated } from '~/cli/commands/pricing-orchestration/compute-costs'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'

export const computeWriteCostAndTiming = async (ctx: ComputeWriteCostAndTimingContext) => {
  const {
    processingOptions,
    preflightEstimate,
    step1Metadata,
    transcriptionResult,
    mediaDurationSeconds
  } = ctx

  const step2EntriesForEstimation = Array.isArray(transcriptionResult.metadata)
    ? transcriptionResult.metadata
    : [transcriptionResult.metadata]
  const selectedSttTargets = step2EntriesForEstimation.map((entry) => ({
    service: entry.transcriptionService,
    model: entry.transcriptionModel
  }))

  const observedEstimate = computeEstimatedCosts({
    applyCostMultipliers: false,
    sttTargets: selectedSttTargets,
    audioDurationSeconds: mediaDurationSeconds,
    sourceUrl: processingOptions.url
  })
  const priceEstimateTarget = processingOptions.url ?? processingOptions.filePath ?? step1Metadata.url
  const priceAlignedEstimate = preflightEstimate ?? await buildAggregatedPriceEstimate(
    'extract',
    priceEstimateTarget,
    processingOptions
  )
  const estimated = preflightToEstimated(priceAlignedEstimate)

  const actual = computeActualCosts({
    step1: step1Metadata,
    step2: transcriptionResult.metadata,
    audioDurationSeconds: mediaDurationSeconds
  })

  const cost = { estimated, observedEstimate, actual }
  const fallbackEstimatedTiming = computeEstimatedProcessingTimes({
    sttTargets: selectedSttTargets,
    audioDurationSeconds: mediaDurationSeconds
  })
  const estimatedTiming = priceAlignedEstimate.timing ?? fallbackEstimatedTiming
  const actualTiming = computeActualProcessingTimes({
    audioDurationSeconds: mediaDurationSeconds,
    step2: transcriptionResult.metadata
  })
  const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
    ? { estimated: estimatedTiming, actual: actualTiming }
    : undefined

  return { cost, timing }
}
