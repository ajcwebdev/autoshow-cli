import type { HostedOcrRun } from '~/types'
import { getExtractPricing } from '~/cli/commands/setup-and-utilities/models/model-loader/extract'
import { computeOcrTokenCost } from '~/utils/pricing/ocr-token-pricing'
import { isAppError } from '~/utils/error-handler'

type ResponseUsage = {
  input_tokens?: number | undefined
  output_tokens?: number | undefined
} & Record<string, unknown>

const tokenCount = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined

// Each admitted HTTP response is priced before its token counts are summed:
// prompt-length thresholds apply to individual requests, never the retry total.
export const createOcrAdmittedUsage = (provider: 'anthropic' | 'openai', model: string) => {
  const pricing = getExtractPricing(provider, model)
  const providerUsage: NonNullable<HostedOcrRun['providerUsage']> = []
  let promptTokens: number | undefined
  let completionTokens: number | undefined
  let providerCostCents = 0
  let completePricing = true

  const record = (usage: ResponseUsage | undefined): void => {
    const prompt = tokenCount(usage?.input_tokens)
    const completion = tokenCount(usage?.output_tokens)
    if (prompt !== undefined) promptTokens = (promptTokens ?? 0) + prompt
    if (completion !== undefined) completionTokens = (completionTokens ?? 0) + completion
    const cost = prompt !== undefined && completion !== undefined
      && typeof pricing.inputCostPer1MCents === 'number'
      && typeof pricing.outputCostPer1MCents === 'number'
      ? computeOcrTokenCost(pricing, 0, 0, prompt, completion)
      : undefined
    if (cost) providerCostCents += cost.totalCost
    else completePricing = false
    providerUsage.push({
      provider, model, attempt: providerUsage.length + 1,
      usageRole: 'success', purpose: 'ocr-page',
      ...(prompt !== undefined ? { promptTokens: prompt } : {}),
      ...(completion !== undefined ? { completionTokens: completion } : {}),
      ...(cost ? { providerCostCents: cost.totalCost, providerCostSource: 'registry_fallback', ...(cost.pricingBand ? { pricingBand: cost.pricingBand } : {}) } : {}),
      ...(usage !== undefined ? { usageMetadata: usage } : {})
    })
  }

  const markSchemaFailure = (error: unknown): void => {
    const last = providerUsage.at(-1)
    if (last) Object.assign(last, {
      usageRole: 'schema-retry', purpose: 'ocr-schema-retry',
      failureReason: error instanceof Error ? error.message : String(error)
    })
  }

  const result = (): Pick<HostedOcrRun, 'promptTokens' | 'completionTokens' | 'providerCostCents' | 'providerCostSource' | 'providerUsage'> => ({
    ...(promptTokens !== undefined ? { promptTokens } : {}),
    ...(completionTokens !== undefined ? { completionTokens } : {}),
    // Keep the known request-specific subtotal even when another receipt is
    // incomplete. Repricing aggregate partial tokens can select the wrong band.
    ...(providerUsage.length > 0 ? {
      providerCostCents,
      providerCostSource: completePricing ? 'registry_fallback' : 'partial_provider_usage'
    } : {}),
    ...(providerUsage.length > 0 ? { providerUsage } : {})
  })

  const attachError = (error: unknown): void => {
    if (isAppError(error) && providerUsage.length > 0) {
      const last = providerUsage.at(-1)
      if (last?.['usageRole'] === 'success') {
        Object.assign(last, { usageRole: 'failed', purpose: 'ocr-failed-response' })
      }
      Object.assign(error.metadata, result(), {
        rawProviderUsage: providerUsage.at(-1)?.['usageMetadata'],
        admittedResponseUsage: providerUsage.map(entry => entry['usageMetadata'])
      })
    }
  }

  return { record, markSchemaFailure, result, attachError }
}

