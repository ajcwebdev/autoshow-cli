import { aggregateExplicitPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import { buildTtsEstimates, buildTtsTargetEstimates } from '~/cli/commands/pricing-orchestration/aggregate-pricing/tts-estimates'
import { logSuitePriceSummary } from '~/cli/commands/process-steps/step-1-download/download-targets/suite-price-logging'
import type { ActualCostBreakdown, AggregatedPriceEstimate, EstimatedCostBreakdown, PreparedTtsInput, StepTimingBreakdown, TtsBatchEstimateReport, TtsOptions, TtsTarget } from '~/types'
import { UsageError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { formatDuration, formatEstimatedCostWithExactCents } from '~/utils/app-logger/formatters'
import { buildTtsBatchEstimateSummary } from './tts-batch-summary'

const formatCents = (amount: number): string => `${amount.toFixed(3)}¢`

export const buildTtsEstimateForInput = async (
  prepared: PreparedTtsInput,
  ttsOptions: TtsOptions,
  targets?: readonly TtsTarget[]
): Promise<AggregatedPriceEstimate> => {
  const steps = targets
    ? await buildTtsTargetEstimates(targets, ttsOptions, prepared.ttsCharacterCount)
    : await buildTtsEstimates(ttsOptions, prepared.ttsCharacterCount)
  return aggregateExplicitPriceEstimate(steps, ttsOptions, {
    ttsTimingCharacterCount: prepared.ttsCharacterCount,
    ttsInputText: prepared.ttsTimingInputText
  })
}

export const reportTtsBatchEstimates = async (
  preparedInputs: PreparedTtsInput[],
  ttsOptions: TtsOptions,
  targets: TtsTarget[],
  logItems: boolean,
  batchConcurrency: number
): Promise<TtsBatchEstimateReport> => {
  const estimates: AggregatedPriceEstimate[] = []

  for (const prepared of preparedInputs) {
    if (logItems) {
      l.write('info', `Estimating TTS input ${prepared.inputPath}: ${prepared.ttsCharacterCount} characters`, {
        category: 'pricing',
        metadata: {
          input: prepared.inputPath,
          characters: prepared.ttsCharacterCount
        }
      })
    }

    const estimate = await buildTtsEstimateForInput(prepared, ttsOptions, targets)
    estimates.push(estimate)

    if (logItems) {
      l.report.estimate(estimate)
    }
  }

  const summary = buildTtsBatchEstimateSummary(estimates, batchConcurrency, ttsOptions.ttsChunkConcurrency, {
    preparedInputs,
    targets
  })
  l.write('info', `TTS batch estimate: ${summary.inputCount} inputs, ${formatEstimatedCostWithExactCents(summary.totalEstimatedCost)}, ${formatDuration(summary.estimatedWallTimeMs)}`, {
    category: 'pricing',
    metadata: summary
  })

  if (logItems) {
    logSuitePriceSummary({
      checkedLabel: preparedInputs.length === 1 ? 'TTS input' : 'TTS inputs',
      checkedCount: preparedInputs.length,
      totalEstimatedCost: summary.totalEstimatedCost
    })
  }

  return { estimates, totalEstimatedCost: summary.totalEstimatedCost, summary }
}

export const enforceTtsBatchBudget = (
  totalEstimatedCost: number,
  maxCents: number | undefined,
  allowOverBudget: boolean
): void => {
  if (maxCents === undefined || totalEstimatedCost <= maxCents) {
    return
  }

  if (!allowOverBudget) {
    throw UsageError(
      `Estimated suite cost ${formatCents(totalEstimatedCost)} exceeds configured budget ${formatCents(maxCents)}. Use --allow-over-budget to proceed.`
    )
  }

  l.warn(`Estimated suite cost ${formatCents(totalEstimatedCost)} exceeds budget ${formatCents(maxCents)} - continuing because --allow-over-budget is set.`, {
      category: 'pricing',
      metadata: { estimatedCostCents: totalEstimatedCost, budgetCents: maxCents, allowOverBudget: true }
    })
}

export const mergeEstimatedCostBreakdowns = (
  breakdowns: EstimatedCostBreakdown[]
): EstimatedCostBreakdown => ({
  totalCost: breakdowns.reduce((sum, breakdown) => sum + breakdown.totalCost, 0),
  steps: breakdowns.flatMap((breakdown) => breakdown.steps)
})

export const mergeActualCostBreakdowns = (
  breakdowns: ActualCostBreakdown[]
): ActualCostBreakdown => ({
  totalCost: breakdowns.reduce((sum, breakdown) => sum + breakdown.totalCost, 0),
  steps: breakdowns.flatMap((breakdown) => breakdown.steps)
})

export const mergeTimingBreakdowns = (
  breakdowns: StepTimingBreakdown[]
): StepTimingBreakdown => ({
  totalProcessingTimeMs: breakdowns.reduce((sum, breakdown) => sum + breakdown.totalProcessingTimeMs, 0),
  steps: breakdowns.flatMap((breakdown) => breakdown.steps)
})
