import {
  SUPPORTED_WHISPER_MODELS,
  SUPPORTED_WHISPERFILE_MODELS,
  SUPPORTED_DEEPINFRA_STT_MODELS,
  SUPPORTED_DEEPGRAM_STT_MODELS,
  SUPPORTED_SONIOX_STT_MODELS,
  SUPPORTED_SPEECHMATICS_STT_MODELS,
  SUPPORTED_GROQ_STT_MODELS,
  SUPPORTED_GROK_STT_MODELS,
  SUPPORTED_MISTRAL_STT_MODELS,
  SUPPORTED_ASSEMBLYAI_STT_MODELS,
  SUPPORTED_GLADIA_STT_MODELS,
  SUPPORTED_HAPPYSCRIBE_STT_MODELS,
  SUPPORTED_SUPADATA_STT_MODELS,
  SUPPORTED_SCRAPECREATORS_STT_MODELS,
  SUPPORTED_GEMINI_STT_MODELS,
  SUPPORTED_TOGETHER_STT_MODELS,
  validateWhisperModel,
  validateWhisperfileModel,
  validateDeepinfraSttModel,
  validateDeepgramSttModel,
  validateSonioxSttModel,
  validateSpeechmaticsSttModel,
  validateGroqSttModel,
  validateGrokSttModel,
  validateMistralSttModel,
  validateAssemblyaiSttModel,
  validateGladiaSttModel,
  validateHappyscribeSttModel,
  validateSupadataSttModel,
  validateScrapeCreatorsSttModel,
  validateGeminiSttModel,
  validateTogetherSttModel
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { buildModelDescription } from '~/cli/commands/setup-and-utilities/models/model-validation'
import type { Step2ProviderRegistryEntry } from '~/types'
import { sttModelProvider } from './entry-builders'

export const STEP2_STT_PROVIDER_REGISTRY = [
  sttModelProvider('deepinfra', 'deepinfraStt', {
    supportedModels: SUPPORTED_DEEPINFRA_STT_MODELS,
    validateModel: validateDeepinfraSttModel,
    description: buildModelDescription('DeepInfra Whisper STT model (API, billed)', SUPPORTED_DEEPINFRA_STT_MODELS)
  }),
  sttModelProvider('deepgram', 'deepgramStt', {
    supportedModels: SUPPORTED_DEEPGRAM_STT_MODELS,
    validateModel: validateDeepgramSttModel,
    description: buildModelDescription('Deepgram STT model', SUPPORTED_DEEPGRAM_STT_MODELS)
  }),
  sttModelProvider('soniox', 'sonioxStt', {
    supportedModels: SUPPORTED_SONIOX_STT_MODELS,
    validateModel: validateSonioxSttModel,
    description: buildModelDescription('Soniox STT model', SUPPORTED_SONIOX_STT_MODELS)
  }),
  sttModelProvider('speechmatics', 'speechmaticsStt', {
    supportedModels: SUPPORTED_SPEECHMATICS_STT_MODELS,
    validateModel: validateSpeechmaticsSttModel,
    description: buildModelDescription('Speechmatics STT model', SUPPORTED_SPEECHMATICS_STT_MODELS)
  }),
  sttModelProvider('groq', 'groqStt', {
    supportedModels: SUPPORTED_GROQ_STT_MODELS,
    validateModel: validateGroqSttModel,
    description: buildModelDescription('Groq Whisper STT model (API, billed)', SUPPORTED_GROQ_STT_MODELS)
  }),
  sttModelProvider('grok', 'grokStt', {
    supportedModels: SUPPORTED_GROK_STT_MODELS,
    validateModel: validateGrokSttModel,
    description: buildModelDescription('xAI Grok STT model', SUPPORTED_GROK_STT_MODELS)
  }),
  sttModelProvider('mistral', 'mistralStt', {
    supportedModels: SUPPORTED_MISTRAL_STT_MODELS,
    validateModel: validateMistralSttModel,
    description: buildModelDescription('Mistral STT model', SUPPORTED_MISTRAL_STT_MODELS)
  }),
  sttModelProvider('assemblyai', 'assemblyaiStt', {
    supportedModels: SUPPORTED_ASSEMBLYAI_STT_MODELS,
    validateModel: validateAssemblyaiSttModel,
    description: buildModelDescription('AssemblyAI STT model', SUPPORTED_ASSEMBLYAI_STT_MODELS)
  }),
  sttModelProvider('gladia', 'gladiaStt', {
    supportedModels: SUPPORTED_GLADIA_STT_MODELS,
    validateModel: validateGladiaSttModel,
    description: buildModelDescription('Gladia STT model', SUPPORTED_GLADIA_STT_MODELS)
  }),
  sttModelProvider('happyscribe', 'happyscribeStt', {
    supportedModels: SUPPORTED_HAPPYSCRIBE_STT_MODELS,
    validateModel: validateHappyscribeSttModel,
    description: buildModelDescription('Happy Scribe automatic STT model (fixed en-US only)', SUPPORTED_HAPPYSCRIBE_STT_MODELS)
  }),
  sttModelProvider('supadata', 'supadataStt', {
    supportedModels: SUPPORTED_SUPADATA_STT_MODELS,
    validateModel: validateSupadataSttModel,
    description: buildModelDescription('Supadata STT mode', SUPPORTED_SUPADATA_STT_MODELS)
  }),
  sttModelProvider('scrapecreators', 'scrapecreatorsStt', {
    allShortcut: false,
    supportedModels: SUPPORTED_SCRAPECREATORS_STT_MODELS,
    validateModel: validateScrapeCreatorsSttModel,
    description: buildModelDescription('ScrapeCreators YouTube transcript retrieval mode', SUPPORTED_SCRAPECREATORS_STT_MODELS)
  }),
  sttModelProvider('gemini', 'geminiStt', {
    targetService: 'gemini-stt',
    providerSpecProvider: 'gemini-stt',
    supportedModels: SUPPORTED_GEMINI_STT_MODELS,
    validateModel: validateGeminiSttModel,
    description: buildModelDescription('Gemini STT model', SUPPORTED_GEMINI_STT_MODELS)
  }),
  sttModelProvider('together', 'togetherStt', {
    supportedModels: SUPPORTED_TOGETHER_STT_MODELS,
    validateModel: validateTogetherSttModel,
    description: buildModelDescription('Together batch STT model (API, billed)', SUPPORTED_TOGETHER_STT_MODELS)
  }),
  sttModelProvider('whisper', 'whisper', {
    bootstrapProviderId: 'whisper',
    allShortcut: 'all-local-stt',
    supportedModels: SUPPORTED_WHISPER_MODELS,
    validateModel: validateWhisperModel,
    description: 'Local whisper.cpp model (free): tiny|base|small|medium|large-v3-turbo'
  }),
  sttModelProvider('whisperfile', 'whisperfile', {
    bootstrapProviderId: 'whisperfile',
    allShortcut: 'all-local-stt',
    supportedModels: SUPPORTED_WHISPERFILE_MODELS,
    validateModel: validateWhisperfileModel,
    description: 'Local whisperfile model (free): tiny|tiny.en|small|small.en|medium|medium.en|large-v2|large-v3'
  })
] as const satisfies readonly Step2ProviderRegistryEntry[]
