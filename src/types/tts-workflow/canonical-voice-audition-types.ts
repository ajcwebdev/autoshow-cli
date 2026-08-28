import type { PlannedCost, VoiceAuditionCategory } from '~/types'

export type CanonicalVoiceAuditionPassage = {
  itemId: string
  category: VoiceAuditionCategory
  text: string
  delivery?: string | undefined
}

export type CanonicalVoiceAuditionPlan = {
  passages: CanonicalVoiceAuditionPassage[]
  takeCount: number
  characterCount: number
  estimatedCostCents: number
  plannedCost: PlannedCost
}
