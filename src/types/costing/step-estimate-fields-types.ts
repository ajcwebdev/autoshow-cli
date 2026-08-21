import type { EstimatedStepEntry, StepEstimate } from '~/types'

type StepKind = StepEstimate['step']
type StepEstimateFor<TStep extends StepKind> = Extract<StepEstimate, { step: TStep }>
type EstimatedBaseField = 'step' | 'provider' | 'model' | 'cost'
export type EstimatedCopiedFields = Omit<EstimatedStepEntry, EstimatedBaseField>
type EstimatedCopiedField = keyof EstimatedCopiedFields

export type StepFieldRegistry = {
  [TStep in StepKind]: readonly Extract<keyof StepEstimateFor<TStep>, EstimatedCopiedField>[]
}

export type ReportValue = string | number
type ReportableKey<T> = {
  [TKey in keyof T]-?: Exclude<T[TKey], undefined> extends ReportValue ? TKey : never
}[keyof T] & string
type ReportField<T> = ReportableKey<T> | readonly [ReportableKey<T>, string]
export type ReportFieldRegistry = {
  [TStep in StepKind]: readonly ReportField<StepEstimateFor<TStep>>[]
}
export type AnyReportField = string | readonly [string, string]

export type ReportStepIdentity = Pick<StepEstimate, 'provider' | 'model'>
