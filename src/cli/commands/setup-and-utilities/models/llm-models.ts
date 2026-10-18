import { createRetiringModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'

export const SUPPORTED_OPENAI_MODELS = [
  'gpt-6.1-sol',
  'gpt-6-luna',
  'gpt-6-astra',
  'gpt-5.6-terra',
] as const satisfies readonly string[]

export const SUPPORTED_GEMINI_MODELS = [
  'gemini-4-argon',
  'gemini-3.8-flash',
] as const satisfies readonly string[]

export const SUPPORTED_ANTHROPIC_MODELS = [
  'claude-opus-5-5',
  'claude-sonnet-5-5',
  'claude-haiku-5-5',
  'claude-fable-5-1',
] as const satisfies readonly string[]

export const SUPPORTED_GROK_MODELS = [
  'grok-4.7'
] as const satisfies readonly string[]

const _validateOpenAI = createRetiringModelValidator('llm', 'openai', SUPPORTED_OPENAI_MODELS, 'openai')
export const validateOpenAIModel = (model: string): string => _validateOpenAI(model)

export const validateGeminiModel = createRetiringModelValidator('llm', 'gemini', SUPPORTED_GEMINI_MODELS, 'gemini')
export const validateAnthropicModel = createRetiringModelValidator('llm', 'anthropic', SUPPORTED_ANTHROPIC_MODELS, 'anthropic')
export const validateGrokModel = createRetiringModelValidator('llm', 'grok', SUPPORTED_GROK_MODELS, 'grok')
