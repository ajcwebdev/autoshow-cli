import type { CommandPricingOptions, PreflightResult, ProcessCommand } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { createKeyValueTable } from '~/utils/app-logger/human-table/human-table'
import { buildAggregatedPriceEstimate } from './aggregate-pricing'

type PreflightBudgetOptions = {
  price: boolean
  allowOverBudget: boolean
}

export const evaluatePreflightEstimate = (
  estimate: PreflightResult['estimate'],
  opts: PreflightBudgetOptions,
  maxCents: number | undefined
): PreflightResult => {
  l.report.estimate(estimate)

  if (opts.price) {
    return { estimate, shouldExit: true }
  }

  if (maxCents !== undefined && estimate.totalEstimatedCost > maxCents) {
    if (!opts.allowOverBudget) {
      throw CLIUsageError(
        `Estimated cost ${formatCents(estimate.totalEstimatedCost)} exceeds configured budget ${formatCents(maxCents)}. Use --allow-over-budget to proceed.`
      )
    }
    l.write('warn', 'Pricing Budget', {
      category: 'pricing',
      humanTable: createKeyValueTable([
        ['estimatedCost', formatCents(estimate.totalEstimatedCost)],
        ['budget', formatCents(maxCents)],
        ['action', 'continuing because --allow-over-budget is set']
      ]),
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
