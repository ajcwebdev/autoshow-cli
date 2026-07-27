import { DEFAULT_COST_MULTIPLIER, DEFAULT_IMAGE_MS_PER_IMAGE } from './defaults'
import { getModelRegistry } from './registry'
import type { ImageEstimation } from '~/types'

export const getImageCost = (service: string, model: string): number => {
  const imageModel = getModelRegistry().image[service]?.models[model]
  if (!imageModel) return 0
  if (typeof imageModel.costPerImageCents === 'number') return imageModel.costPerImageCents
  return imageModel.costPerImageUSD * 100
}

export const getImageEstimation = (service: string, model: string): ImageEstimation => {
  const modelMeta = getModelRegistry().image[service]?.models[model]
  return {
    costMultiplier: modelMeta?.estimation?.costMultiplier ?? DEFAULT_COST_MULTIPLIER,
    msPerImage: modelMeta?.estimation?.msPerImage ?? DEFAULT_IMAGE_MS_PER_IMAGE,
  }
}

export const isNativeGeminiImage = (model: string): boolean => {
  return getModelRegistry().image['gemini']?.models[model]?.nativeGeminiImage === true
}
