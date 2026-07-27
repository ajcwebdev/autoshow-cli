import type { ComputeEstimatedCostsInput, OcrModelOverrideOptions } from '~/types'

export type ExtractEstimateTarget = NonNullable<ComputeEstimatedCostsInput['extractTargets']>[number]


export type OcrModelFallbackOptions = OcrModelOverrideOptions & Pick<ComputeEstimatedCostsInput, 'hostedOcrTokenProfilePath'>

export type CollectEstimatedExtractTargetsOptions = OcrModelFallbackOptions & {
  useObservedUsage?: boolean | undefined
}

export type ExtractEstimateProvider = ExtractEstimateTarget['provider']
