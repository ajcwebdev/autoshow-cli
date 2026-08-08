import { createModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'

export const SUPPORTED_WHISPER_MODELS = [
  'tiny',
  'base',
  'small',
  'medium',
  'large-v3-turbo'
] as const satisfies readonly string[]

// Prebuilt packaged whisperfiles hosted at huggingface.co/Mozilla/whisperfile.
// Each entry maps to a whisper-<model>.llamafile artifact (binary + embedded weights).
export const SUPPORTED_WHISPERFILE_MODELS = [
  'tiny',
  'tiny.en',
  'small',
  'small.en',
  'medium',
  'medium.en',
  'large-v2',
  'large-v3'
] as const satisfies readonly string[]

// Default whisperfile model used by `bun autoshow setup --step whisperfile` and the
// on-demand bootstrap fallback (smallest packaged whisperfile).
export const DEFAULT_WHISPERFILE_MODEL = 'tiny'

export const SUPPORTED_DEEPGRAM_STT_MODELS = [
  // Keep the concrete general-purpose family selector only. Domain and
  // specialization variants such as nova-3-medical and nova-3-general are
  // intentionally outside the hosted STT refresh scope.
  'nova-3'
] as const satisfies readonly string[]

export const SUPPORTED_DEEPINFRA_STT_MODELS = [
  'openai/whisper-large-v3-turbo',
  'openai/whisper-large-v3'
] as const satisfies readonly string[]

export const SUPPORTED_SONIOX_STT_MODELS = [
  'stt-async-v5'
] as const satisfies readonly string[]

export const SUPPORTED_SPEECHMATICS_STT_MODELS = [
  'enhanced',
  'melia-1'
] as const satisfies readonly string[]

export const SUPPORTED_REV_STT_MODELS = [
  'machine',
  'low_cost'
] as const satisfies readonly string[]

export const SUPPORTED_GROQ_STT_MODELS = [
  'whisper-large-v3-turbo',
  'whisper-large-v3'
] as const satisfies readonly string[]

export const SUPPORTED_GROK_STT_MODELS = [
  'speech-to-text'
] as const satisfies readonly string[]

export const SUPPORTED_MISTRAL_STT_MODELS = [
  'voxtral-mini-2602'
] as const satisfies readonly string[]

export const SUPPORTED_ASSEMBLYAI_STT_MODELS = [
  'universal-3-5-pro',
  'universal-2'
] as const satisfies readonly string[]

export const SUPPORTED_GLADIA_STT_MODELS = [
  'solaria-1',
  'solaria-3'
] as const satisfies readonly string[]

export const SUPPORTED_HAPPYSCRIBE_STT_MODELS = [
  'auto'
] as const satisfies readonly string[]

export const SUPPORTED_SUPADATA_STT_MODELS = [
  'auto'
] as const satisfies readonly string[]

export const SUPPORTED_SCRAPECREATORS_STT_MODELS = [
  'youtube-transcript'
] as const satisfies readonly string[]

export const SUPPORTED_GEMINI_STT_MODELS = [
  'gemini-3.6-flash'
] as const satisfies readonly string[]

export const SUPPORTED_TOGETHER_STT_MODELS = [
  'openai/whisper-large-v3',
  'nvidia/parakeet-tdt-0.6b-v3'
] as const satisfies readonly string[]

export const validateWhisperModel = createModelValidator(SUPPORTED_WHISPER_MODELS, 'whisper', 'This selector uses local whisper.cpp models.')
export const validateWhisperfileModel = createModelValidator(SUPPORTED_WHISPERFILE_MODELS, 'whisperfile', 'This selector uses local whisperfile (llamafile) models.')
export const validateDeepgramSttModel = createModelValidator(SUPPORTED_DEEPGRAM_STT_MODELS, 'deepgram-stt')
export const validateDeepinfraSttModel = createModelValidator(SUPPORTED_DEEPINFRA_STT_MODELS, 'deepinfra-stt', 'This selector only accepts DeepInfra OpenAI-compatible Whisper models.')
export const validateSonioxSttModel = createModelValidator(SUPPORTED_SONIOX_STT_MODELS, 'soniox-stt')
export const validateSpeechmaticsSttModel = createModelValidator(SUPPORTED_SPEECHMATICS_STT_MODELS, 'speechmatics-stt')
export const validateRevSttModel = createModelValidator(SUPPORTED_REV_STT_MODELS, 'rev-stt')
export const validateGroqSttModel = createModelValidator(SUPPORTED_GROQ_STT_MODELS, 'groq-stt', 'This selector only accepts Groq Whisper API models.')
export const validateGrokSttModel = createModelValidator(SUPPORTED_GROK_STT_MODELS, 'grok-stt')
export const validateMistralSttModel = createModelValidator(SUPPORTED_MISTRAL_STT_MODELS, 'mistral-stt')
export const validateAssemblyaiSttModel = createModelValidator(SUPPORTED_ASSEMBLYAI_STT_MODELS, 'assemblyai-stt')
export const validateGladiaSttModel = createModelValidator(SUPPORTED_GLADIA_STT_MODELS, 'gladia-stt')
export const validateHappyscribeSttModel = createModelValidator(SUPPORTED_HAPPYSCRIBE_STT_MODELS, 'happyscribe-stt')
export const validateSupadataSttModel = createModelValidator(SUPPORTED_SUPADATA_STT_MODELS, 'supadata-stt')
export const validateScrapeCreatorsSttModel = createModelValidator(SUPPORTED_SCRAPECREATORS_STT_MODELS, 'scrapecreators-stt')
export const validateGeminiSttModel = createModelValidator(SUPPORTED_GEMINI_STT_MODELS, 'gemini-stt')
export const validateTogetherSttModel = createModelValidator(SUPPORTED_TOGETHER_STT_MODELS, 'together-stt', 'This selector accepts concrete Together serverless batch transcription models.')
