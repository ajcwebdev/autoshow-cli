import type { EstimatedStepEntry, StepEstimate } from '~/types'

export type StepKind = StepEstimate['step']
export type StepEstimateFor<TStep extends StepKind> = Extract<StepEstimate, { step: TStep }>
export type EstimatedBaseField = 'step' | 'provider' | 'model' | 'cost'
export type EstimatedCopiedFields = Omit<EstimatedStepEntry, EstimatedBaseField>
export type EstimatedCopiedField = keyof EstimatedCopiedFields

export type StepFieldRegistry = {
  [TStep in StepKind]: readonly Extract<keyof StepEstimateFor<TStep>, EstimatedCopiedField>[]
}

export type ReportValue = string | number
export type ReportableKey<T> = {
  [TKey in keyof T]-?: Exclude<T[TKey], undefined> extends ReportValue ? TKey : never
}[keyof T] & string
export type ReportField<T> = ReportableKey<T> | readonly [ReportableKey<T>, string]
export type ReportFieldRegistry = {
  [TStep in StepKind]: readonly ReportField<StepEstimateFor<TStep>>[]
}
export type AnyReportField = string | readonly [string, string]

export type ReportStepIdentity = Pick<StepEstimate, 'provider' | 'model'>
