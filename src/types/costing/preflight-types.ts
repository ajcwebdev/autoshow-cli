import type { AggregatedPriceEstimate } from '~/types'

export type PreflightResult = {
  estimate: AggregatedPriceEstimate
  shouldExit: boolean
}
