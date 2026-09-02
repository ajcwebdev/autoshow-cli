export type OpenAIImageQuality = 'low' | 'medium' | 'high'

export type OpenAIImageOutputPricing = {
  defaultCostCents: number
  commonSizeCosts: Record<string, Record<OpenAIImageQuality, number>>
  label: string
  supportsFlexibleSizes?: boolean
}

export type OpenAIImageInputEstimate = {
  unitsPerReference: number
  referenceInputs: number
  totalUnits: number
  ratePer1MCents: number | null
  costCents: number | null
  priced: boolean
}
