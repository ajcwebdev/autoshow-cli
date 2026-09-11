import type { GenerateImagesCommandOptions } from '~/types'
import { estimateLlmCostFromRegistry } from './structured-script-utils/llm-cost'
import { formatCost } from '../comic-image-services/image-costs'
import { priceDetails, priceLine } from './price-estimate-logging'
import { loadQaOnlyPanelInputs, QA_ONLY_ESTIMATED_INPUT_TOKENS_PER_PANEL, QA_ONLY_ESTIMATED_OUTPUT_TOKENS_PER_PANEL } from '../comic-commands/generate-images/qa-only-panel-audit'
import { CONTINUITY_ESTIMATED_INPUT_UNITS_PER_PANEL, CONTINUITY_ESTIMATED_OUTPUT_UNITS_PER_PANEL } from '../comic-commands/generate-images/continuity-qa'
import { loadContinuityAuditContext } from './continuity-audit-report'

export const estimateQaOnlyPanelAuditPrice = async (options: GenerateImagesCommandOptions): Promise<void> => {
  const inputs = await loadQaOnlyPanelInputs(options.sceneSlug, options.panels)
  const judgeModel = options.qaModel!
  const continuityQa = options.continuityQa === true
  const continuityOnly = continuityQa && options.continuityOnly === true
  if (continuityQa) {
    await loadContinuityAuditContext(options.sceneSlug, inputs, { trustedAnchorPanel: options.trustedAnchorPanel, labelsPath: options.labels, judgeModel, composeCards: false })
  }
  const pageJudgeCalls = continuityOnly ? 0 : inputs.length
  const continuityJudgeCalls = continuityQa ? inputs.length : 0
  const inputTokens = pageJudgeCalls * QA_ONLY_ESTIMATED_INPUT_TOKENS_PER_PANEL
  const outputTokens = pageJudgeCalls * QA_ONLY_ESTIMATED_OUTPUT_TOKENS_PER_PANEL
  const continuityInputUnits = continuityJudgeCalls * CONTINUITY_ESTIMATED_INPUT_UNITS_PER_PANEL
  const continuityOutputUnits = continuityJudgeCalls * CONTINUITY_ESTIMATED_OUTPUT_UNITS_PER_PANEL
  const pageCost = estimateLlmCostFromRegistry(judgeModel, inputTokens, outputTokens)
  const continuityCost = estimateLlmCostFromRegistry(judgeModel, continuityInputUnits, continuityOutputUnits)
  const total = pageCost + continuityCost
  priceDetails('Comic - Price Estimate: generate-images (QA-only)', [
    ['Scene', options.sceneSlug],
    ['Canonical panels', inputs.length],
    ['Judge model', judgeModel],
    ['Judge calls', pageJudgeCalls],
    ['Image generation calls', 0],
    ['Image repair calls', 0],
    ['Heuristic judge tokens', `${inputTokens.toLocaleString()} input + ${outputTokens.toLocaleString()} output`],
    ...(continuityQa ? [
      ['Continuity judge calls', continuityJudgeCalls] as const,
      ['Heuristic continuity units', `${continuityInputUnits.toLocaleString()} input + ${continuityOutputUnits.toLocaleString()} output`] as const,
      ['Continuity judge cost', `~${formatCost(continuityCost)}`] as const,
    ] : []),
    ['Estimated total', `~${formatCost(total)}`],
  ], {
    command: 'generate-images', mode: 'qa-only', scene: options.sceneSlug, canonicalPanels: inputs.length, judgeModel, judgeCalls: pageJudgeCalls, imageGenerationCalls: 0, imageRepairCalls: 0, inputTokens, outputTokens, estimatedTotal: total,
    ...(continuityQa ? { continuityQa: true, continuityOnly, continuityJudgeCalls, continuityInputUnits, continuityOutputUnits, continuityCost, pageJudgeCalls } : {}),
  })
  priceLine(`Total: ~${formatCost(total)}`, { knownTotal: total, hasUnknownPricing: false })
  priceLine('QA-only price mode performs no provider calls or writes; the paid run performs judge calls only and cannot generate, repair, or promote images.', { imageGenerationCalls: 0, imageRepairCalls: 0, canonicalImageWrites: 0 })
}
