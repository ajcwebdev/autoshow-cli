import type { ModelRegistry } from '~/types'

export type HostedModelMetadata = ModelRegistry['llm'][string]['models'][string]
  | ModelRegistry['extract'][string]['models'][string]

export type ResolvedModelLifecycle = {
  status: 'active' | 'deprecated'
  shutdownDate?: string | undefined
  replacementModel?: string | undefined
  defaultEligible: boolean
  allExpansionEligible: boolean
  sourceUrl?: string | undefined
  checkedAt?: string | undefined
  notes?: string | undefined
}
