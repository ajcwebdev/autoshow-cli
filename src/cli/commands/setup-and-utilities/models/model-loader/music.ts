import { DEFAULT_COST_MULTIPLIER, DEFAULT_MUSIC_MS_PER_SECOND } from './defaults'
import { getModelRegistry } from './registry'
import type { DurationBilledEstimation, MusicModelMeta } from '~/types'

export const getMusicModelMeta = (service: string, model: string): MusicModelMeta | undefined => {
  return getModelRegistry().music[service]?.models[model]
}

export const getMusicEstimation = (service: string, model: string): DurationBilledEstimation => {
  const modelMeta = getModelRegistry().music[service]?.models[model]
  return {
    costMultiplier: modelMeta?.estimation?.costMultiplier ?? DEFAULT_COST_MULTIPLIER,
    msPerSecond: modelMeta?.estimation?.msPerSecond ?? DEFAULT_MUSIC_MS_PER_SECOND,
  }
}
