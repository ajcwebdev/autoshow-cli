export type OpenAIImageQuality = 'low' | 'medium' | 'high'

export type OpenAIImageInputEstimate = {
  unitsPerReference: number
  referenceInputs: number
  totalUnits: number
  ratePer1MCents: number | null
  costCents: number | null
  priced: boolean
}
