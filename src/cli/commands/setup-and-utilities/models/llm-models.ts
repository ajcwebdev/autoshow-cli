import { createModelValidator, throwRetiredModelSelection } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { getRetiredModelReplacement } from '~/cli/commands/setup-and-utilities/models/model-loader/retired-model-rates'
import type { GroqModel } from '~/types'

export const SUPPORTED_OPENAI_MODELS = [
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
  'gpt-5.5',
  'gpt-5.4-mini',
  'gpt-5.4-nano'
] as const satisfies readonly string[]

export const SUPPORTED_GROQ_MODELS = [
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b'
] as const satisfies readonly string[]

export const SUPPORTED_GEMINI_MODELS = [
  'gemini-3.1-pro-preview',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
] as const satisfies readonly string[]

export const SUPPORTED_ANTHROPIC_MODELS = [
  'claude-fable-5',
  'claude-opus-4-8',
  'claude-sonnet-5',
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
  'claude-opus-5',
] as const satisfies readonly string[]

export const SUPPORTED_MINIMAX_MODELS = [
  'MiniMax-M3'
] as const satisfies readonly string[]

export const SUPPORTED_GROK_MODELS = [
  'grok-4.3',
  'grok-4.5'
] as const satisfies readonly string[]

export const SUPPORTED_GLM_MODELS = [
  'glm-5.1'
] as const satisfies readonly string[]

export const SUPPORTED_KIMI_MODELS = [
  'kimi-k2.6',
  'kimi-k3'
] as const satisfies readonly string[]

export const SUPPORTED_TOGETHER_MODELS = [
  'kimi-k2.6',
  'glm-5.1'
] as const satisfies readonly string[]

export const SUPPORTED_CEREBRAS_MODELS = [
  'gpt-oss-120b',
  'zai-glm-4.7'
] as const satisfies readonly string[]

const _validateOpenAI = createModelValidator(SUPPORTED_OPENAI_MODELS, 'openai')
export const validateOpenAIModel = (model: string): string => _validateOpenAI(model)

const _validateGroqRaw = createModelValidator<GroqModel>(SUPPORTED_GROQ_MODELS, 'groq')
export const validateGroqModel = (model: string): GroqModel => _validateGroqRaw(model)

const validateActiveGeminiModel = createModelValidator(SUPPORTED_GEMINI_MODELS, 'gemini')
export const validateGeminiModel = (model: string): typeof SUPPORTED_GEMINI_MODELS[number] => {
  const replacement = getRetiredModelReplacement('llm', 'gemini', model)
  if (replacement !== undefined) {
    return throwRetiredModelSelection(model, 'gemini', replacement)
  }
  return validateActiveGeminiModel(model)
}
export const validateAnthropicModel = createModelValidator(SUPPORTED_ANTHROPIC_MODELS, 'anthropic')
export const validateMinimaxModel = createModelValidator(SUPPORTED_MINIMAX_MODELS, 'minimax')
export const validateGrokModel = createModelValidator(SUPPORTED_GROK_MODELS, 'grok')
export const validateGlmModel = createModelValidator(SUPPORTED_GLM_MODELS, 'glm')
export const validateKimiModel = createModelValidator(SUPPORTED_KIMI_MODELS, 'kimi')
export const validateTogetherModel = createModelValidator(SUPPORTED_TOGETHER_MODELS, 'together')
export const validateCerebrasModel = createModelValidator(SUPPORTED_CEREBRAS_MODELS, 'cerebras')
