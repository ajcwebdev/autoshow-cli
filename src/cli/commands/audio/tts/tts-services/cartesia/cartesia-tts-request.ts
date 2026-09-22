import type { CartesiaTtsModel } from '~/types'
import { UsageError } from '~/utils/error-handler'

const SONIC_36_LANGUAGES = new Set('en fr de es pt zh ja hi it ko nl pl ru sv tr tl bg ro ar cs el fi hr ms sk da ta uk hu no vi bn th he ka id te gu kn ml mr pa or ur'.split(' '))

export const CARTESIA_API_VERSION = '2026-08-14'

export const cartesiaTtsApiVersion = (_model: string): string => CARTESIA_API_VERSION
export const cartesiaTtsVoiceField = (_model: string): string => 'voice'

export const validateCartesiaTtsLanguage = (model: string, language?: string): string | undefined => {
  const value = language?.trim() || undefined
  if (value && (!/^[a-z]{2}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2}|-\d{3})?$/.test(value) || !SONIC_36_LANGUAGES.has(value.split('-')[0]!))) {
    throw UsageError(`Cartesia ${model} language must be a supported language code or locale; received "${value}".`)
  }
  return value
}

export const cartesiaTtsRequestControls = (model: string, language?: string, speed?: number) => ({
  modelId: model,
  ...(validateCartesiaTtsLanguage(model, language) ? { language: language?.trim() } : {}),
  ...(speed !== undefined ? { generationConfig: { speed } } : {}),
  outputFormat: { container: 'wav', encoding: 'pcm_s16le', sample_rate: 24000 },
  version: cartesiaTtsApiVersion(model)
})

export const buildCartesiaTtsRequestBody = (model: CartesiaTtsModel, text: string, voice: string, language?: string, speed?: number) => ({
  model_id: model,
  transcript: text,
  voice,
  ...(validateCartesiaTtsLanguage(model, language) ? { language: language?.trim() } : {}),
  ...(speed !== undefined ? { generation_config: { speed } } : {}),
  output_format: cartesiaTtsRequestControls(model, language).outputFormat
})
