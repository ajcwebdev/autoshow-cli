import type { ExtractStepEstimate, HostedOcrEstimateHandler, HostedOcrPricingService, LocalExtractOcrEngine, OcrCostEstimate, ResolvedStep2Execution, RuntimeOptions } from '~/types'
import { GEMINI_OCR_PRICE_NOTE, GLM_OCR_PRICE_NOTE, estimateAnthropicOcrCost, estimateDeepinfraOcrCost, estimateGeminiOcrCost, estimateGlmOcrCost, estimateGrokOcrCost, estimateKimiOcrCost, estimateMistralOcrCost, estimateOpenAIOcrCost, resolveExtractInputPageCountForPricing } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/extract-pricing'
import { getExtractEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { applyCostMultiplier } from '~/utils/pricing/cost-helpers'
const LOCAL_OCR_NOTES = {
  tesseract: 'Local Tesseract OCR runs on local CPU and is not billed by AutoShow.'
} as const satisfies Record<LocalExtractOcrEngine, string>

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

const isLocalOcrService = (service: string): service is LocalExtractOcrEngine =>
  service in LOCAL_OCR_NOTES

const isHostedOcrService = (service: string): service is HostedOcrPricingService =>
  service in HOSTED_OCR_HANDLERS

const buildLocalExtractEstimate = async (
  provider: LocalExtractOcrEngine,
  model: string,
  input: string
): Promise<ExtractStepEstimate> => ({
  step: 'extract',
  provider,
  model,
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
  handler: HostedOcrEstimateHandler
): ExtractStepEstimate => {
  const estimation = getExtractEstimation(estimate.provider, estimate.model)
  const note = resolveHostedNote(handler, estimate)
  const estimateType = handler.estimateType ?? estimate.estimateType

  return {
    step: 'extract',
    provider: estimate.provider,
    model: estimate.model,
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
    totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
    costMultiplier: estimation.costMultiplier,
    ...(estimateType ? { estimateType } : {}),
    ...(note ? { note } : {})
  }
}

export const buildExtractEstimates = async (
  resolvedTarget: string,
  resolvedStep2: Extract<ResolvedStep2Execution, { route: 'ocr' }>,
  opts: RuntimeOptions & { hostedOcrTokenProfilePath?: string | undefined }
): Promise<ExtractStepEstimate[]> => {
  const estimates: ExtractStepEstimate[] = []

  for (const provider of resolvedStep2.providers) {
    if (isLocalOcrService(provider.service)) {
      estimates.push(await buildLocalExtractEstimate(provider.service, provider.model, resolvedTarget))
      continue
    }

    if (isHostedOcrService(provider.service)) {
      const handler = HOSTED_OCR_HANDLERS[provider.service]
      const estimate = await handler.estimate(provider.model, resolvedTarget, {
        hostedOcrTokenProfilePath: opts.hostedOcrTokenProfilePath
      })
      estimates.push(buildHostedExtractEstimate(estimate, handler))
      continue
    }
  }

  return estimates
}
