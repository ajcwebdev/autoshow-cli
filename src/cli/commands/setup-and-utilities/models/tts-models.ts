import { createModelValidator, formatAllowedValues, throwRetiredModelSelection } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { getRetiredModelReplacement } from '~/cli/commands/setup-and-utilities/models/model-loader/retired-model-rates'
import { CLIUsageError } from '~/utils/error-handler'
import {
  getGeminiTtsVoices,
  getGroqTtsVoices,
  getGrokTtsVoices,
  getOpenAITtsVoices
} from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { CartesiaTtsModel, DeepgramTtsModel, DeepinfraTtsModel, ElevenlabsTtsModel, FalTtsModel, FishTtsModel, GeminiTtsModel, GrokTtsModel, GroqTtsModel, HumeTtsModel, InworldTtsModel, MinimaxTtsModel, MistralTtsModel, OpenAITtsModel, ReplicateTtsModel, SpeechifyTtsModel } from '~/types'

export const SUPPORTED_ELEVENLABS_TTS_MODELS = [
  'eleven_v3'
] as const satisfies readonly string[]

export const ELEVENLABS_DEFAULT_VOICE_ID = 'hpp4J3VqNfWAUOO0d1Us'
export const SUPPORTED_ELEVENLABS_TTS_TEXT_NORMALIZATIONS = [
  'auto',
  'on',
  'off'
] as const satisfies readonly string[]

const validateActiveElevenlabsTtsModel = createModelValidator<ElevenlabsTtsModel>(SUPPORTED_ELEVENLABS_TTS_MODELS, 'elevenlabs-tts')
export const validateElevenlabsTtsModel = (model: string): ElevenlabsTtsModel => {
  const replacement = getRetiredModelReplacement('tts', 'elevenlabs', model)
  if (replacement !== undefined) return throwRetiredModelSelection(model, 'elevenlabs-tts', replacement)
  return validateActiveElevenlabsTtsModel(model)
}

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
      `Invalid --tts-language "${value}". Allowed values: ${formatAllowedValues(SUPPORTED_MINIMAX_TTS_LANGUAGE_BOOSTS)}`
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
  'canopylabs/orpheus-v1-english'
] as const satisfies readonly string[]

export const SUPPORTED_GROQ_ENGLISH_TTS_VOICES = [
  'autumn',
  'diana',
  'hannah',
  'austin',
  'daniel',
  'troy'
] as const satisfies readonly string[]

const SUPPORTED_GROQ_TTS_VOICES = getGroqTtsVoices()
export const GROQ_DEFAULT_TTS_VOICE = 'troy'

const validateActiveGroqTtsModel = createModelValidator<GroqTtsModel>(SUPPORTED_GROQ_TTS_MODELS, 'groq-tts')
export const validateGroqTtsModel = (model: string): GroqTtsModel => {
  const replacement = getRetiredModelReplacement('tts', 'groq', model)
  if (replacement !== undefined) return throwRetiredModelSelection(model, 'groq-tts', replacement)
  return validateActiveGroqTtsModel(model)
}

export const validateGroqTtsVoice = (voice: string): string => {
  const normalized = voice.trim().toLowerCase()
  if (!SUPPORTED_GROQ_TTS_VOICES.includes(normalized)) {
    throw CLIUsageError(
      `Invalid --tts-voice groq="${voice}". Allowed values: ${formatAllowedValues(SUPPORTED_GROQ_TTS_VOICES)}`
    )
  }
  return normalized
}

export const getGroqTtsVoicesForModel = (_model: GroqTtsModel): readonly string[] =>
  SUPPORTED_GROQ_ENGLISH_TTS_VOICES

export const getGroqDefaultTtsVoiceForModel = (_model: GroqTtsModel): string =>
  GROQ_DEFAULT_TTS_VOICE

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
  'gpt-4o-mini-tts-2025-12-15'
] as const satisfies readonly string[]

export const OPENAI_DEFAULT_TTS_VOICE = 'alloy'

export const SUPPORTED_OPENAI_TTS_VOICES = getOpenAITtsVoices()

export type OpenAITtsVoiceSelection = Readonly<
  | { kind: 'built-in', voiceId: string, requestVoice: string }
  | { kind: 'custom', voiceId: string, requestVoice: Readonly<{ id: string }> }
>

const validateActiveOpenAITtsModel = createModelValidator<OpenAITtsModel>(SUPPORTED_OPENAI_TTS_MODELS, 'openai-tts')
export const validateOpenAITtsModel = (model: string): OpenAITtsModel => {
  const replacement = getRetiredModelReplacement('tts', 'openai', model)
  if (replacement !== undefined) return throwRetiredModelSelection(model, 'openai-tts', replacement)
  return validateActiveOpenAITtsModel(model)
}

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
  'simba-3.2'
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

const validateActiveSpeechifyTtsModel = createModelValidator<SpeechifyTtsModel>(SUPPORTED_SPEECHIFY_TTS_MODELS, 'speechify-tts')
export const validateSpeechifyTtsModel = (model: string): SpeechifyTtsModel => {
  const replacement = getRetiredModelReplacement('tts', 'speechify', model)
  if (replacement !== undefined) return throwRetiredModelSelection(model, 'speechify-tts', replacement)
  return validateActiveSpeechifyTtsModel(model)
}

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

  const supported = normalized === 'en' || normalized.toLowerCase().startsWith('en-')
  if (!supported) {
    throw CLIUsageError(
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
    throw CLIUsageError(`Speechify built-in voice "${voice}" is not compatible with simba-3.2.`)
  }
  return normalized
}

export const SUPPORTED_HUME_TTS_MODELS = [
  'octave-1',
  'octave-2'
] as const satisfies readonly string[]

export const HUME_DEFAULT_TTS_VOICE = 'Male English Actor'
// Hume resolves a voice by name only within one namespace. Named lookups go to the shared Hume
// library; account-owned custom voices are addressed by their stable UUID through --tts-voice.
export const HUME_LIBRARY_VOICE_PROVIDER = 'HUME_AI'

export const validateHumeTtsModel = createModelValidator<HumeTtsModel>(SUPPORTED_HUME_TTS_MODELS, 'hume-tts')

export const validateHumeTtsVoice = (voice: string): string => {
  const normalized = voice.trim()
  if (!normalized) {
    throw CLIUsageError('Invalid --hume-tts-voice value. Expected a non-empty Hume voice name or ID.')
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

export const SUPPORTED_FISH_TTS_MODELS = [
  's2.1-pro'
] as const satisfies readonly string[]

export const FISH_DEFAULT_TTS_VOICE = '7f92f8afb8ec43bf81429cc1c9199cb1'

const validateActiveFishTtsModel = createModelValidator<FishTtsModel>(SUPPORTED_FISH_TTS_MODELS, 'fish-tts')
export const validateFishTtsModel = (model: string): FishTtsModel => {
  const replacement = getRetiredModelReplacement('tts', 'fish', model)
  if (replacement !== undefined) return throwRetiredModelSelection(model, 'fish-tts', replacement)
  return validateActiveFishTtsModel(model)
}

export const validateFishTtsVoice = (voice: string): string => {
  const normalized = voice.trim()
  if (!normalized) {
    throw CLIUsageError('Invalid --fish-tts-voice value. Expected a non-empty Fish model/voice ID.')
  }
  return normalized
}

export const SUPPORTED_INWORLD_TTS_MODELS = [
  'realtime-tts-2'
] as const satisfies readonly string[]

export const INWORLD_DEFAULT_TTS_VOICE = 'voice_inworld_standard_en'

const validateActiveInworldTtsModel = createModelValidator<InworldTtsModel>(SUPPORTED_INWORLD_TTS_MODELS, 'inworld-tts')
export const validateInworldTtsModel = (model: string): InworldTtsModel => {
  const replacement = getRetiredModelReplacement('tts', 'inworld', model)
  if (replacement !== undefined) return throwRetiredModelSelection(model, 'inworld-tts', replacement)
  return validateActiveInworldTtsModel(model)
}

export const validateInworldTtsVoice = (voice: string): string => {
  const normalized = voice.trim()
  if (!normalized) {
    throw CLIUsageError('Invalid --inworld-voice value. Expected a non-empty Inworld voice ID.')
  }
  return normalized
}

export const SUPPORTED_DEEPINFRA_TTS_MODELS = [
  'ResembleAI/chatterbox-turbo',
  'XiaomiMiMo/MiMo-V2.5-tts',
  'XiaomiMiMo/MiMo-V2.5-tts-voicedesign',
  'Qwen/Qwen3-TTS',
  'Qwen/Qwen3-TTS-VoiceDesign'
] as const satisfies readonly string[]

export const DEEPINFRA_DEFAULT_TTS_VOICE = 'standard'

const validateActiveDeepinfraTtsModel = createModelValidator<DeepinfraTtsModel>(SUPPORTED_DEEPINFRA_TTS_MODELS, 'deepinfra-tts')
export const validateDeepinfraTtsModel = (model: string): DeepinfraTtsModel => {
  const replacement = getRetiredModelReplacement('tts', 'deepinfra', model)
  if (replacement !== undefined) return throwRetiredModelSelection(model, 'deepinfra-tts', replacement)
  return validateActiveDeepinfraTtsModel(model)
}

export const validateDeepinfraTtsVoice = (voice: string): string => {
  const normalized = voice.trim()
  if (!normalized) {
    throw CLIUsageError('Invalid --deepinfra-voice value. Expected a non-empty DeepInfra model/voice ID.')
  }
  return normalized
}

export const SUPPORTED_REPLICATE_TTS_MODELS = [
  'jaaari/kokoro-82m'
] as const satisfies readonly string[]

export const SUPPORTED_REPLICATE_TTS_VOICES = [
  'af_alloy',
  'af_aoede',
  'af_bella',
  'af_jessica',
  'af_kore',
  'af_nicole',
  'af_nova',
  'af_river',
  'af_sarah',
  'af_sky',
  'am_adam',
  'am_echo',
  'am_eric',
  'am_fenrir',
  'am_liam',
  'am_michael',
  'am_onyx',
  'am_puck',
  'bf_alice',
  'bf_emma',
  'bf_isabella',
  'bf_lily',
  'bm_daniel',
  'bm_fable',
  'bm_george',
  'bm_lewis',
  'ff_siwis',
  'hf_alpha',
  'hf_beta',
  'hm_omega',
  'hm_psi',
  'if_sara',
  'im_nicola',
  'jf_alpha',
  'jf_gongitsune',
  'jf_nezumi',
  'jf_tebukuro',
  'jm_kumo',
  'zf_xiaobei',
  'zf_xiaoni',
  'zf_xiaoxiao',
  'zf_xiaoyi',
  'zm_yunjian',
  'zm_yunxi',
  'zm_yunxia',
  'zm_yunyang'
] as const satisfies readonly string[]

export const REPLICATE_DEFAULT_TTS_VOICE = 'af_bella'

export const SUPPORTED_FAL_TTS_MODELS = [
  'fal-ai/bytedance/seed-speech/tts/v2',
  'fal-ai/maya',
  'async/tts-pro/v1.0'
] as const satisfies readonly string[]

export const validateFalTtsModel = createModelValidator<FalTtsModel>(SUPPORTED_FAL_TTS_MODELS, 'fal-tts')

export const validateFalTtsVoice = (voice: string): string => {
  const normalized = voice.trim()
  if (!normalized) {
    throw CLIUsageError('Invalid --fal-voice value. Expected a non-empty fal.ai voice ID or voice description.')
  }
  return normalized
}

export const validateReplicateTtsModel = createModelValidator<ReplicateTtsModel>(SUPPORTED_REPLICATE_TTS_MODELS, 'replicate-tts')

export const validateReplicateTtsVoice = (voice: string): string => {
  const normalized = voice.trim()
  if (!SUPPORTED_REPLICATE_TTS_VOICES.includes(normalized as typeof SUPPORTED_REPLICATE_TTS_VOICES[number])) {
    throw CLIUsageError(`Invalid --replicate-voice value "${normalized}". Expected a supported Kokoro voice: ${SUPPORTED_REPLICATE_TTS_VOICES.join(', ')}.`)
  }
  return normalized
}
