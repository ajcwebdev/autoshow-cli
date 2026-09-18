import type { OcrPoolAttemptUsage } from '~/types'

type UsageLike = {
  requestedReasoningEffort?: unknown
  effectiveReasoningEffort?: unknown
  promptTokens?: unknown
  completionTokens?: unknown
  providerCostCents?: unknown
  providerCostSource?: unknown
  providerUsage?: unknown
}

export const projectOcrAttemptUsage = (usage: UsageLike): OcrPoolAttemptUsage => ({
  ...(typeof usage.requestedReasoningEffort === 'string' ? { requestedReasoningEffort: usage.requestedReasoningEffort } : {}),
  ...(typeof usage.effectiveReasoningEffort === 'string' ? { effectiveReasoningEffort: usage.effectiveReasoningEffort } : {}),
  ...(typeof usage.promptTokens === 'number' ? { promptTokens: usage.promptTokens } : {}),
  ...(typeof usage.completionTokens === 'number' ? { completionTokens: usage.completionTokens } : {}),
  ...(typeof usage.providerCostCents === 'number' ? { providerCostCents: usage.providerCostCents } : {}),
  ...(typeof usage.providerCostSource === 'string' ? { providerCostSource: usage.providerCostSource } : {}),
  ...(usage.providerUsage ? { providerUsage: usage.providerUsage as OcrPoolAttemptUsage['providerUsage'] } : {})
})
