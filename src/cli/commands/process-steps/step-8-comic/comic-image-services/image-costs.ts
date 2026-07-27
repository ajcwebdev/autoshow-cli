import { estimateImageCosts } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { resolveImageService, SERVICE_TO_IMAGE_MODELS_FIELD } from '../comic-utils/image-service'
import type { EstimateImageCostOptions, ImageGenerationModel, ImageGenerationQuality, ImageGenerationSize, ImageRunStats } from '~/types'

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

// Per-image output cost (USD) sourced from the central image registry, mirroring
// the LLM cost path. The shared estimator is size/quality-aware for OpenAI and
// falls back to the registry's documented per-image rate for other providers.
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

  const options = { [field]: [model], imageSize: size, imageQuality: quality } as EstimateImageCostOptions
  const estimate = estimateImageCosts(options)[0]
  if (!estimate) {
    return null
  }

  return estimate.costPerImageCents / 100
}

// Central image runs do not surface per-request token usage, so comic charges the
// registry's per-image estimate. The stats object keeps its token fields for the
// shared run-summary shape; they stay zero for image generation.
export const updateImageRunStatsWithCostFallback = (
  model: ImageGenerationModel,
  stats: ImageRunStats,
  quality: ImageGenerationQuality,
  size: ImageGenerationSize
): { costLabel: string; estimated: boolean } => {
  const estimatedCost = estimateImageOutputCost(model, quality, size)
  if (estimatedCost !== null) {
    stats.totalCost += estimatedCost
    return { costLabel: `${formatCost(estimatedCost)} estimated`, estimated: true }
  }

  return { costLabel: 'unavailable', estimated: false }
}
