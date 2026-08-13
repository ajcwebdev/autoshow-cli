import type { ModelRegistry } from '~/types'

type HostedModelMetadata = ModelRegistry['llm'][string]['models'][string]
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

export const resolveModelLifecycle = (
  metadata: HostedModelMetadata | undefined
): ResolvedModelLifecycle => {
  const lifecycle = metadata?.lifecycle
  return {
    status: lifecycle?.status ?? 'active',
    ...(lifecycle?.shutdownDate !== undefined ? { shutdownDate: lifecycle.shutdownDate } : {}),
    ...(lifecycle?.replacementModel !== undefined ? { replacementModel: lifecycle.replacementModel } : {}),
    defaultEligible: lifecycle?.defaultEligible ?? true,
    allExpansionEligible: lifecycle?.allExpansionEligible ?? true,
    ...(lifecycle?.sourceUrl !== undefined ? { sourceUrl: lifecycle.sourceUrl } : {}),
    ...(lifecycle?.checkedAt !== undefined ? { checkedAt: lifecycle.checkedAt } : {}),
    ...(lifecycle?.notes !== undefined ? { notes: lifecycle.notes } : {})
  }
}

export const filterModelNamesByLifecycle = (
  modelNames: readonly string[],
  models: Record<string, HostedModelMetadata> | undefined,
  eligibility: 'defaultEligible' | 'allExpansionEligible'
): string[] =>
  modelNames.filter((model) => resolveModelLifecycle(models?.[model])[eligibility])
