import { DEFAULT_COST_MULTIPLIER, DEFAULT_TTS_MS_PER_1K_CHARS } from './defaults'
import { getModelRegistry, getRegistryServiceType } from './registry'
import type { TtsEstimation } from '~/types'

export const getTtsPricing = (
  service: string,
  model: string
): {
  costPer1kCharsCents?: number
  characterBillingBlockSize?: number
  characterBillingBlockCostCents?: number
  inputCostPer1MCharsCents?: number
  outputCostPer1MCharsCents?: number
} => {
  const ttsModel = getModelRegistry().tts[service]?.models[model]
  if (!ttsModel) return {}
  return {
    ...(ttsModel.costPer1kCharsCents !== undefined
      ? { costPer1kCharsCents: ttsModel.costPer1kCharsCents }
      : ttsModel.costPer1kCharsUSD !== undefined
        ? { costPer1kCharsCents: ttsModel.costPer1kCharsUSD * 100 }
        : {}),
    ...(ttsModel.characterBillingBlockSize !== undefined
      ? { characterBillingBlockSize: ttsModel.characterBillingBlockSize }
      : {}),
    ...(ttsModel.characterBillingBlockCostCents !== undefined
      ? { characterBillingBlockCostCents: ttsModel.characterBillingBlockCostCents }
      : {}),
    ...(ttsModel.inputCostPer1MCharsCents !== undefined
      ? { inputCostPer1MCharsCents: ttsModel.inputCostPer1MCharsCents }
      : ttsModel.inputCostPer1MCharsUSD !== undefined
        ? { inputCostPer1MCharsCents: ttsModel.inputCostPer1MCharsUSD * 100 }
        : {}),
    ...(ttsModel.outputCostPer1MCharsCents !== undefined
      ? { outputCostPer1MCharsCents: ttsModel.outputCostPer1MCharsCents }
      : ttsModel.outputCostPer1MCharsUSD !== undefined
        ? { outputCostPer1MCharsCents: ttsModel.outputCostPer1MCharsUSD * 100 }
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

export const getTtsCost = (service: string, model: string): number => {
  const pricing = getTtsPricing(service, model)
  if (pricing.costPer1kCharsCents !== undefined) return pricing.costPer1kCharsCents
  if (pricing.outputCostPer1MCharsCents !== undefined) return pricing.outputCostPer1MCharsCents / 1000
  return 0
}

export const getKittenHfRepo = (model: string): string | undefined => {
  return getModelRegistry().tts['kitten']?.models[model]?.hfRepo
}

export const getKittenVoices = (): readonly string[] => {
  return getModelRegistry().tts['kitten']?.voices ?? []
}

export const getGroqTtsVoices = (): readonly string[] => {
  return getModelRegistry().tts['groq']?.voices ?? []
}

export const getGrokTtsVoices = (): readonly string[] => {
  return getModelRegistry().tts['grok']?.voices ?? []
}
