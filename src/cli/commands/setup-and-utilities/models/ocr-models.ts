import { createModelValidator, createRetiringModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'

export const SUPPORTED_MISTRAL_OCR_MODELS = [
  'mistral-ocr-4-1'
] as const satisfies readonly string[]

export const validateMistralOcrModel = createModelValidator(SUPPORTED_MISTRAL_OCR_MODELS, 'mistral-ocr')

export const SUPPORTED_OPENAI_OCR_MODELS = [
  'gpt-6.1-sol',
  'gpt-6-luna'
] as const satisfies readonly string[]

export const validateOpenAIOcrModel = createRetiringModelValidator('extract', 'openai', SUPPORTED_OPENAI_OCR_MODELS, 'openai-ocr')

export const SUPPORTED_GROK_OCR_MODELS = [
  'grok-4.7'
] as const satisfies readonly string[]

export const validateGrokOcrModel = createRetiringModelValidator('extract', 'grok', SUPPORTED_GROK_OCR_MODELS, 'grok-ocr')

export const SUPPORTED_ANTHROPIC_OCR_MODELS = [
  'claude-opus-5-5',
  'claude-sonnet-5-5',
  'claude-haiku-5-5',
  'claude-fable-5'
] as const satisfies readonly string[]

export const validateAnthropicOcrModel = createRetiringModelValidator('extract', 'anthropic', SUPPORTED_ANTHROPIC_OCR_MODELS, 'anthropic-ocr')

export const SUPPORTED_GEMINI_OCR_MODELS = [
  'gemini-3.8-flash'
] as const satisfies readonly string[]

export const validateGeminiOcrModel = createRetiringModelValidator('extract', 'gemini', SUPPORTED_GEMINI_OCR_MODELS, 'gemini-ocr')
