import type { HostedModelMetadata, ResolvedModelLifecycle } from '~/types'

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
