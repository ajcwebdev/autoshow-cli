import type { AggregatedPriceEstimate, ComputeEstimatedCostsInput, EstimatedCostBreakdown, EstimatedStepEntry } from '~/types'
import { computeEstimatedCosts } from './compute-estimated-costs'

export const preflightToEstimated = (estimate: AggregatedPriceEstimate): EstimatedCostBreakdown => {
  const steps: EstimatedStepEntry[] = []

  for (const s of estimate.steps) {
    switch (s.step) {
      case 'stt':
        steps.push({
          step: 'stt',
          provider: s.provider,
          model: s.model,
          cost: s.totalCost,
          ...(typeof s.costMultiplier === 'number' ? { costMultiplier: s.costMultiplier } : {}),
          durationSeconds: s.durationSeconds,
          ...(typeof s.estimateType === 'string' ? { estimateType: s.estimateType } : {})
        })
        break
      case 'extract':
        steps.push({
          step: 'extract',
          provider: s.provider,
          model: s.model,
          cost: s.totalCost,
          ...(typeof s.costMultiplier === 'number' ? { costMultiplier: s.costMultiplier } : {}),
          ...(typeof s.costPer1kPagesCents === 'number' ? { costPer1kPagesCents: s.costPer1kPagesCents } : {}),
          ...(typeof s.costPer1kOutputCharsCents === 'number' ? { costPer1kOutputCharsCents: s.costPer1kOutputCharsCents } : {}),
          ...(typeof s.pageCount === 'number' ? { pageCount: s.pageCount } : {}),
          ...(typeof s.rasterizedPages === 'number' ? { rasterizedPages: s.rasterizedPages } : {}),
          ...(typeof s.singlePagePdfFallbackPages === 'number' ? { singlePagePdfFallbackPages: s.singlePagePdfFallbackPages } : {}),
          ...(typeof s.estimatedOutputChars === 'number' ? { estimatedOutputChars: s.estimatedOutputChars } : {}),
          ...(typeof s.inputCostPer1MCents === 'number' ? { inputCostPer1MCents: s.inputCostPer1MCents } : {}),
          ...(typeof s.outputCostPer1MCents === 'number' ? { outputCostPer1MCents: s.outputCostPer1MCents } : {}),
          ...(typeof s.pricingBand === 'string' ? { pricingBand: s.pricingBand } : {}),
          ...(typeof s.pricingNote === 'string' ? { pricingNote: s.pricingNote } : {}),
          ...(typeof s.promptTokens === 'number' ? { promptTokens: s.promptTokens } : {}),
          ...(typeof s.completionTokens === 'number' ? { completionTokens: s.completionTokens } : {}),
          ...(typeof s.ocrMode === 'string' ? { ocrMode: s.ocrMode } : {}),
          ...(typeof s.tokenEstimateSource === 'string' ? { tokenEstimateSource: s.tokenEstimateSource } : {}),
          ...(typeof s.tokenEstimateConfidence === 'string' ? { tokenEstimateConfidence: s.tokenEstimateConfidence } : {}),
          ...(typeof s.tokenProfileSampleCount === 'number' ? { tokenProfileSampleCount: s.tokenProfileSampleCount } : {}),
          ...(typeof s.tokenProfilePromptTokensPerPage === 'number' ? { tokenProfilePromptTokensPerPage: s.tokenProfilePromptTokensPerPage } : {}),
          ...(typeof s.tokenProfileCompletionTokensPerPage === 'number' ? { tokenProfileCompletionTokensPerPage: s.tokenProfileCompletionTokensPerPage } : {}),
          ...(typeof s.estimateType === 'string' ? { estimateType: s.estimateType } : {})
        })
        break
      case 'llm':
        steps.push({
          step: 'llm',
          provider: s.provider,
          model: s.model,
          cost: s.totalCost,
          ...(typeof s.costMultiplier === 'number' ? { costMultiplier: s.costMultiplier } : {}),
          inputCostPer1MCents: s.inputCostPer1MCents,
          outputCostPer1MCents: s.outputCostPer1MCents,
          ...(typeof s.estimatedInputTokens === 'number' ? { estimatedInputTokens: s.estimatedInputTokens } : {}),
          ...(typeof s.estimatedOutputTokens === 'number' ? { estimatedOutputTokens: s.estimatedOutputTokens } : {}),
          ...(typeof s.pricingBand === 'string' ? { pricingBand: s.pricingBand } : {}),
          ...(typeof s.pricingNote === 'string' ? { pricingNote: s.pricingNote } : {})
        })
        break
      case 'tts':
        steps.push({
          step: 'tts',
          provider: s.provider,
          model: s.model,
          cost: s.totalCost,
          ...(typeof s.costMultiplier === 'number' ? { costMultiplier: s.costMultiplier } : {}),
          ...(s.costPer1kCharactersCents !== undefined ? { costPer1kCharactersCents: s.costPer1kCharactersCents } : {}),
          ...(s.inputCostPer1MCharactersCents !== undefined ? { inputCostPer1MCharactersCents: s.inputCostPer1MCharactersCents } : {}),
          ...(s.outputCostPer1MCharactersCents !== undefined ? { outputCostPer1MCharactersCents: s.outputCostPer1MCharactersCents } : {})
        })
        break
      case 'image':
        steps.push({
          step: 'image',
          provider: s.provider,
          model: s.model,
          cost: s.totalCost,
          ...(typeof s.costMultiplier === 'number' ? { costMultiplier: s.costMultiplier } : {}),
          imageCount: s.imageCount,
        })
        break
      case 'video':
        steps.push({
          step: 'video',
          provider: s.provider,
          model: s.model,
          cost: s.totalCost,
          ...(typeof s.costMultiplier === 'number' ? { costMultiplier: s.costMultiplier } : {}),
          durationSeconds: s.durationSeconds,
        })
        break
      case 'music':
        steps.push({
          step: 'music',
          provider: s.provider,
          model: s.model,
          cost: s.totalCost,
          ...(typeof s.costMultiplier === 'number' ? { costMultiplier: s.costMultiplier } : {}),
          durationSeconds: s.durationSeconds
        })
        break
    }
  }

  return {
    totalCost: estimate.totalEstimatedCost,
    steps
  }
}

export const computePriceAlignedEstimatedCosts = (
  preflightEstimate: AggregatedPriceEstimate | undefined,
  input: ComputeEstimatedCostsInput
): EstimatedCostBreakdown =>
  preflightEstimate ? preflightToEstimated(preflightEstimate) : computeEstimatedCosts(input)

export const computeObservedEstimateCosts = (
  input: ComputeEstimatedCostsInput
): EstimatedCostBreakdown => computeEstimatedCosts({
  ...input,
  applyCostMultipliers: false
})
