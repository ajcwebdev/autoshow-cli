import { createModelValidator, createRetiringModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'

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

export const DEFAULT_WHISPERFILE_MODEL = 'tiny'

export const SUPPORTED_DEEPGRAM_STT_MODELS = [
  'nova-3'
] as const satisfies readonly string[]

export const SUPPORTED_DEEPINFRA_STT_MODELS = [
  'openai/whisper-large-v3-turbo',
  'openai/whisper-large-v3',
  'Qwen/Qwen3-ASR-0.6B',
  'Qwen/Qwen3-ASR-1.7B',
  'mistralai/Voxtral-Mini-3B-2507',
  'mistralai/Voxtral-Small-24B-2507',
  'nvidia/Nemotron-3.5-ASR-Streaming-Multilingual-0.6b'
] as const satisfies readonly string[]

export const SUPPORTED_SONIOX_STT_MODELS = [
  'stt-async-v5'
] as const satisfies readonly string[]

export const SUPPORTED_SPEECHMATICS_STT_MODELS = [
  'melia-1'
] as const satisfies readonly string[]

export const SUPPORTED_GROK_STT_MODELS = [
  'speech-to-text'
] as const satisfies readonly string[]

export const SUPPORTED_MISTRAL_STT_MODELS = [
  'voxtral-mini-2602'
] as const satisfies readonly string[]

export const SUPPORTED_ASSEMBLYAI_STT_MODELS = [
  'universal-3-5-pro'
] as const satisfies readonly string[]

export const SUPPORTED_GLADIA_STT_MODELS = [
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
  'gemini-3.5-transcribe'
] as const satisfies readonly string[]

export const SUPPORTED_OPENAI_STT_MODELS = [
  'gpt-transcribe'
] as const satisfies readonly string[]

export const SUPPORTED_TOGETHER_STT_MODELS = [
  'openai/whisper-large-v3',
  'nvidia/parakeet-tdt-0.6b-v3'
] as const satisfies readonly string[]

export const validateWhisperfileModel = createModelValidator(SUPPORTED_WHISPERFILE_MODELS, 'whisperfile', 'This selector uses local whisperfile models.')
export const validateDeepgramSttModel = createModelValidator(SUPPORTED_DEEPGRAM_STT_MODELS, 'deepgram-stt')
export const validateDeepinfraSttModel = createModelValidator(SUPPORTED_DEEPINFRA_STT_MODELS, 'deepinfra-stt', 'This selector accepts DeepInfra batch speech-to-text deployments served on the OpenAI-compatible transcription route.')
export const validateSonioxSttModel = createModelValidator(SUPPORTED_SONIOX_STT_MODELS, 'soniox-stt')
export const validateSpeechmaticsSttModel = createRetiringModelValidator('stt', 'speechmatics', SUPPORTED_SPEECHMATICS_STT_MODELS, 'speechmatics-stt')
export const validateGrokSttModel = createModelValidator(SUPPORTED_GROK_STT_MODELS, 'grok-stt')
export const validateMistralSttModel = createModelValidator(SUPPORTED_MISTRAL_STT_MODELS, 'mistral-stt')
export const validateAssemblyaiSttModel = createRetiringModelValidator('stt', 'assemblyai', SUPPORTED_ASSEMBLYAI_STT_MODELS, 'assemblyai-stt')
export const validateGladiaSttModel = createRetiringModelValidator('stt', 'gladia', SUPPORTED_GLADIA_STT_MODELS, 'gladia-stt')
export const validateHappyscribeSttModel = createModelValidator(SUPPORTED_HAPPYSCRIBE_STT_MODELS, 'happyscribe-stt')
export const validateSupadataSttModel = createModelValidator(SUPPORTED_SUPADATA_STT_MODELS, 'supadata-stt')
export const validateScrapeCreatorsSttModel = createModelValidator(SUPPORTED_SCRAPECREATORS_STT_MODELS, 'scrapecreators-stt')
export const validateGeminiSttModel = createRetiringModelValidator('stt', 'gemini-stt', SUPPORTED_GEMINI_STT_MODELS, 'gemini-stt')
export const validateTogetherSttModel = createModelValidator(SUPPORTED_TOGETHER_STT_MODELS, 'together-stt', 'This selector accepts concrete Together serverless batch transcription models.')
export const validateOpenAISttModel = createModelValidator(SUPPORTED_OPENAI_STT_MODELS, 'openai-stt', 'This selector accepts OpenAI batch transcription models on /v1/audio/transcriptions; streaming-only and deprecated transcription identities are excluded.')
