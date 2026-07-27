export type OpenAIImageQuality = 'low' | 'medium' | 'high'

export type OpenAIImageOutputPricing = {
  defaultCostCents: number
  commonSizeCosts: Record<string, Record<OpenAIImageQuality, number>>
  label: string
  supportsFlexibleSizes?: boolean
}
