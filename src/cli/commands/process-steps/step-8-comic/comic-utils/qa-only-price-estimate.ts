import type { GenerateImagesCommandOptions } from '~/types'
import { estimateLlmCostFromRegistry } from './structured-script-utils/llm-cost'
import { formatCost } from '../comic-image-services/image-costs'
import { priceDetails, priceLine } from './price-estimate-logging'
import { loadQaOnlyPanelInputs, QA_ONLY_ESTIMATED_INPUT_TOKENS_PER_PANEL, QA_ONLY_ESTIMATED_OUTPUT_TOKENS_PER_PANEL } from '../comic-commands/generate-images/qa-only-panel-audit'

export const estimateQaOnlyPanelAuditPrice = async (options: GenerateImagesCommandOptions): Promise<void> => {
  const inputs = await loadQaOnlyPanelInputs(options.sceneSlug, options.panels)
  const judgeModel = options.qaModel!
  const inputTokens = inputs.length * QA_ONLY_ESTIMATED_INPUT_TOKENS_PER_PANEL
  const outputTokens = inputs.length * QA_ONLY_ESTIMATED_OUTPUT_TOKENS_PER_PANEL
  const total = estimateLlmCostFromRegistry(judgeModel, inputTokens, outputTokens)
  priceDetails('Comic - Price Estimate: generate-images (QA-only)', [
    ['Scene', options.sceneSlug],
    ['Canonical panels', inputs.length],
    ['Judge model', judgeModel],
    ['Judge calls', inputs.length],
    ['Image generation calls', 0],
    ['Image repair calls', 0],
    ['Heuristic judge tokens', `${inputTokens.toLocaleString()} input + ${outputTokens.toLocaleString()} output`],
    ['Estimated total', `~${formatCost(total)}`],
  ], { command: 'generate-images', mode: 'qa-only', scene: options.sceneSlug, canonicalPanels: inputs.length, judgeModel, judgeCalls: inputs.length, imageGenerationCalls: 0, imageRepairCalls: 0, inputTokens, outputTokens, estimatedTotal: total })
  priceLine(`Total: ~${formatCost(total)}`, { knownTotal: total, hasUnknownPricing: false })
  priceLine('QA-only price mode performs no provider calls or writes; the paid run performs judge calls only and cannot generate, repair, or promote images.', { imageGenerationCalls: 0, imageRepairCalls: 0, canonicalImageWrites: 0 })
}
