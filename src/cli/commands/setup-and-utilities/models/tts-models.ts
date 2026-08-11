import { createModelValidator, formatAllowedValues } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { CLIUsageError, InternalError } from '~/utils/error-handler'
import {
  getKittenHfRepo,
  getKittenVoices,
  getGeminiTtsVoices,
  getGroqTtsVoices,
  getGrokTtsVoices,
  getOpenAITtsVoices
} from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { CartesiaTtsModel, DeepgramTtsModel, ElevenlabsTtsModel, GeminiTtsModel, GrokTtsModel, GroqTtsModel, HumeTtsModel, KittenTtsModel, MinimaxTtsModel, MistralTtsModel, OpenAITtsModel, SpeechifyTtsModel } from '~/types'

export const SUPPORTED_KITTEN_TTS_MODELS = [
  'kitten-tts-mini',
  'kitten-tts-micro',
  'kitten-tts-nano',
  'kitten-tts-nano-0.8-int8'
] as const satisfies readonly string[]

export const DEFAULT_KITTEN_TTS_MODEL = 'kitten-tts-nano-0.8-int8'

export const SUPPORTED_KITTEN_TTS_VOICES = getKittenVoices()

export const validateKittenTtsModel = createModelValidator<KittenTtsModel>(SUPPORTED_KITTEN_TTS_MODELS, 'kitten-tts')

export const validateKittenTtsSpeaker = (speaker: string): string => {
  if (!SUPPORTED_KITTEN_TTS_VOICES.includes(speaker)) {
    throw CLIUsageError(
      `Invalid --kitten-voice "${speaker}" for Kitten TTS. Allowed values: ${formatAllowedValues(SUPPORTED_KITTEN_TTS_VOICES)}`
    )
  }
  return speaker
}

export const resolveKittenTtsModelId = (model: KittenTtsModel): string => {
  const repo = getKittenHfRepo(model)
  if (!repo) throw InternalError(`No HF repo found for Kitten TTS model "${model}"`, { stage: 'tts:kitten' })
  return repo
}

export const SUPPORTED_ELEVENLABS_TTS_MODELS = [
  'eleven_v3',
  'eleven_multilingual_v2',
  'eleven_flash_v2_5'
] as const satisfies readonly string[]

export const ELEVENLABS_DEFAULT_VOICE_ID = 'hpp4J3VqNfWAUOO0d1Us'
export const SUPPORTED_ELEVENLABS_TTS_TEXT_NORMALIZATIONS = [
  'auto',
  'on',
  'off'
] as const satisfies readonly string[]

export const validateElevenlabsTtsModel = createModelValidator<ElevenlabsTtsModel>(SUPPORTED_ELEVENLABS_TTS_MODELS, 'elevenlabs-tts')

export const validateElevenLabsTtsTextNormalization = (value: string): string => {
  const normalized = normalizeListedValue(value, SUPPORTED_ELEVENLABS_TTS_TEXT_NORMALIZATIONS)
  if (!normalized) {
    throw CLIUsageError(
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

export const SUPPORTED_MINIMAX_TTS_LANGUAGE_BOOSTS = [
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
    throw CLIUsageError(
      `Invalid --minimax-tts-language-boost "${value}". Allowed values: ${formatAllowedValues(SUPPORTED_MINIMAX_TTS_LANGUAGE_BOOSTS)}`
    )
  }
  return normalized
}

export const validateMinimaxTtsEmotion = (value: string): string => {
  const normalized = normalizeListedValue(value, SUPPORTED_MINIMAX_TTS_EMOTIONS)
  if (!normalized) {
    throw CLIUsageError(
      `Invalid --minimax-tts-emotion "${value}". Allowed values: ${formatAllowedValues(SUPPORTED_MINIMAX_TTS_EMOTIONS)}`
    )
  }
  return normalized
}

export const SUPPORTED_GROQ_TTS_MODELS = [
  'canopylabs/orpheus-v1-english',
  'canopylabs/orpheus-arabic-saudi'
] as const satisfies readonly string[]

export const SUPPORTED_GROQ_ENGLISH_TTS_VOICES = [
  'autumn',
  'diana',
  'hannah',
  'austin',
  'daniel',
  'troy'
] as const satisfies readonly string[]

export const SUPPORTED_GROQ_ARABIC_TTS_VOICES = [
  'abdullah',
  'fahad',
  'sultan',
  'lulwa',
  'noura',
  'aisha'
] as const satisfies readonly string[]

const SUPPORTED_GROQ_TTS_VOICES = getGroqTtsVoices()
export const GROQ_DEFAULT_TTS_VOICE = 'troy'
export const GROQ_DEFAULT_ARABIC_TTS_VOICE = 'abdullah'

export const validateGroqTtsModel = createModelValidator<GroqTtsModel>(SUPPORTED_GROQ_TTS_MODELS, 'groq-tts')

export const validateGroqTtsVoice = (voice: string): string => {
  const normalized = voice.trim().toLowerCase()
  if (!SUPPORTED_GROQ_TTS_VOICES.includes(normalized)) {
    throw CLIUsageError(
      `Invalid --tts-voice groq="${voice}". Allowed values: ${formatAllowedValues(SUPPORTED_GROQ_TTS_VOICES)}`
    )
  }
  return normalized
}

export const getGroqTtsVoicesForModel = (model: GroqTtsModel): readonly string[] =>
  model === 'canopylabs/orpheus-arabic-saudi'
    ? SUPPORTED_GROQ_ARABIC_TTS_VOICES
    : SUPPORTED_GROQ_ENGLISH_TTS_VOICES

export const getGroqDefaultTtsVoiceForModel = (model: GroqTtsModel): string =>
  model === 'canopylabs/orpheus-arabic-saudi'
    ? GROQ_DEFAULT_ARABIC_TTS_VOICE
    : GROQ_DEFAULT_TTS_VOICE

export const validateGroqTtsVoiceForModel = (model: GroqTtsModel, voice: string): string => {
  const normalized = voice.trim().toLowerCase()
  const allowedValues = getGroqTtsVoicesForModel(model)
  if (!allowedValues.includes(normalized)) {
    throw CLIUsageError(
      `Invalid --tts-voice groq="${voice}" for ${model}. Allowed values: ${formatAllowedValues(allowedValues)}`
    )
  }
  return normalized
}

export const SUPPORTED_GROK_TTS_MODELS = [
  'grok-tts'
] as const satisfies readonly string[]

export const SUPPORTED_GROK_TTS_VOICES = getGrokTtsVoices()
export const GROK_DEFAULT_TTS_VOICE = 'eve'
export const SUPPORTED_GROK_TTS_LANGUAGES = [
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
    throw CLIUsageError(
      `Invalid --grok-tts-voice "${voice}". Allowed values: ${formatAllowedValues(SUPPORTED_GROK_TTS_VOICES)}, or an 8-character custom voice ID.`
    )
  }
  return normalized
}

export const validateGrokTtsLanguage = (language: string): string => {
  const normalized = normalizeListedValue(language, SUPPORTED_GROK_TTS_LANGUAGES)
  if (!normalized) {
    throw CLIUsageError(
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
  'gpt-4o-mini-tts-2025-12-15',
  'tts-1',
  'tts-1-hd'
] as const satisfies readonly string[]

export const OPENAI_DEFAULT_TTS_VOICE = 'alloy'

export const SUPPORTED_OPENAI_TTS_VOICES = getOpenAITtsVoices()
export const SUPPORTED_OPENAI_CLASSIC_TTS_VOICES = [
  'alloy',
  'ash',
  'coral',
  'echo',
  'fable',
  'onyx',
  'nova',
  'sage',
  'shimmer'
] as const satisfies readonly string[]

export type OpenAITtsVoiceSelection = Readonly<
  | { kind: 'built-in', voiceId: string, requestVoice: string }
  | { kind: 'custom', voiceId: string, requestVoice: Readonly<{ id: string }> }
>

export const validateOpenAITtsModel = createModelValidator<OpenAITtsModel>(SUPPORTED_OPENAI_TTS_MODELS, 'openai-tts')

export const resolveOpenAITtsVoiceForModel = (
  model: OpenAITtsModel,
  voice: string
): OpenAITtsVoiceSelection => {
  const trimmed = voice.trim()
  const builtInVoice = normalizeListedValue(trimmed, SUPPORTED_OPENAI_TTS_VOICES)
  if (builtInVoice) {
    const allowedValues = model === 'tts-1' || model === 'tts-1-hd'
      ? SUPPORTED_OPENAI_CLASSIC_TTS_VOICES
      : SUPPORTED_OPENAI_TTS_VOICES
    if (!allowedValues.includes(builtInVoice)) {
      throw CLIUsageError(
        `Invalid --tts-voice openai="${voice}" for ${model}. Allowed built-in values: ${formatAllowedValues(allowedValues)}, or an eligible custom voice ID beginning with voice_.`
      )
    }
    return { kind: 'built-in', voiceId: builtInVoice, requestVoice: builtInVoice }
  }
  if (/^voice_\S+$/.test(trimmed)) {
    return { kind: 'custom', voiceId: trimmed, requestVoice: { id: trimmed } }
  }
  throw CLIUsageError(
    `Invalid --tts-voice openai="${voice}". Allowed built-in values: ${formatAllowedValues(SUPPORTED_OPENAI_TTS_VOICES)}, or an eligible custom voice ID beginning with voice_.`
  )
}

export const SUPPORTED_GEMINI_TTS_MODELS = [
  'gemini-3.1-flash-tts-preview'
] as const satisfies readonly string[]

export const GEMINI_DEFAULT_TTS_VOICE = 'Kore'

export const SUPPORTED_GEMINI_TTS_VOICES = getGeminiTtsVoices()

export const validateGeminiTtsModel = createModelValidator<GeminiTtsModel>(SUPPORTED_GEMINI_TTS_MODELS, 'gemini-tts')

export const validateGeminiTtsVoice = (voice: string): string => {
  const normalized = normalizeListedValue(voice, SUPPORTED_GEMINI_TTS_VOICES)
  if (!normalized) {
    throw CLIUsageError(
      `Invalid --tts-voice gemini="${voice}". Allowed values: ${formatAllowedValues(SUPPORTED_GEMINI_TTS_VOICES)}`
    )
  }
  return normalized
}

export const SUPPORTED_DEEPGRAM_TTS_MODELS = [
  'aura-2-amalthea-en',
  'aura-2-andromeda-en',
  'aura-2-apollo-en',
  'aura-2-arcas-en',
  'aura-2-aries-en',
  'aura-2-asteria-en',
  'aura-2-athena-en',
  'aura-2-atlas-en',
  'aura-2-aurora-en',
  'aura-2-callista-en',
  'aura-2-cora-en',
  'aura-2-cordelia-en',
  'aura-2-delia-en',
  'aura-2-draco-en',
  'aura-2-electra-en',
  'aura-2-harmonia-en',
  'aura-2-helena-en',
  'aura-2-hera-en',
  'aura-2-hermes-en',
  'aura-2-hyperion-en',
  'aura-2-iris-en',
  'aura-2-janus-en',
  'aura-2-juno-en',
  'aura-2-jupiter-en',
  'aura-2-luna-en',
  'aura-2-mars-en',
  'aura-2-minerva-en',
  'aura-2-neptune-en',
  'aura-2-odysseus-en',
  'aura-2-ophelia-en',
  'aura-2-orion-en',
  'aura-2-orpheus-en',
  'aura-2-pandora-en',
  'aura-2-phoebe-en',
  'aura-2-pluto-en',
  'aura-2-saturn-en',
  'aura-2-selene-en',
  'aura-2-thalia-en',
  'aura-2-theia-en',
  'aura-2-vesta-en',
  'aura-2-zeus-en',
  'aura-2-sirio-es',
  'aura-2-nestor-es',
  'aura-2-carina-es',
  'aura-2-celeste-es',
  'aura-2-alvaro-es',
  'aura-2-diana-es',
  'aura-2-aquila-es',
  'aura-2-selena-es',
  'aura-2-estrella-es',
  'aura-2-javier-es',
  'aura-2-agustina-es',
  'aura-2-antonia-es',
  'aura-2-gloria-es',
  'aura-2-luciano-es',
  'aura-2-olivia-es',
  'aura-2-silvia-es',
  'aura-2-valerio-es',
  'aura-2-beatrix-nl',
  'aura-2-daphne-nl',
  'aura-2-cornelia-nl',
  'aura-2-sander-nl',
  'aura-2-hestia-nl',
  'aura-2-lars-nl',
  'aura-2-roman-nl',
  'aura-2-rhea-nl',
  'aura-2-leda-nl',
  'aura-2-agathe-fr',
  'aura-2-hector-fr',
  'aura-2-elara-de',
  'aura-2-aurelia-de',
  'aura-2-lara-de',
  'aura-2-julius-de',
  'aura-2-fabian-de',
  'aura-2-kara-de',
  'aura-2-viktoria-de',
  'aura-2-melia-it',
  'aura-2-elio-it',
  'aura-2-flavio-it',
  'aura-2-maia-it',
  'aura-2-cinzia-it',
  'aura-2-cesare-it',
  'aura-2-livia-it',
  'aura-2-perseo-it',
  'aura-2-dionisio-it',
  'aura-2-demetra-it',
  'aura-2-uzume-ja',
  'aura-2-ebisu-ja',
  'aura-2-fujin-ja',
  'aura-2-izanami-ja',
  'aura-2-ama-ja',
] as const satisfies readonly string[]

export const DEEPGRAM_DEFAULT_VOICE = 'aura-2-thalia-en'

export const validateDeepgramTtsModel = createModelValidator<DeepgramTtsModel>(SUPPORTED_DEEPGRAM_TTS_MODELS, 'deepgram-tts')

export const validateDeepgramTtsVoice = (voice: string): DeepgramTtsModel => {
  if (!SUPPORTED_DEEPGRAM_TTS_MODELS.includes(voice as DeepgramTtsModel)) {
    throw CLIUsageError(
      `Invalid --deepgram-voice "${voice}". Allowed values: ${formatAllowedValues(SUPPORTED_DEEPGRAM_TTS_MODELS)}`
    )
  }
  return voice as DeepgramTtsModel
}

export const SUPPORTED_SPEECHIFY_TTS_MODELS = [
  'simba-3.2',
  'simba-3.0'
] as const satisfies readonly string[]

export const SPEECHIFY_DEFAULT_TTS_VOICE = 'geffen_32'
export const SPEECHIFY_SIMBA_3_2_BUILT_IN_VOICES = [
  'beatrice_32',
  'dominic_32',
  'edmund_32',
  'geffen_32',
  'harper_32',
  'hugh_32',
  'imogen_32',
  'wyatt_32'
] as const satisfies readonly string[]
export const SPEECHIFY_KNOWN_INCOMPATIBLE_BUILT_IN_VOICES = [
  'george',
  'henry',
  'carly',
  'sophia'
] as const satisfies readonly string[]
export const SPEECHIFY_SIMBA_3_0_LANGUAGES = [
  'en',
  'de-DE',
  'es-ES',
  'es-MX',
  'fr-FR',
  'it-IT',
  'pt-BR'
] as const satisfies readonly string[]
export const SUPPORTED_SPEECHIFY_TTS_AUDIO_FORMATS = [
  'mp3',
  'ogg',
  'aac',
  'wav',
  'pcm'
] as const satisfies readonly string[]

export const validateSpeechifyTtsModel = createModelValidator<SpeechifyTtsModel>(SUPPORTED_SPEECHIFY_TTS_MODELS, 'speechify-tts')

export const validateSpeechifyTtsVoice = (voice: string): string => {
  const normalized = voice.trim()
  if (!normalized) {
    throw CLIUsageError('Invalid --speechify-voice value. Expected a non-empty Speechify voice ID.')
  }
  return normalized
}

export const validateSpeechifyTtsLanguageForModel = (
  model: SpeechifyTtsModel,
  language: string | undefined
): string | undefined => {
  const normalized = language?.trim()
  if (!normalized) return undefined

  const supported = model === 'simba-3.2'
    ? normalized === 'en' || normalized.toLowerCase().startsWith('en-')
    : SPEECHIFY_SIMBA_3_0_LANGUAGES.some((candidate) => candidate.toLowerCase() === normalized.toLowerCase())
      || normalized.toLowerCase().startsWith('en-')
  if (!supported) {
    throw CLIUsageError(
      model === 'simba-3.2'
        ? `Speechify ${model} supports only en or en-* languages; received "${language}".`
        : `Speechify ${model} does not support language "${language}". Allowed values: en, en-*, ${SPEECHIFY_SIMBA_3_0_LANGUAGES.slice(1).join(', ')}.`
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
    throw CLIUsageError(`Speechify built-in voice "${voice}" is not compatible with simba-3.2.`)
  }
  return normalized
}

export const validateSpeechifyTtsAudioFormat = (value: string): string => {
  const normalized = normalizeListedValue(value, SUPPORTED_SPEECHIFY_TTS_AUDIO_FORMATS)
  if (!normalized) {
    throw CLIUsageError(
      `Invalid --speechify-tts-audio-format "${value}". Allowed values: ${formatAllowedValues(SUPPORTED_SPEECHIFY_TTS_AUDIO_FORMATS)}`
    )
  }
  return normalized
}

export const SUPPORTED_HUME_TTS_MODELS = [
  'octave-2'
] as const satisfies readonly string[]

export const HUME_DEFAULT_TTS_VOICE = 'Male English Actor'
export const SUPPORTED_HUME_TTS_VOICE_PROVIDERS = [
  'HUME_AI',
  'CUSTOM_VOICE'
] as const satisfies readonly string[]

export const validateHumeTtsModel = createModelValidator<HumeTtsModel>(SUPPORTED_HUME_TTS_MODELS, 'hume-tts')

export const validateHumeTtsVoice = (voice: string): string => {
  const normalized = voice.trim()
  if (!normalized) {
    throw CLIUsageError('Invalid --hume-tts-voice value. Expected a non-empty Hume voice name or ID.')
  }
  return normalized
}

export const validateHumeTtsVoiceProvider = (value: string): string => {
  const normalized = normalizeListedValue(value, SUPPORTED_HUME_TTS_VOICE_PROVIDERS)
  if (!normalized) {
    throw CLIUsageError(
      `Invalid --hume-tts-voice-provider "${value}". Allowed values: ${formatAllowedValues(SUPPORTED_HUME_TTS_VOICE_PROVIDERS)}`
    )
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
    throw CLIUsageError('Invalid --cartesia-tts-voice value. Expected a non-empty Cartesia voice ID.')
  }
  return normalized
}
