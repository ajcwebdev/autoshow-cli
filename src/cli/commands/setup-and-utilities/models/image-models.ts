import type { GeminiImageModel, GrokImageModel, OpenAIImageModel } from '~/types'
import { createRetiringModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'

export const SUPPORTED_GEMINI_IMAGE_MODELS = [
  'gemini-3.1-flash-lite-image'
] as const satisfies readonly string[]

export const validateGeminiImageModel = createRetiringModelValidator<GeminiImageModel>('image', 'gemini', SUPPORTED_GEMINI_IMAGE_MODELS, 'gemini-image')

export const SUPPORTED_OPENAI_IMAGE_MODELS = [
  'gpt-image-2.5-flare',
  'gpt-image-2.5-sunburst',
] as const satisfies readonly string[]

export const isOpenAIImage25Model = (model: string): boolean =>
  model === 'gpt-image-2.5-flare' || model === 'gpt-image-2.5-sunburst'

export const supportsOpenAIFlexibleImageSize = (model: string): boolean =>
  isOpenAIImage25Model(model)

export const validateOpenAIImageModel = createRetiringModelValidator<OpenAIImageModel>('image', 'openai', SUPPORTED_OPENAI_IMAGE_MODELS, 'openai-image')

export const SUPPORTED_GROK_IMAGE_MODELS = [
  'grok-imagine-image-2.0'
] as const satisfies readonly string[]

export const validateGrokImageModel = createRetiringModelValidator<GrokImageModel>('image', 'grok', SUPPORTED_GROK_IMAGE_MODELS, 'grok-image')
