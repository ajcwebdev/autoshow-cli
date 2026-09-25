import { createModelValidator, createRetiringModelValidator, formatAllowedValues } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { UsageError } from '~/utils/error-handler'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import type { ElevenlabsTtsModel, GrokTtsModel, InworldTtsModel, MistralTtsModel, OpenAITtsModel, OpenAITtsVoiceSelection } from '~/types'

export const SUPPORTED_ELEVENLABS_TTS_MODELS = [
  'eleven_v3'
] as const satisfies readonly string[]

export const ELEVENLABS_DEFAULT_VOICE_ID = 'hpp4J3VqNfWAUOO0d1Us'
const SUPPORTED_ELEVENLABS_TTS_TEXT_NORMALIZATIONS = [
  'auto',
  'on',
  'off'
] as const satisfies readonly string[]

export const validateElevenlabsTtsModel = createRetiringModelValidator<ElevenlabsTtsModel>('tts', 'elevenlabs', SUPPORTED_ELEVENLABS_TTS_MODELS, 'elevenlabs-tts')

export const validateElevenLabsTtsTextNormalization = (value: string): string => {
  const normalized = normalizeListedValue(value, SUPPORTED_ELEVENLABS_TTS_TEXT_NORMALIZATIONS)
  if (!normalized) {
    throw UsageError(
      `Invalid --elevenlabs-tts-text-normalization "${value}". Allowed values: ${formatAllowedValues(SUPPORTED_ELEVENLABS_TTS_TEXT_NORMALIZATIONS)}`
    )
  }
  return normalized
}

const normalizeListedValue = (value: string, allowedValues: readonly string[]): string | undefined => {
  const normalized = value.trim().toLowerCase()
  return allowedValues.find((candidate) => candidate.toLowerCase() === normalized)
}

export const SUPPORTED_GEMINI_TTS_MODELS = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'] as const
export const validateGeminiTtsModel = createModelValidator(SUPPORTED_GEMINI_TTS_MODELS, 'gemini-tts')

export const SUPPORTED_GROK_TTS_MODELS = [
  'grok-tts'
] as const satisfies readonly string[]

export const SUPPORTED_GROK_TTS_VOICES: readonly string[] = getModelRegistry().tts['grok']?.voices ?? []
export const GROK_DEFAULT_TTS_VOICE = 'eve'
const SUPPORTED_GROK_TTS_LANGUAGES = [
  'auto',
  'en',
  'ar-EG',
  'ar-SA',
  'ar-AE',
  'bn',
  'zh',
  'fr',
  'de',
  'hi',
  'id',
  'it',
  'ja',
  'ko',
  'pt-BR',
  'pt-PT',
  'ru',
  'es-MX',
  'es-ES',
  'tr',
  'vi'
] as const satisfies readonly string[]

export const validateGrokTtsModel = createModelValidator<GrokTtsModel>(SUPPORTED_GROK_TTS_MODELS, 'grok-tts')

export const validateGrokTtsVoice = (voice: string): string => {
  const normalized = voice.trim().toLowerCase()
  if (!SUPPORTED_GROK_TTS_VOICES.includes(normalized) && !/^[a-z0-9]{8}$/.test(normalized)) {
    throw UsageError(
      `Invalid --grok-tts-voice "${voice}". Allowed values: ${formatAllowedValues(SUPPORTED_GROK_TTS_VOICES)}, or an 8-character custom voice ID.`
    )
  }
  return normalized
}

export const validateGrokTtsLanguage = (language: string): string => {
  const normalized = normalizeListedValue(language, SUPPORTED_GROK_TTS_LANGUAGES)
  if (!normalized) {
    throw UsageError(
      `Invalid --grok-tts-language "${language}". Allowed values: ${formatAllowedValues(SUPPORTED_GROK_TTS_LANGUAGES)}`
    )
  }
  return normalized
}

export const SUPPORTED_MISTRAL_TTS_MODELS = [
  'voxtral-mini-tts-2603'
] as const satisfies readonly string[]

export const MISTRAL_DEFAULT_REF_AUDIO = 'input/examples/audio/anthony-voice.mp3'

export const validateMistralTtsModel = createModelValidator<MistralTtsModel>(SUPPORTED_MISTRAL_TTS_MODELS, 'mistral-tts')

export const SUPPORTED_OPENAI_TTS_MODELS = [
  'gpt-4o-mini-tts-2025-12-15'
] as const satisfies readonly string[]

export const OPENAI_DEFAULT_TTS_VOICE = 'alloy'

export const SUPPORTED_OPENAI_TTS_VOICES: readonly string[] = getModelRegistry().tts['openai']?.voices ?? []

export const validateOpenAITtsModel = createRetiringModelValidator<OpenAITtsModel>('tts', 'openai', SUPPORTED_OPENAI_TTS_MODELS, 'openai-tts')

export const resolveOpenAITtsVoiceForModel = (
  _model: OpenAITtsModel,
  voice: string
): OpenAITtsVoiceSelection => {
  const trimmed = voice.trim()
  const builtInVoice = normalizeListedValue(trimmed, SUPPORTED_OPENAI_TTS_VOICES)
  if (builtInVoice) {
    return { kind: 'built-in', voiceId: builtInVoice, requestVoice: builtInVoice }
  }
  if (/^voice_\S+$/.test(trimmed)) {
    return { kind: 'custom', voiceId: trimmed, requestVoice: { id: trimmed } }
  }
  throw UsageError(
    `Invalid --tts-voice openai="${voice}". Allowed built-in values: ${formatAllowedValues(SUPPORTED_OPENAI_TTS_VOICES)}, or an eligible custom voice ID beginning with voice_.`
  )
}

export const SUPPORTED_INWORLD_TTS_MODELS = [
  'realtime-tts-2'
] as const satisfies readonly string[]

export const INWORLD_DEFAULT_TTS_VOICE = 'voice_inworld_standard_en'

export const validateInworldTtsModel = createRetiringModelValidator<InworldTtsModel>('tts', 'inworld', SUPPORTED_INWORLD_TTS_MODELS, 'inworld-tts')

export const validateInworldTtsVoice = (voice: string): string => {
  const normalized = voice.trim()
  if (!normalized) {
    throw UsageError('Invalid --inworld-voice value. Expected a non-empty Inworld voice ID.')
  }
  return normalized
}

// Soniox REST reference and supported-languages table checked 2026-09-24.
export const SUPPORTED_SONIOX_TTS_MODELS = ['tts-rt-v2'] as const
export const SONIOX_DEFAULT_TTS_VOICE = 'Adrian'
export const SUPPORTED_SONIOX_TTS_LANGUAGES = ['af', 'sq', 'ar', 'az', 'eu', 'be', 'bn', 'bs', 'bg', 'ca', 'zh', 'hr', 'cs', 'da', 'nl', 'en', 'et', 'fi', 'fr', 'gl', 'de', 'el', 'gu', 'he', 'hi', 'hu', 'id', 'it', 'ja', 'kn', 'kk', 'ko', 'lv', 'lt', 'mk', 'ms', 'ml', 'mr', 'no', 'fa', 'pl', 'pt', 'pa', 'ro', 'ru', 'sr', 'sk', 'sl', 'es', 'sw', 'sv', 'tl', 'ta', 'te', 'th', 'tr', 'uk', 'ur', 'vi', 'cy'] as const
export const validateSonioxTtsModel = createModelValidator(SUPPORTED_SONIOX_TTS_MODELS, 'soniox-tts')
export const validateSonioxTtsVoice = (value: string): string => {
  const voice = value.trim()
  if (!voice || [...voice].length > 50) throw UsageError('Soniox TTS voice must be a non-empty built-in name or existing cloned-voice ID of at most 50 characters. Voice access is checked by Soniox.')
  return voice
}
export const validateSonioxTtsLanguage = (value: string): string => {
  const language = normalizeListedValue(value, SUPPORTED_SONIOX_TTS_LANGUAGES)
  if (!language) throw UsageError('Invalid Soniox TTS language. Allowed codes: ' + SUPPORTED_SONIOX_TTS_LANGUAGES.join(', ') + '. auto is not supported.')
  return language
}
