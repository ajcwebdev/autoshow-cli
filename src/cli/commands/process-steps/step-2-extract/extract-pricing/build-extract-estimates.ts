import type { ExtractStepEstimate, HostedOcrEstimateHandler, HostedOcrPricingService, LocalOcrService, MappedReasoningPolicy, NormalizedReasoningEffort, OcrCostEstimate, OcrProviderMode, ResolvedStep2Execution } from '~/types'
import { GEMINI_OCR_PRICE_NOTE, GLM_OCR_PRICE_NOTE, estimateAnthropicOcrCost, estimateDeepinfraOcrCost, estimateGeminiOcrCost, estimateGlmOcrCost, estimateGrokOcrCost, estimateKimiOcrCost, estimateMistralOcrCost, estimateOpenAIOcrCost, resolveExtractInputPageCountForPricing } from '~/cli/commands/process-steps/step-2-extract/extract-pricing/ocr-estimates'
import { getExtractEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import { applyCostMultiplier } from '~/cli/commands/pricing-orchestration/cost-helpers'
const LOCAL_OCR_NOTES = {
  tesseract: 'Local Tesseract OCR runs on local CPU and is not billed by AutoShow.'
} as const satisfies Record<LocalOcrService, string>

const HOSTED_OCR_HANDLERS = {
  mistral: {
    estimate: estimateMistralOcrCost,
    estimateType: 'exact'
  },
  glm: {
    estimate: estimateGlmOcrCost,
    note: GLM_OCR_PRICE_NOTE
  },
  kimi: {
    estimate: estimateKimiOcrCost,
    note: (estimate) => estimate.note
  },
  openai: {
    estimate: estimateOpenAIOcrCost,
    note: (estimate) => estimate.note
  },
  anthropic: {
    estimate: estimateAnthropicOcrCost,
    note: (estimate) => estimate.note
  },
  gemini: {
    estimate: estimateGeminiOcrCost,
    note: GEMINI_OCR_PRICE_NOTE
  },
  deepinfra: {
    estimate: estimateDeepinfraOcrCost,
    note: (estimate) => estimate.note
  },
  grok: {
    estimate: estimateGrokOcrCost,
    note: (estimate) => estimate.note
  }
} as const satisfies Record<HostedOcrPricingService, HostedOcrEstimateHandler>

const isLocalOcrService = (service: string): service is LocalOcrService =>
  service in LOCAL_OCR_NOTES

const isHostedOcrService = (service: string): service is HostedOcrPricingService =>
  service in HOSTED_OCR_HANDLERS

const allocatePooledPages = (
  pageCount: number,
  providers: Array<{ service: string, model: string }>
): number[] => {
  if (providers.length === 0) return []
  const laneCounts = new Map<string, number>()
  for (const provider of providers) {
    laneCounts.set(provider.service, (laneCounts.get(provider.service) ?? 0) + 1)
  }
  const weights = providers.map((provider) => 1 / (laneCounts.get(provider.service) ?? 1))
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  const exact = weights.map((weight) => pageCount * weight / totalWeight)
  const allocated = exact.map(Math.floor)
  const remaining = pageCount - allocated.reduce((sum, value) => sum + value, 0)
  const remainderOrder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
  for (let index = 0; index < remaining; index++) {
    const target = remainderOrder[index % remainderOrder.length]
    if (target) allocated[target.index] = (allocated[target.index] ?? 0) + 1
  }
  return allocated
}

export const allocatePooledOcrPages = allocatePooledPages

const scaleEstimateForPooledAllocation = (
  estimate: ExtractStepEstimate,
  allocatedPages: number,
  totalPages: number
): ExtractStepEstimate => {
  const originalPages = estimate.pageCount ?? totalPages
  const ratio = originalPages > 0 ? allocatedPages / originalPages : 0
  const allocationNote = `Pooled OCR target allocation is heuristic: approximately ${allocatedPages} of ${totalPages} unfinished page${totalPages === 1 ? '' : 's'} assigned to this target; actual queue share depends on observed worker throughput and failures.`
  return {
    ...estimate,
    pageCount: allocatedPages,
    ...(typeof estimate.promptTokens === 'number' ? { promptTokens: Math.round(estimate.promptTokens * ratio) } : {}),
    ...(typeof estimate.completionTokens === 'number' ? { completionTokens: Math.round(estimate.completionTokens * ratio) } : {}),
    totalCost: estimate.totalCost * ratio,
    estimateType: 'heuristic',
    ocrProviderMode: 'pool',
    allocationHeuristic: true,
    pageShare: totalPages > 0 ? allocatedPages / totalPages : 0,
    ocrMode: estimate.ocrMode?.startsWith('pool') ? estimate.ocrMode : estimate.ocrMode ? `pool:${estimate.ocrMode}` : 'pool',
    note: estimate.note ? `${allocationNote} ${estimate.note}` : allocationNote
  }
}

const buildLocalExtractEstimate = async (
  provider: LocalOcrService,
  model: string,
  input: string,
  reasoningPolicy: MappedReasoningPolicy
): Promise<ExtractStepEstimate> => ({
  step: 'extract',
  provider,
  model,
  ...(reasoningPolicy.requested !== undefined ? { requestedReasoningEffort: reasoningPolicy.requested } : {}),
  effectiveReasoningEffort: reasoningPolicy.effective,
  totalCost: 0,
  costMultiplier: 1,
  pageCount: await resolveExtractInputPageCountForPricing(input),
  estimateType: 'exact',
  note: LOCAL_OCR_NOTES[provider]
})

const resolveHostedNote = (
  handler: HostedOcrEstimateHandler,
  estimate: OcrCostEstimate
): string | undefined => {
  if (typeof handler.note === 'function') {
    return handler.note(estimate)
  }
  return handler.note ?? estimate.note
}

const buildHostedExtractEstimate = (
  estimate: OcrCostEstimate,
  handler: HostedOcrEstimateHandler,
  reasoningPolicy: MappedReasoningPolicy
): ExtractStepEstimate => {
  const estimation = getExtractEstimation(estimate.provider, estimate.model)
  const note = resolveHostedNote(handler, estimate)
  const estimateType = handler.estimateType ?? estimate.estimateType

  return {
    step: 'extract',
    provider: estimate.provider,
    model: estimate.model,
    ...(reasoningPolicy.requested !== undefined ? { requestedReasoningEffort: reasoningPolicy.requested } : {}),
    effectiveReasoningEffort: reasoningPolicy.effective,
    ...(typeof estimate.costPer1kPagesCents === 'number' ? { costPer1kPagesCents: estimate.costPer1kPagesCents } : {}),
    ...(typeof estimate.inputCostPer1MCents === 'number' ? { inputCostPer1MCents: estimate.inputCostPer1MCents } : {}),
    ...(typeof estimate.outputCostPer1MCents === 'number' ? { outputCostPer1MCents: estimate.outputCostPer1MCents } : {}),
    ...(typeof estimate.pricingBand === 'string' ? { pricingBand: estimate.pricingBand } : {}),
    ...(typeof estimate.pricingNote === 'string' ? { pricingNote: estimate.pricingNote } : {}),
    ...(typeof estimate.pageCount === 'number' ? { pageCount: estimate.pageCount } : {}),
    ...(typeof estimate.promptTokens === 'number' ? { promptTokens: estimate.promptTokens } : {}),
    ...(typeof estimate.completionTokens === 'number' ? { completionTokens: estimate.completionTokens } : {}),
    ...(typeof estimate.ocrMode === 'string' ? { ocrMode: estimate.ocrMode } : {}),
    ...(typeof estimate.tokenEstimateSource === 'string' ? { tokenEstimateSource: estimate.tokenEstimateSource } : {}),
    ...(typeof estimate.tokenEstimateConfidence === 'string' ? { tokenEstimateConfidence: estimate.tokenEstimateConfidence } : {}),
    ...(typeof estimate.tokenProfileSampleCount === 'number' ? { tokenProfileSampleCount: estimate.tokenProfileSampleCount } : {}),
    ...(typeof estimate.tokenProfilePromptTokensPerPage === 'number' ? { tokenProfilePromptTokensPerPage: estimate.tokenProfilePromptTokensPerPage } : {}),
    ...(typeof estimate.tokenProfileCompletionTokensPerPage === 'number' ? { tokenProfileCompletionTokensPerPage: estimate.tokenProfileCompletionTokensPerPage } : {}),
    ...(typeof estimate.tokenProfileEffectiveReasoningEffort === 'string' ? { tokenProfileEffectiveReasoningEffort: estimate.tokenProfileEffectiveReasoningEffort } : {}),
    totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
    costMultiplier: estimation.costMultiplier,
    ...(estimateType ? { estimateType } : {}),
    ...(note ? { note } : {})
  }
}

export const buildExtractEstimates = async (
  resolvedTarget: string,
  resolvedStep2: Extract<ResolvedStep2Execution, { route: 'ocr' }>,
  opts: {
    hostedOcrTokenProfilePath?: string | undefined
    reasoningEffort?: NormalizedReasoningEffort | undefined
    ocrProviderMode?: OcrProviderMode | undefined
    poolPageCount?: number | undefined
  }
): Promise<ExtractStepEstimate[]> => {
  const estimates: ExtractStepEstimate[] = []
  const plannedProviders = resolvedStep2.providers.map((provider) => ({
    provider,
    reasoningPolicy: resolveReasoningPolicy({
      step: 'extract',
      service: provider.service,
      model: provider.model,
      requestedReasoningEffort: isLocalOcrService(provider.service)
        ? undefined
        : opts.reasoningEffort
    })
  }))

  for (const { provider, reasoningPolicy } of plannedProviders) {
    if (isLocalOcrService(provider.service)) {
      estimates.push(await buildLocalExtractEstimate(provider.service, provider.model, resolvedTarget, reasoningPolicy))
      continue
    }

    if (isHostedOcrService(provider.service)) {
      const handler = HOSTED_OCR_HANDLERS[provider.service]
      const estimate = await handler.estimate(provider.model, resolvedTarget, {
        hostedOcrTokenProfilePath: opts.hostedOcrTokenProfilePath,
        effectiveReasoningEffort: reasoningPolicy.effective,
        ...(opts.ocrProviderMode === 'pool'
          ? { ocrMode: /\.pdf(?:$|[?#])/i.test(resolvedTarget) ? 'pool:pdf' : 'pool:image' }
          : {})
      })
      estimates.push(buildHostedExtractEstimate(estimate, handler, reasoningPolicy))
      continue
    }
  }

  if (opts.ocrProviderMode !== 'pool') return estimates
  const totalPages = typeof opts.poolPageCount === 'number'
    ? Math.max(0, Math.floor(opts.poolPageCount))
    : await resolveExtractInputPageCountForPricing(resolvedTarget)
  const allocations = allocatePooledPages(totalPages, plannedProviders.map(({ provider }) => provider))
  return estimates.map((estimate, index) =>
    scaleEstimateForPooledAllocation(estimate, allocations[index] ?? 0, totalPages)
  )
}
