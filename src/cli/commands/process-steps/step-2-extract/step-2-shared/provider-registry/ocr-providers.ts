import {
  SUPPORTED_MISTRAL_OCR_MODELS,
  SUPPORTED_GLM_OCR_MODELS,
  SUPPORTED_KIMI_OCR_MODELS,
  SUPPORTED_OPENAI_OCR_MODELS,
  SUPPORTED_GROK_OCR_MODELS,
  SUPPORTED_ANTHROPIC_OCR_MODELS,
  SUPPORTED_GEMINI_OCR_MODELS,
  SUPPORTED_DEEPINFRA_OCR_MODELS,
  validateMistralOcrModel,
  validateGlmOcrModel,
  validateKimiOcrModel,
  validateOpenAIOcrModel,
  validateGrokOcrModel,
  validateAnthropicOcrModel,
  validateGeminiOcrModel,
  validateDeepinfraOcrModel
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { buildModelDescription } from '~/cli/commands/setup-and-utilities/models/model-validation'
import type { Step2ProviderRegistryEntry } from '~/types'
import { booleanProvider, ocrModelProvider } from './entry-builders'

export const STEP2_OCR_PROVIDER_REGISTRY = [
  booleanProvider({
    step: 'ocr',
    modality: 'document',
    flagName: 'tesseract-ocr',
    targetService: 'tesseract',
    providerSpecProvider: 'tesseract',
    bootstrapProviderId: 'tesseract',
    configKey: 'tesseract',
    allShortcut: 'all-local-ocr',
    runtimeKey: 'useTesseract',
    model: 'tesseract',
    description: 'Use Tesseract OCR (default local OCR engine for PDF/image; forces OCR mode for EPUB and office documents)'
  }),
  ocrModelProvider('mistral', 'mistralOcr', {
    supportedModels: SUPPORTED_MISTRAL_OCR_MODELS,
    validateModel: validateMistralOcrModel,
    description: buildModelDescription('Mistral OCR model', SUPPORTED_MISTRAL_OCR_MODELS)
  }),
  ocrModelProvider('glm', 'glmOcr', {
    supportedModels: SUPPORTED_GLM_OCR_MODELS,
    validateModel: validateGlmOcrModel,
    description: buildModelDescription('GLM OCR model', SUPPORTED_GLM_OCR_MODELS)
  }),
  ocrModelProvider('kimi', 'kimiOcr', {
    supportedModels: SUPPORTED_KIMI_OCR_MODELS,
    validateModel: validateKimiOcrModel,
    description: buildModelDescription('Kimi OCR model', SUPPORTED_KIMI_OCR_MODELS)
  }),
  ocrModelProvider('openai', 'openaiOcr', {
    supportedModels: SUPPORTED_OPENAI_OCR_MODELS,
    validateModel: validateOpenAIOcrModel,
    description: buildModelDescription('OpenAI OCR model', SUPPORTED_OPENAI_OCR_MODELS)
  }),
  ocrModelProvider('grok', 'grokOcr', {
    supportedModels: SUPPORTED_GROK_OCR_MODELS,
    validateModel: validateGrokOcrModel,
    description: buildModelDescription('Grok OCR model', SUPPORTED_GROK_OCR_MODELS)
  }),
  ocrModelProvider('anthropic', 'anthropicOcr', {
    supportedModels: SUPPORTED_ANTHROPIC_OCR_MODELS,
    validateModel: validateAnthropicOcrModel,
    description: buildModelDescription('Anthropic OCR model', SUPPORTED_ANTHROPIC_OCR_MODELS)
  }),
  ocrModelProvider('gemini', 'geminiOcr', {
    supportedModels: SUPPORTED_GEMINI_OCR_MODELS,
    validateModel: validateGeminiOcrModel,
    description: buildModelDescription('Gemini OCR model', SUPPORTED_GEMINI_OCR_MODELS)
  }),
  ocrModelProvider('deepinfra', 'deepinfraOcr', {
    supportedModels: SUPPORTED_DEEPINFRA_OCR_MODELS,
    validateModel: validateDeepinfraOcrModel,
    description: buildModelDescription('DeepInfra OCR model', SUPPORTED_DEEPINFRA_OCR_MODELS)
  })
] as const satisfies readonly Step2ProviderRegistryEntry[]
