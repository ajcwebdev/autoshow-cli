import { DEFAULT_COST_MULTIPLIER, DEFAULT_IMAGE_MS_PER_IMAGE } from './defaults'
import { getModelRegistry } from './registry'
import { getRetiredModelRate } from './retired-model-rates'
import type { ImageEstimation, ImageModelMeta, RetiredModelRate } from '~/types'

export const getImageModelMeta = (
  service: string,
  model: string
): ImageModelMeta | RetiredModelRate<'image'> | undefined => {
  return getModelRegistry().image[service]?.models[model]
    ?? getRetiredModelRate('image', service, model)
}

export const getImageCost = (service: string, model: string): number =>
  getImageModelMeta(service, model)?.costPerImageCents ?? 0

export const getImageInputCostPer1M = (service: string, model: string): number | null => {
  const imageModel = getModelRegistry().image[service]?.models[model]
  return typeof imageModel?.imageInputCostPer1MCents === 'number' ? imageModel.imageInputCostPer1MCents : null
}

export const getImageEstimation = (service: string, model: string): ImageEstimation => {
  const modelMeta = getModelRegistry().image[service]?.models[model]
  return {
    costMultiplier: modelMeta?.estimation?.costMultiplier ?? DEFAULT_COST_MULTIPLIER,
    msPerImage: modelMeta?.estimation?.msPerImage ?? DEFAULT_IMAGE_MS_PER_IMAGE,
  }
}
