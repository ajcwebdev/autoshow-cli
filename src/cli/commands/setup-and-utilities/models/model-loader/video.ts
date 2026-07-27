import { DEFAULT_COST_MULTIPLIER, DEFAULT_VIDEO_MS_PER_SECOND } from './defaults'
import { getModelRegistry } from './registry'
import type { DurationBilledEstimation, VideoModelMeta } from '~/types'

export const getVideoModelMeta = (service: string, model: string): VideoModelMeta | undefined => {
  return getModelRegistry().video[service]?.models[model]
}

export const getVideoEstimation = (service: string, model: string): DurationBilledEstimation => {
  const modelMeta = getModelRegistry().video[service]?.models[model]
  return {
    costMultiplier: modelMeta?.estimation?.costMultiplier ?? DEFAULT_COST_MULTIPLIER,
    msPerSecond: modelMeta?.estimation?.msPerSecond ?? DEFAULT_VIDEO_MS_PER_SECOND,
  }
}
