import { createModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { createRetiringModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'

export const SUPPORTED_MISTRAL_OCR_MODELS = [
  'mistral-ocr-4-0',
  'mistral-ocr-4-1'
] as const satisfies readonly string[]

export const validateMistralOcrModel = createModelValidator(SUPPORTED_MISTRAL_OCR_MODELS, 'mistral-ocr')

export const SUPPORTED_GLM_OCR_MODELS = [
  'glm-5.3-flash'
] as const satisfies readonly string[]

export const validateGlmOcrModel = createModelValidator(SUPPORTED_GLM_OCR_MODELS, 'glm-ocr')

export const SUPPORTED_KIMI_OCR_MODELS = [
  'kimi-k2.6',
  'kimi-k3'
] as const satisfies readonly string[]

export const validateKimiOcrModel = createModelValidator(SUPPORTED_KIMI_OCR_MODELS, 'kimi-ocr')

export const SUPPORTED_OPENAI_OCR_MODELS = [
  'gpt-6-astra',
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
] as const satisfies readonly string[]

export const validateOpenAIOcrModel = createModelValidator(SUPPORTED_OPENAI_OCR_MODELS, 'openai-ocr')

export const SUPPORTED_GROK_OCR_MODELS = [
  'grok-4.5',
  'grok-4.6'
] as const satisfies readonly string[]

export const validateGrokOcrModel = createModelValidator(SUPPORTED_GROK_OCR_MODELS, 'grok-ocr')

export const SUPPORTED_ANTHROPIC_OCR_MODELS = [
  'claude-fable-5-1',
  'claude-fable-5',
  'claude-sonnet-5',
  'claude-opus-5'
] as const satisfies readonly string[]

export const validateAnthropicOcrModel = createModelValidator(SUPPORTED_ANTHROPIC_OCR_MODELS, 'anthropic-ocr')

export const SUPPORTED_GEMINI_OCR_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite'
] as const satisfies readonly string[]

export const validateGeminiOcrModel = createRetiringModelValidator('extract', 'gemini', SUPPORTED_GEMINI_OCR_MODELS, 'gemini-ocr')

export const DEFAULT_DEEPINFRA_OCR_MODEL = 'google/gemma-4-31B-it'

export const SUPPORTED_DEEPINFRA_OCR_MODELS = [
  DEFAULT_DEEPINFRA_OCR_MODEL,
  'Qwen/Qwen3.8-27B',
  'deepseek-ai/DeepSeek-V4.1-Flash'
] as const satisfies readonly string[]

export const validateDeepinfraOcrModel = createModelValidator(SUPPORTED_DEEPINFRA_OCR_MODELS, 'deepinfra-ocr')
