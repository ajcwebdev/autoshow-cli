import { DEFAULT_COST_MULTIPLIER, DEFAULT_VIDEO_MS_PER_SECOND } from './defaults'
import { getModelRegistry } from './registry'
import { getRetiredModelRate } from './retired-model-rates'
import type { DurationBilledEstimation, VideoModelMeta } from '~/types'
import type { RetiredModelRate } from './retired-model-rates'

export const getVideoModelMeta = (
  service: string,
  model: string
): VideoModelMeta | RetiredModelRate<'video'> | undefined => {
  return getModelRegistry().video[service]?.models[model]
    ?? getRetiredModelRate('video', service, model)
}

export const getVideoEstimation = (service: string, model: string): DurationBilledEstimation => {
  const modelMeta = getModelRegistry().video[service]?.models[model]
  return {
    costMultiplier: modelMeta?.estimation?.costMultiplier ?? DEFAULT_COST_MULTIPLIER,
    msPerSecond: modelMeta?.estimation?.msPerSecond ?? DEFAULT_VIDEO_MS_PER_SECOND,
  }
}
