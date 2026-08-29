import { DEFAULT_COST_MULTIPLIER, DEFAULT_TTS_MS_PER_1K_CHARS } from './defaults'
import { getModelRegistry, getRegistryServiceType } from './registry'
import { getRetiredModelRate } from './retired-model-rates'
import type { TtsEstimation } from '~/types'

export const getTtsPricing = (
  service: string,
  model: string
): {
  costPerRequestCents?: number
  costPer1kCharsCents?: number
  inputCostPer1MCharsCents?: number
  outputCostPer1MCharsCents?: number
} => {
  const ttsModel = getModelRegistry().tts[service]?.models[model]
    ?? getRetiredModelRate('tts', service, model)
  if (!ttsModel) return {}
  return {
    ...(ttsModel.costPerRequestCents !== undefined
      ? { costPerRequestCents: ttsModel.costPerRequestCents }
      : {}),
    ...(ttsModel.costPer1kCharsCents !== undefined
      ? { costPer1kCharsCents: ttsModel.costPer1kCharsCents }
      : {}),
    ...(ttsModel.inputCostPer1MCharsCents !== undefined
      ? { inputCostPer1MCharsCents: ttsModel.inputCostPer1MCharsCents }
      : {}),
    ...(ttsModel.outputCostPer1MCharsCents !== undefined
      ? { outputCostPer1MCharsCents: ttsModel.outputCostPer1MCharsCents }
      : {})
  }
}

export const getTtsEstimation = (service: string, model: string): TtsEstimation => {
  const serviceType = getRegistryServiceType('tts', service) ?? 'api'
  const modelMeta = getModelRegistry().tts[service]?.models[model]
  return {
    costMultiplier: modelMeta?.estimation?.costMultiplier ?? DEFAULT_COST_MULTIPLIER,
    msPer1KChars: modelMeta?.estimation?.msPer1KChars ?? DEFAULT_TTS_MS_PER_1K_CHARS[serviceType],
  }
}

export const getTtsMaxInputCharacters = (service: string, model: string): number | undefined =>
  getModelRegistry().tts[service]?.models[model]?.limits?.maxInputCharacters

export const getTtsCost = (service: string, model: string): number => {
  const pricing = getTtsPricing(service, model)
  if (pricing.costPer1kCharsCents !== undefined) return pricing.costPer1kCharsCents
  if (pricing.outputCostPer1MCharsCents !== undefined) return pricing.outputCostPer1MCharsCents / 1000
  return 0
}

export const estimateTtsRequestCount = (service: string, model: string, characterCount: number): number => {
  const normalizedCharacters = Math.max(0, Math.floor(characterCount))
  if (normalizedCharacters === 0) return 0
  const maxInputCharacters = getTtsMaxInputCharacters(service, model)
  return maxInputCharacters === undefined ? 1 : Math.ceil(normalizedCharacters / maxInputCharacters)
}

export const getGrokTtsVoices = (): readonly string[] => {
  return getModelRegistry().tts['grok']?.voices ?? []
}

export const getOpenAITtsVoices = (): readonly string[] => {
  return getModelRegistry().tts['openai']?.voices ?? []
}
