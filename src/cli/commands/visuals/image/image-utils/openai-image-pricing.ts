import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { validateOpenAIFlexibleImageSize } from '../image-generation-services/image-openai/openai-image-options'
import { UsageError } from '~/utils/error-handler'
import type { EstimateImageCostOptions, Step5Metadata } from '~/types'

const IMAGE_25_QUALITY_GRID = { low: 16, medium: 24, high: 48, xhigh: 64, max: 96 } as const

// OpenAI's GPT Image 2.5 calculator, checked 2026-09-10:
// https://developers.openai.com/api/docs/guides/image-generation#cost-and-latency
// Short-axis grid rounding uses ties-to-even, not JavaScript's Math.round.
export const estimateOpenAIImage25Output = (
  model: string,
  options: Pick<EstimateImageCostOptions, 'imageSize' | 'imageQuality'>
): { costPerImageCents: number; outputTokens: number; note: string } => {
  const quality = !options.imageQuality || options.imageQuality.toLowerCase() === 'auto' ? 'medium' : options.imageQuality.toLowerCase()
  const size = !options.imageSize || options.imageSize.toLowerCase() === 'auto' ? '1024x1024' : options.imageSize.toLowerCase()
  if (!Object.hasOwn(IMAGE_25_QUALITY_GRID, quality)) {
    throw UsageError(`Invalid --quality value "${quality}" for OpenAI/${model}. Expected low, medium, high, xhigh, max, or auto.`)
  }
  validateOpenAIFlexibleImageSize(model, size)
  const [width, height] = size.split('x').map(Number) as [number, number]
  const longGrid = IMAGE_25_QUALITY_GRID[quality as keyof typeof IMAGE_25_QUALITY_GRID]
  const scaledShortGrid = longGrid * Math.min(width, height) / Math.max(width, height)
  const floor = Math.floor(scaledShortGrid)
  const shortGrid = scaledShortGrid - floor === 0.5 ? floor + floor % 2 : Math.round(scaledShortGrid)
  const outputTokens = Math.ceil(longGrid * shortGrid * (2_000_000 + width * height) / 4_000_000)
  const rate = getModelRegistry().image['openai']?.models[model]?.imageOutputCostPer1MCents
  if (rate === undefined) throw UsageError(`Missing image-output token rate for OpenAI/${model}.`)
  const assumed = !options.imageSize || options.imageSize.toLowerCase() === 'auto' || !options.imageQuality || options.imageQuality.toLowerCase() === 'auto'
  return {
    costPerImageCents: outputTokens / 1_000_000 * rate,
    outputTokens,
    note: `GPT Image 2.5 calculator output estimate: ${outputTokens} tokens at ${size} ${quality}. ${assumed ? 'Omitted/auto dimensions assume 1024x1024 and omitted/auto quality assumes medium; actual auto consumption varies. ' : ''}This is a planning estimate, not a spending bound. Prompt tokens and cached-input discounts are excluded; reference inputs are modeled separately at 1,000 tokens per reference per output.`
  }
}

type ImageTokenUsage = Pick<Step5Metadata, 'textInputUnits' | 'imageInputUnits' | 'totalInputUnits' | 'outputUnits' | 'imageOutputUnits'>

export const computeOpenAIImageUsageCostCents = (model: string, usage: ImageTokenUsage): number | undefined => {
  const rates = getModelRegistry().image['openai']?.models[model]
  const { textInputUnits, imageInputUnits, totalInputUnits } = usage
  const imageOutputUnits = usage.imageOutputUnits ?? usage.outputUnits
  if (rates?.textInputCostPer1MCents === undefined || rates.imageInputCostPer1MCents === undefined || rates.imageOutputCostPer1MCents === undefined) return undefined
  if (textInputUnits === undefined || imageInputUnits === undefined || imageOutputUnits === undefined) return undefined
  if (![textInputUnits, imageInputUnits, imageOutputUnits].every(value => Number.isSafeInteger(value) && value >= 0)) return undefined
  if (totalInputUnits !== undefined && totalInputUnits !== textInputUnits + imageInputUnits) return undefined
  return (textInputUnits * rates.textInputCostPer1MCents + imageInputUnits * rates.imageInputCostPer1MCents + imageOutputUnits * rates.imageOutputCostPer1MCents) / 1_000_000
}
