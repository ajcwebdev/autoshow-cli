import * as l from '~/utils/app-logger/app-logger'
import { logSingleRowTable } from '~/utils/app-logger/human-table/human-table'
import { logSuitePriceSummary } from './suite-price-logging'
import { isExtractCommand } from '~/cli/commands/process-steps/process-command-kinds'
import { buildAggregatedPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import { mapWithConcurrency } from '~/utils/run-with-concurrency'
import type { CommandPricingOptions, PricingRuntimeOptions, ProcessCommand, WriteRuntimeOptions } from '~/types'
import { serializeDiagnosticError } from '~/utils/error-handler'

export const reportSuitePriceEstimate = async (
  command: ProcessCommand,
  targets: string[],
  opts: CommandPricingOptions | WriteRuntimeOptions
): Promise<number> => {
  logSingleRowTable(l, 'Suite Price Estimate', {
    itemType: targets.length === 1 ? 'target' : 'targets',
    itemCount: targets.length
  }, { category: 'pricing', columns: ['itemType', 'itemCount'] })

  let suiteTotalEstimatedCost = 0
  const concurrency = isExtractCommand(command) && 'sttPreflightConcurrency' in opts
    ? opts.sttPreflightConcurrency
    : 1

  let skipped = 0
  await mapWithConcurrency(concurrency, targets, async (item) => {
    try {
      const estimate = await buildAggregatedPriceEstimate(command, item, opts, undefined)
      l.report.estimate(estimate)
      suiteTotalEstimatedCost += estimate.totalEstimatedCost
    } catch (error) {
      skipped++
      const message = error instanceof Error ? error.message : String(error)
      l.warn(`Price estimate failed for ${item}: ${message}`, {
        category: 'pricing',
        metadata: { item, error: serializeDiagnosticError(error) }
      })
    }
  })

  logSuitePriceSummary(l, {
    checkedLabel: targets.length === 1 ? 'command' : 'commands',
    checkedCount: targets.length - skipped,
    totalEstimatedCost: suiteTotalEstimatedCost
  })
  if (skipped > 0) {
    l.warn(`${skipped} item(s) skipped due to price estimation errors`, {
      category: 'pricing',
      metadata: { skippedCount: skipped, checkedCount: targets.length - skipped }
    })
  }

  return suiteTotalEstimatedCost
}

export const formatCents = (amount: number): string => `${amount.toFixed(3)}¢`

export const shouldRunCommandPreflight = (
  opts: Pick<PricingRuntimeOptions, 'price'>,
  maxCents: number | undefined
): boolean => opts.price || maxCents !== undefined
