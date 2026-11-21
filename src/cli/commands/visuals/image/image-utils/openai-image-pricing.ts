import { getImageModelMeta } from '~/cli/commands/setup-and-utilities/models/model-loader/image'
import { isOpenAIImage26Model } from '~/cli/commands/setup-and-utilities/models/image-models'
import { validateOpenAIFlexibleImageSize } from '../image-generation-services/image-openai/openai-image-options'
import { UsageError } from '~/utils/error-handler'
import type { EstimateImageCostOptions, Step5Metadata } from '~/types'

const IMAGE_QUALITY_GRID = { low: 16, medium: 24, high: 48, xhigh: 64, max: 96 } as const

// OpenAI's image-generation calculator scales GPT Image 2.6 output tokens by quality and rounds to the nearest token.
const IMAGE_26_OUTPUT_TOKEN_MULTIPLIERS = { low: 4.2, medium: 3.3, high: 1, xhigh: 1, max: 1 } as const

type ImageQuality = keyof typeof IMAGE_QUALITY_GRID

export const estimateOpenAIGptImageOutput = (
  model: string,
  options: Pick<EstimateImageCostOptions, 'imageSize' | 'imageQuality'>
): { costPerImageCents: number; outputTokens: number; note: string } => {
  const quality = !options.imageQuality || options.imageQuality.toLowerCase() === 'auto' ? 'medium' : options.imageQuality.toLowerCase()
  const size = !options.imageSize || options.imageSize.toLowerCase() === 'auto' ? '1024x1024' : options.imageSize.toLowerCase()
  if (!Object.hasOwn(IMAGE_QUALITY_GRID, quality)) {
    throw UsageError(`Invalid --quality value "${quality}" for OpenAI/${model}. Expected low, medium, high, xhigh, max, or auto.`)
  }
  validateOpenAIFlexibleImageSize(model, size)
  const [width, height] = size.split('x').map(Number) as [number, number]
  const longGrid = IMAGE_QUALITY_GRID[quality as ImageQuality]
  const scaledShortGrid = longGrid * Math.min(width, height) / Math.max(width, height)
  const floor = Math.floor(scaledShortGrid)
  const shortGrid = scaledShortGrid - floor === 0.5 ? floor + floor % 2 : Math.round(scaledShortGrid)
  const gridTokens = Math.ceil(longGrid * shortGrid * (2_000_000 + width * height) / 4_000_000)
  const is26 = isOpenAIImage26Model(model)
  const multiplier = is26 ? IMAGE_26_OUTPUT_TOKEN_MULTIPLIERS[quality as ImageQuality] : 1
  const outputTokens = is26 ? Math.round(gridTokens * multiplier) : gridTokens
  const rate = getImageModelMeta('openai', model)?.imageOutputCostPer1MCents
  if (rate === undefined) throw UsageError(`Missing image-output token rate for OpenAI/${model}.`)
  const assumed = !options.imageSize || options.imageSize.toLowerCase() === 'auto' || !options.imageQuality || options.imageQuality.toLowerCase() === 'auto'
  const calculator = is26
    ? `GPT Image 2.6 calculator output estimate: ${outputTokens} tokens at ${size} ${quality} (${gridTokens} grid tokens x ${multiplier}).`
    : `GPT Image 2.5 calculator output estimate: ${outputTokens} tokens at ${size} ${quality}.`
  return {
    costPerImageCents: outputTokens / 1_000_000 * rate,
    outputTokens,
    note: `${calculator} ${assumed ? 'Omitted/auto dimensions assume 1024x1024 and omitted/auto quality assumes medium; actual auto consumption varies. ' : ''}This is a planning estimate, not a spending bound. Prompt tokens and cached-input discounts are excluded; reference inputs are modeled separately at 1,000 tokens per reference per output.`
  }
}

type ImageTokenUsage = Pick<Step5Metadata, 'textInputUnits' | 'imageInputUnits' | 'totalInputUnits' | 'outputUnits' | 'imageOutputUnits'>

export const computeOpenAIImageUsageCostCents = (model: string, usage: ImageTokenUsage): number | undefined => {
  const rates = getImageModelMeta('openai', model)
  const { textInputUnits, imageInputUnits, totalInputUnits } = usage
  const imageOutputUnits = usage.imageOutputUnits ?? usage.outputUnits
  if (rates?.textInputCostPer1MCents === undefined || rates.imageInputCostPer1MCents === undefined || rates.imageOutputCostPer1MCents === undefined) return undefined
  if (textInputUnits === undefined || imageInputUnits === undefined || imageOutputUnits === undefined) return undefined
  if (![textInputUnits, imageInputUnits, imageOutputUnits].every(value => Number.isSafeInteger(value) && value >= 0)) return undefined
  if (totalInputUnits !== undefined && totalInputUnits !== textInputUnits + imageInputUnits) return undefined
  return (textInputUnits * rates.textInputCostPer1MCents + imageInputUnits * rates.imageInputCostPer1MCents + imageOutputUnits * rates.imageOutputCostPer1MCents) / 1_000_000
}
