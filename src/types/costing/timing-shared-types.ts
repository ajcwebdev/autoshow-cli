import type { StepTimingBreakdown, TimingRateBasis, TimingStepEntry, TimingThroughputUnit } from '~/types'

export type NormalizedTimingFields = {
  rateBasis: TimingRateBasis
  msPerUnit: number
  throughputValue: number
  throughputUnit: TimingThroughputUnit
}

export type TimingBasisDefinition = {
  rateBasis: TimingRateBasis
  units: number
  throughputInputValue: number
  throughputUnit: TimingThroughputUnit
  throughputScaleMs: number
}

export type EstimateConfidence = NonNullable<StepTimingBreakdown['estimateConfidence']>

export type TimingStepsResult = {
  steps: TimingStepEntry[]
  confidence?: EstimateConfidence
}
