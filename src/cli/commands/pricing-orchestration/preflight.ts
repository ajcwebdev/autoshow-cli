import type { CommandPricingOptions, PreflightBudgetOptions, PreflightResult, ProcessCommand } from '~/types'
import { UsageError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { buildAggregatedPriceEstimate } from './aggregate-pricing'

export const evaluatePreflightEstimate = (
  estimate: PreflightResult['estimate'],
  opts: PreflightBudgetOptions,
  maxCents: number | undefined
): PreflightResult => {
  if (opts.price) {
    l.report.price(estimate)
    return { estimate, shouldExit: true }
  }

  l.report.estimate(estimate)

  if (maxCents !== undefined && estimate.totalEstimatedCost > maxCents) {
    if (!opts.allowOverBudget) {
      throw UsageError(
        `Estimated cost ${formatCents(estimate.totalEstimatedCost)} exceeds configured budget ${formatCents(maxCents)}. Use --allow-over-budget to proceed.`
      )
    }
    l.write('warn', `Estimated cost ${formatCents(estimate.totalEstimatedCost)} exceeds budget ${formatCents(maxCents)}; continuing by request`, {
      category: 'pricing',
      metadata: {
        estimatedCostCents: estimate.totalEstimatedCost,
        budgetCents: maxCents,
        allowOverBudget: true
      }
    })
  }

  return { estimate, shouldExit: false }
}

export const runPreflight = async (
  command: ProcessCommand,
  resolvedTarget: string,
  opts: CommandPricingOptions,
  maxCents: number | undefined,
  characterCount?: number,
  context: { ttsInputText?: string | undefined } = {}
): Promise<PreflightResult> => {
  const estimate = await buildAggregatedPriceEstimate(command, resolvedTarget, opts, characterCount, context)
  return evaluatePreflightEstimate(estimate, opts, maxCents)
}

const formatCents = (amount: number): string => `${amount.toFixed(3)}¢`
