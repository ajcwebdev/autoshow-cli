import type { AggregatedPriceEstimate } from '~/types'

export type PreflightResult = {
  estimate: AggregatedPriceEstimate
  shouldExit: boolean
}

export type PreflightBudgetOptions = {
  price: boolean
  allowOverBudget: boolean
}
