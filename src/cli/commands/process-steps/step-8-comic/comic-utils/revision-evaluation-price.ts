import type { GenerateImagesCommandOptions } from '~/types'
import { estimateImageOutputCost, formatCost } from '../comic-image-services/image-costs'
import { loadRevisionPriceInventory, REVISION_COMPARISON_MODEL, REVISION_ESTIMATED_INPUT_TOKENS_PER_COMPARISON, REVISION_ESTIMATED_OUTPUT_TOKENS_PER_COMPARISON, REVISION_IMAGE_MODEL } from '../comic-commands/generate-images/revision-evaluation'
import { estimateLlmCostFromRegistry } from './structured-script-utils/llm-cost'
import { priceDetails, priceLine } from './price-estimate-logging'

export const estimateRevisionEvaluationPrice = async (options: GenerateImagesCommandOptions): Promise<void> => {
  const inventory = await loadRevisionPriceInventory(options)
  const imagePrice = estimateImageOutputCost(REVISION_IMAGE_MODEL, options.quality ?? 'high', options.size ?? '1536x1024')
  if (imagePrice === null) throw new Error(`No image price is registered for ${REVISION_IMAGE_MODEL}.`)
  const comparisonInputTokens = inventory.comparisonCalls * REVISION_ESTIMATED_INPUT_TOKENS_PER_COMPARISON
  const comparisonOutputTokens = inventory.comparisonCalls * REVISION_ESTIMATED_OUTPUT_TOKENS_PER_COMPARISON
  const comparisonCost = estimateLlmCostFromRegistry(REVISION_COMPARISON_MODEL, comparisonInputTokens, comparisonOutputTokens)
  const imageCost = inventory.imageCalls * imagePrice
  const total = imageCost + comparisonCost
  priceDetails('Comic - Price Estimate: generate-images (revision evaluation)', [
    ['Scene', options.sceneSlug],
    ['Plan fingerprint', inventory.loaded.plan.planFingerprint],
    ['Panels in frozen plan', inventory.loaded.entries.length],
    ['Image model', REVISION_IMAGE_MODEL],
    ['Image calls', inventory.imageCalls],
    ['Comparison model', REVISION_COMPARISON_MODEL],
    ['Comparison calls', inventory.comparisonCalls],
    ['Reused/terminal image slots', inventory.terminalImageSlots],
    ['Reused comparison slots', inventory.reusedComparisonSlots],
    ['Image subtotal', formatCost(imageCost)],
    ['Heuristic comparison tokens', `${comparisonInputTokens.toLocaleString()} input + ${comparisonOutputTokens.toLocaleString()} output`],
    ['Comparison subtotal', formatCost(comparisonCost)],
    ['Estimated total', formatCost(total)],
  ], { command: 'generate-images', mode: 'revision-evaluation', scene: options.sceneSlug, planFingerprint: inventory.loaded.plan.planFingerprint, panels: inventory.loaded.entries.length, imageModel: REVISION_IMAGE_MODEL, imageCalls: inventory.imageCalls, imageCost, comparisonModel: REVISION_COMPARISON_MODEL, comparisonCalls: inventory.comparisonCalls, comparisonInputTokens, comparisonOutputTokens, comparisonCost, estimatedTotal: total, priceModeWrites: 0 })
  priceLine(`Total: ~${formatCost(total)}`, { knownTotal: total, hasUnknownPricing: false })
  priceLine('Revision price mode validates the frozen plan, hashes, contracts, canonical references, and resumable slot state without provider calls or writes.', { providerCalls: 0, writes: 0 })
}
