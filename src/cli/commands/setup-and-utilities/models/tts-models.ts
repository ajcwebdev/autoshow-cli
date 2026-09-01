import { createModelValidator, formatAllowedValues } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { UsageError } from '~/utils/error-handler'
import {
  getGrokTtsVoices,
  getOpenAITtsVoices
} from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { CartesiaTtsModel, ElevenlabsTtsModel, GrokTtsModel, HumeTtsModel, InworldTtsModel, MinimaxTtsModel, MistralTtsModel, OpenAITtsModel, OpenAITtsVoiceSelection, SpeechifyTtsModel } from '~/types'
import { createRetiringModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'

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

export const SUPPORTED_MINIMAX_TTS_MODELS = [
  'speech-2.8-hd',
  'speech-2.8-turbo'
] as const satisfies readonly string[]

export const validateMinimaxTtsModel = createModelValidator<MinimaxTtsModel>(SUPPORTED_MINIMAX_TTS_MODELS, 'minimax-tts')

const SUPPORTED_MINIMAX_TTS_LANGUAGE_BOOSTS = [
  'Chinese',
  'Chinese,Yue',
  'English',
  'Arabic',
  'Russian',
  'Spanish',
  'French',
  'Portuguese',
  'German',
  'Turkish',
  'Dutch',
  'Ukrainian',
  'Vietnamese',
  'Indonesian',
  'Japanese',
  'Italian',
  'Korean',
  'Thai',
  'Polish',
  'Romanian',
  'Greek',
  'Czech',
  'Finnish',
  'Hindi',
  'Bulgarian',
  'Danish',
  'Hebrew',
  'Malay',
  'Persian',
  'Slovak',
  'Swedish',
  'Croatian',
  'Filipino',
  'Hungarian',
  'Norwegian',
  'Slovenian',
  'Catalan',
  'Nynorsk',
  'Tamil',
  'Afrikaans',
  'auto'
] as const satisfies readonly string[]

export const SUPPORTED_MINIMAX_TTS_EMOTIONS = [
  'happy',
  'sad',
  'angry',
  'fearful',
  'disgusted',
  'surprised',
  'calm',
  'fluent',
  'whisper'
] as const satisfies readonly string[]

const normalizeListedValue = (value: string, allowedValues: readonly string[]): string | undefined => {
  const normalized = value.trim().toLowerCase()
  return allowedValues.find((candidate) => candidate.toLowerCase() === normalized)
}

export const validateMinimaxTtsLanguageBoost = (value: string): string => {
  const normalized = normalizeListedValue(value, SUPPORTED_MINIMAX_TTS_LANGUAGE_BOOSTS)
  if (!normalized) {
    throw UsageError(
      `Invalid --tts-language "${value}". Allowed values: ${formatAllowedValues(SUPPORTED_MINIMAX_TTS_LANGUAGE_BOOSTS)}`
    )
  }
  return normalized
}

export const validateMinimaxTtsEmotion = (value: string): string => {
  const normalized = normalizeListedValue(value, SUPPORTED_MINIMAX_TTS_EMOTIONS)
  if (!normalized) {
    throw UsageError(
      `Invalid --minimax-tts-emotion "${value}". Allowed values: ${formatAllowedValues(SUPPORTED_MINIMAX_TTS_EMOTIONS)}`
    )
  }
  return normalized
}

export const SUPPORTED_GROK_TTS_MODELS = [
  'grok-tts'
] as const satisfies readonly string[]

export const SUPPORTED_GROK_TTS_VOICES = getGrokTtsVoices()
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

export const SUPPORTED_OPENAI_TTS_VOICES = getOpenAITtsVoices()

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

export const SUPPORTED_SPEECHIFY_TTS_MODELS = [
  'simba-3.2'
] as const satisfies readonly string[]

export const SPEECHIFY_DEFAULT_TTS_VOICE = 'geffen_32'
const SPEECHIFY_SIMBA_3_2_BUILT_IN_VOICES = [
  'beatrice_32',
  'dominic_32',
  'edmund_32',
  'geffen_32',
  'harper_32',
  'hugh_32',
  'imogen_32',
  'wyatt_32'
] as const satisfies readonly string[]
const SPEECHIFY_KNOWN_INCOMPATIBLE_BUILT_IN_VOICES = [
  'george',
  'henry',
  'carly',
  'sophia'
] as const satisfies readonly string[]

export const validateSpeechifyTtsModel = createRetiringModelValidator<SpeechifyTtsModel>('tts', 'speechify', SUPPORTED_SPEECHIFY_TTS_MODELS, 'speechify-tts')

export const validateSpeechifyTtsVoice = (voice: string): string => {
  const normalized = voice.trim()
  if (!normalized) {
    throw UsageError('Invalid --speechify-voice value. Expected a non-empty Speechify voice ID.')
  }
  return normalized
}

export const validateSpeechifyTtsLanguageForModel = (
  model: SpeechifyTtsModel,
  language: string | undefined
): string | undefined => {
  const normalized = language?.trim()
  if (!normalized) return undefined

  const supported = normalized === 'en' || normalized.toLowerCase().startsWith('en-')
  if (!supported) {
    throw UsageError(
      `Speechify ${model} supports only en or en-* languages; received "${language}".`
    )
  }
  return normalized
}

export const validateSpeechifyTtsVoiceForModel = (
  model: SpeechifyTtsModel,
  voice: string
): string => {
  const normalized = validateSpeechifyTtsVoice(voice)
  if (model !== 'simba-3.2') return normalized
  if (SPEECHIFY_SIMBA_3_2_BUILT_IN_VOICES.includes(normalized as typeof SPEECHIFY_SIMBA_3_2_BUILT_IN_VOICES[number])) {
    return normalized
  }
  if (SPEECHIFY_KNOWN_INCOMPATIBLE_BUILT_IN_VOICES.includes(normalized as typeof SPEECHIFY_KNOWN_INCOMPATIBLE_BUILT_IN_VOICES[number])) {
    throw UsageError(`Speechify built-in voice "${voice}" is not compatible with simba-3.2.`)
  }
  return normalized
}

export const SUPPORTED_HUME_TTS_MODELS = [
  'octave-1',
  'octave-2'
] as const satisfies readonly string[]

export const HUME_DEFAULT_TTS_VOICE = 'Male English Actor'
export const HUME_LIBRARY_VOICE_PROVIDER = 'HUME_AI'

export const validateHumeTtsModel = createModelValidator<HumeTtsModel>(SUPPORTED_HUME_TTS_MODELS, 'hume-tts')

export const validateHumeTtsVoice = (voice: string): string => {
  const normalized = voice.trim()
  if (!normalized) {
    throw UsageError('Invalid --hume-tts-voice value. Expected a non-empty Hume voice name or ID.')
  }
  return normalized
}

export const SUPPORTED_CARTESIA_TTS_MODELS = [
  'sonic-3.5-2026-05-04'
] as const satisfies readonly string[]

export const CARTESIA_DEFAULT_TTS_VOICE = 'f786b574-daa5-4673-aa0c-cbe3e8534c02'

export const validateCartesiaTtsModel = createModelValidator<CartesiaTtsModel>(SUPPORTED_CARTESIA_TTS_MODELS, 'cartesia-tts')

export const validateCartesiaTtsVoice = (voice: string): string => {
  const normalized = voice.trim()
  if (!normalized) {
    throw UsageError('Invalid --cartesia-tts-voice value. Expected a non-empty Cartesia voice ID.')
  }
  return normalized
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
