import { DEFAULT_COST_MULTIPLIER, DEFAULT_MUSIC_MS_PER_SECOND } from './defaults'
import { getModelRegistry } from './registry'
import type { DurationBilledEstimation, MusicModelMeta } from '~/types'

const HISTORICAL_MUSIC_MODEL_REPLACEMENTS: Readonly<Record<string, string>> = {
  'minimax/music-2.6': 'music-3.0'
}

const resolveMusicRegistryModel = (service: string, model: string): string =>
  HISTORICAL_MUSIC_MODEL_REPLACEMENTS[`${service}/${model}`] ?? model

export const getMusicModelMeta = (service: string, model: string): MusicModelMeta | undefined => {
  return getModelRegistry().music[service]?.models[resolveMusicRegistryModel(service, model)]
}

export const getMusicEstimation = (service: string, model: string): DurationBilledEstimation => {
  const modelMeta = getModelRegistry().music[service]?.models[resolveMusicRegistryModel(service, model)]
  return {
    costMultiplier: modelMeta?.estimation?.costMultiplier ?? DEFAULT_COST_MULTIPLIER,
    msPerSecond: modelMeta?.estimation?.msPerSecond ?? DEFAULT_MUSIC_MS_PER_SECOND,
  }
}
