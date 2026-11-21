import type { GeminiImageModel, GrokImageModel, OpenAIImageModel } from '~/types'
import { createRetiringModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'

export const SUPPORTED_GEMINI_IMAGE_MODELS = [
  'gemini-nano-banana-2.1'
] as const satisfies readonly string[]

export const validateGeminiImageModel = createRetiringModelValidator<GeminiImageModel>('image', 'gemini', SUPPORTED_GEMINI_IMAGE_MODELS, 'gemini-image')

export const SUPPORTED_OPENAI_IMAGE_MODELS = [
  'gpt-image-2.6-flare',
  'gpt-image-2.6-sunburst',
] as const satisfies readonly string[]

// Retired GPT Image 2.5 IDs stay on the shared calculator so finished runs keep their historical estimates.
const OPENAI_IMAGE_25_MODELS = new Set(['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst'])

export const isOpenAIImage26Model = (model: string): boolean =>
  model === 'gpt-image-2.6-flare' || model === 'gpt-image-2.6-sunburst'

// GPT Image 2.5 and 2.6 share the calculator grid, xhigh and max quality, and custom WIDTHxHEIGHT sizes.
export const usesOpenAIImageTokenCalculator = (model: string): boolean =>
  isOpenAIImage26Model(model) || OPENAI_IMAGE_25_MODELS.has(model)

export const supportsOpenAIExtendedImageQuality = usesOpenAIImageTokenCalculator

export const supportsOpenAIFlexibleImageSize = usesOpenAIImageTokenCalculator

export const validateOpenAIImageModel = createRetiringModelValidator<OpenAIImageModel>('image', 'openai', SUPPORTED_OPENAI_IMAGE_MODELS, 'openai-image')

export const SUPPORTED_GROK_IMAGE_MODELS = [
  'grok-imagine-image-2.0'
] as const satisfies readonly string[]

export const validateGrokImageModel = createRetiringModelValidator<GrokImageModel>('image', 'grok', SUPPORTED_GROK_IMAGE_MODELS, 'grok-image')
