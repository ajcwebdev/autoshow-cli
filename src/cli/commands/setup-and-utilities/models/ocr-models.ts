import { createModelValidator, throwRetiredModelSelection } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { getRetiredModelReplacement } from '~/cli/commands/setup-and-utilities/models/model-loader/retired-model-rates'

export const SUPPORTED_MISTRAL_OCR_MODELS = [
  'mistral-ocr-2512',
  'mistral-ocr-4-0'
] as const satisfies readonly string[]

export const validateMistralOcrModel = createModelValidator(SUPPORTED_MISTRAL_OCR_MODELS, 'mistral-ocr')

export const SUPPORTED_GLM_OCR_MODELS = [
  'glm-ocr'
] as const satisfies readonly string[]

export const validateGlmOcrModel = createModelValidator(SUPPORTED_GLM_OCR_MODELS, 'glm-ocr')

export const SUPPORTED_KIMI_OCR_MODELS = [
  'kimi-k2.6',
  'kimi-k3'
] as const satisfies readonly string[]

export const validateKimiOcrModel = createModelValidator(SUPPORTED_KIMI_OCR_MODELS, 'kimi-ocr')

export const SUPPORTED_OPENAI_OCR_MODELS = [
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
  'gpt-5.5',
  'gpt-5.4-mini',
  'gpt-5.4-nano'
] as const satisfies readonly string[]

export const validateOpenAIOcrModel = createModelValidator(SUPPORTED_OPENAI_OCR_MODELS, 'openai-ocr')

export const SUPPORTED_GROK_OCR_MODELS = [
  'grok-4.3',
  'grok-4.20-0309-non-reasoning',
  'grok-4.5'
] as const satisfies readonly string[]

export const validateGrokOcrModel = createModelValidator(SUPPORTED_GROK_OCR_MODELS, 'grok-ocr')

export const SUPPORTED_ANTHROPIC_OCR_MODELS = [
  'claude-fable-5',
  'claude-opus-4-8',
  'claude-sonnet-5',
  'claude-haiku-4-5',
  'claude-opus-5'
] as const satisfies readonly string[]

export const validateAnthropicOcrModel = createModelValidator(SUPPORTED_ANTHROPIC_OCR_MODELS, 'anthropic-ocr')

export const SUPPORTED_GEMINI_OCR_MODELS = [
  'gemini-3.1-pro-preview',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite'
] as const satisfies readonly string[]

const validateActiveGeminiOcrModel = createModelValidator(SUPPORTED_GEMINI_OCR_MODELS, 'gemini-ocr')
export const validateGeminiOcrModel = (model: string): typeof SUPPORTED_GEMINI_OCR_MODELS[number] => {
  const replacement = getRetiredModelReplacement('extract', 'gemini', model)
  if (replacement !== undefined) {
    return throwRetiredModelSelection(model, 'gemini-ocr', replacement)
  }
  return validateActiveGeminiOcrModel(model)
}

export const DEFAULT_DEEPINFRA_OCR_MODEL = 'Qwen/Qwen3-VL-30B-A3B-Instruct'

export const SUPPORTED_DEEPINFRA_OCR_MODELS = [
  'google/gemma-3-27b-it',
  'meta-llama/Llama-4-Scout-17B-16E-Instruct',
  'mistralai/Mistral-Small-3.2-24B-Instruct-2506',
  'Qwen/Qwen3-VL-235B-A22B-Instruct',
  DEFAULT_DEEPINFRA_OCR_MODEL
] as const satisfies readonly string[]

export const validateDeepinfraOcrModel = createModelValidator(SUPPORTED_DEEPINFRA_OCR_MODELS, 'deepinfra-ocr')

export const SUPPORTED_REPLICATE_OCR_MODELS = [
  'datalab-to/ocr',
  'datalab-to/marker',
  'lucataco/deepseek-ocr'
] as const satisfies readonly string[]

export const validateReplicateOcrModel = createModelValidator(SUPPORTED_REPLICATE_OCR_MODELS, 'replicate-ocr')

export const SUPPORTED_FAL_OCR_MODELS = [
  'fal-ai/got-ocr/v2',
  'fal-ai/florence-2-large/ocr'
] as const satisfies readonly string[]

export const validateFalOcrModel = createModelValidator(SUPPORTED_FAL_OCR_MODELS, 'fal-ocr')
