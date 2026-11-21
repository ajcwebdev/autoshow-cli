import { estimateImageCosts } from '~/cli/commands/visuals/image/image-utils/image-pricing'
import { resolveImageService, SERVICE_TO_IMAGE_MODELS_FIELD } from '../comic-utils/image-service'
import type { ComicImagePurchaseUsage, EstimateImageCostOptions, GeneratedImageUsage, ImageGenerationModel, ImageGenerationQuality, ImageGenerationSize, ImageRunStats } from '~/types'

export const createImageRunStats = (): ImageRunStats => ({
  imagesGenerated: 0,
  imagesSkipped: 0,
  totalInputTokens: 0,
  totalInputTextTokens: 0,
  totalInputImageTokens: 0,
  totalInputUnattributedTokens: 0,
  totalOutputTokens: 0,
  totalOutputTextTokens: 0,
  totalOutputImageTokens: 0,
  totalOutputUnattributedTokens: 0,
  totalCost: 0,
  totalDurationMs: 0,
})

export const formatCost = (dollars: number): string => {
  return dollars < 0.01
    ? `$${dollars.toFixed(4)}`
    : `$${dollars.toFixed(2)}`
}

export const estimateImageOutputCost = (
  model: ImageGenerationModel,
  quality: ImageGenerationQuality,
  size: ImageGenerationSize
): number | null => {
  const service = resolveImageService(model)
  if (!service) {
    return null
  }

  const field = SERVICE_TO_IMAGE_MODELS_FIELD[service]
  if (!field) {
    return null
  }

  // Comic's Gemini adapter maps canvas dimensions to a native 1K aspect ratio.
  const options = { [field]: [model], imageSize: service === 'gemini' ? '1K' : size, imageQuality: quality } as EstimateImageCostOptions
  const estimate = estimateImageCosts(options)[0]
  if (!estimate) {
    return null
  }

  return estimate.costPerImageCents / 100
}

export const updateImageRunStatsWithCostFallback = (
  model: ImageGenerationModel,
  stats: ImageRunStats,
  quality: ImageGenerationQuality,
  size: ImageGenerationSize
): { costLabel: string; estimated: boolean; costUsd: number } => {
  const estimatedCost = estimateImageOutputCost(model, quality, size)
  if (estimatedCost !== null) {
    stats.totalCost += estimatedCost
    return { costLabel: `${formatCost(estimatedCost)} estimated`, estimated: true, costUsd: estimatedCost }
  }

  return { costLabel: 'unavailable', estimated: false, costUsd: 0 }
}

export const recordBaseImageAccounting = (
  stats: ImageRunStats,
  input: {
    model: ImageGenerationModel
    quality: ImageGenerationQuality
    size: ImageGenerationSize
    durationMs: number
    usage?: GeneratedImageUsage | undefined
  }
): { costLabel: string; purchase: ComicImagePurchaseUsage } => {
  const { costLabel, costUsd } = updateImageRunStatsWithCostFallback(input.model, stats, input.quality, input.size)
  const purchase = {
    costUsd,
    durationMs: input.durationMs,
    imageInputUnits: input.usage?.imageInputUnits ?? 0,
    textInputUnits: input.usage?.textInputUnits ?? 0,
    imageOutputUnits: input.usage?.outputUnits ?? 0,
  }
  stats.imagesGenerated += 1
  stats.totalDurationMs += input.durationMs
  stats.totalInputImageTokens += purchase.imageInputUnits
  stats.totalInputTextTokens += purchase.textInputUnits
  stats.totalOutputImageTokens += purchase.imageOutputUnits
  return { costLabel, purchase }
}
