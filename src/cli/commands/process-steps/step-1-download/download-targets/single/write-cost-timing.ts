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
    mediaDurationSeconds,
    step3Results,
    step3Serialized
  } = ctx

  const llmTargets = step3Results.map((s3) => ({
    service: s3.llmService,
    model: s3.llmModel,
    inputTokens: s3.inputTokenCount,
    outputTokens: s3.outputTokenCount
  }))
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
    sourceUrl: processingOptions.url,
    llmTargets,
    skipLLM: processingOptions.skipLLM
  })
  const priceEstimateTarget = processingOptions.url ?? processingOptions.filePath ?? step1Metadata.url
  const priceAlignedEstimate = preflightEstimate ?? await buildAggregatedPriceEstimate(
    'write',
    priceEstimateTarget,
    processingOptions
  )
  const estimated = preflightToEstimated(priceAlignedEstimate)

  const actual = computeActualCosts({
    step1: step1Metadata,
    step2: transcriptionResult.metadata,
    audioDurationSeconds: mediaDurationSeconds,
    ...(step3Serialized !== undefined ? { step3: step3Serialized } : {})
  })

  const cost = { estimated, observedEstimate, actual }
  const fallbackEstimatedTiming = computeEstimatedProcessingTimes({
    sttTargets: selectedSttTargets,
    audioDurationSeconds: mediaDurationSeconds,
    llmTargets,
    skipLLM: processingOptions.skipLLM
  })
  const estimatedTiming = priceAlignedEstimate.timing ?? fallbackEstimatedTiming
  const actualTiming = computeActualProcessingTimes({
    audioDurationSeconds: mediaDurationSeconds,
    step2: transcriptionResult.metadata,
    ...(step3Serialized !== undefined ? { step3: step3Serialized } : {})
  })
  const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
    ? { estimated: estimatedTiming, actual: actualTiming }
    : undefined

  return { cost, timing }
}
