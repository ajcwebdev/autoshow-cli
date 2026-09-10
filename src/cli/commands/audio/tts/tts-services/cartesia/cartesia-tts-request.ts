import type { CartesiaTtsModel } from '~/types'
import { UsageError } from '~/utils/error-handler'

const SONIC_36_LANGUAGES = new Set('en fr de es pt zh ja hi it ko nl pl ru sv tr tl bg ro ar cs el fi hr ms sk da ta uk hu no vi bn th he ka id te gu kn ml mr pa or ur'.split(' '))

export const cartesiaTtsApiVersion = (model: string): string => model === 'sonic-3.6-2026-08-27' ? '2026-08-14' : '2026-03-01'
export const cartesiaTtsVoiceField = (model: string): string => model === 'sonic-3.6-2026-08-27' ? 'voice' : 'voice.id'

export const validateCartesiaTtsLanguage = (model: string, language?: string): string | undefined => {
  const value = language?.trim() || undefined
  if (model === 'sonic-3.6-2026-08-27' && value && !SONIC_36_LANGUAGES.has(value)) {
    throw UsageError(`Cartesia ${model} language must be a supported base language code; received "${value}". Locale controls are not exposed by this adapter.`)
  }
  return value
}

export const cartesiaTtsRequestControls = (model: string, language?: string) => ({
  // Keep legacy controls byte-for-byte compatible with retained paid slots.
  ...(model === 'sonic-3.6-2026-08-27' ? { modelId: model } : {}),
  ...(validateCartesiaTtsLanguage(model, language) ? { language: language?.trim() } : {}),
  outputFormat: { container: 'wav', encoding: 'pcm_s16le', sample_rate: 24000 },
  version: cartesiaTtsApiVersion(model)
})

export const buildCartesiaTtsRequestBody = (model: CartesiaTtsModel, text: string, voice: string, language?: string) => ({
  model_id: model,
  transcript: text,
  voice: model === 'sonic-3.6-2026-08-27' ? voice : { mode: 'id', id: voice },
  ...(validateCartesiaTtsLanguage(model, language) ? { language: language?.trim() } : {}),
  output_format: cartesiaTtsRequestControls(model, language).outputFormat
})
