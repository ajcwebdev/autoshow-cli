import type { FalImageModel, GeminiImageModel, GrokImageModel, LumalabsImageModel, OpenAIImageModel, ReplicateImageModel } from '~/types'
import { createRetiringModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'

export const SUPPORTED_GEMINI_IMAGE_MODELS = [
  'gemini-3.1-flash-lite-image'
] as const satisfies readonly string[]

export const validateGeminiImageModel = createRetiringModelValidator<GeminiImageModel>('image', 'gemini', SUPPORTED_GEMINI_IMAGE_MODELS, 'gemini-image')

export const SUPPORTED_OPENAI_IMAGE_MODELS = [
  'gpt-image-2',
  'gpt-image-2.5-flare',
  'gpt-image-2.5-sunburst',
] as const satisfies readonly string[]

export const isOpenAIImage25Model = (model: string): boolean =>
  model === 'gpt-image-2.5-flare' || model === 'gpt-image-2.5-sunburst'

export const supportsOpenAIFlexibleImageSize = (model: string): boolean =>
  model === 'gpt-image-2' || isOpenAIImage25Model(model)

export const validateOpenAIImageModel = createRetiringModelValidator<OpenAIImageModel>('image', 'openai', SUPPORTED_OPENAI_IMAGE_MODELS, 'openai-image')

export const SUPPORTED_GROK_IMAGE_MODELS = [
  'grok-imagine-image-2.0'
] as const satisfies readonly string[]

export const validateGrokImageModel = createRetiringModelValidator<GrokImageModel>('image', 'grok', SUPPORTED_GROK_IMAGE_MODELS, 'grok-image')

export const SUPPORTED_LUMALABS_IMAGE_MODELS = [
  'uni-1',
  'uni-1-max'
] as const satisfies readonly string[]

export const validateLumalabsImageModel = createRetiringModelValidator<LumalabsImageModel>('image', 'lumalabs', SUPPORTED_LUMALABS_IMAGE_MODELS, 'lumalabs-image')

export const SUPPORTED_REPLICATE_IMAGE_MODELS = [
  'bytedance/seedream-5-lite',
  'bytedance/seedream-5-pro',
  'alibaba/qwen-image-3',
  'alibaba/qwen-image-3-pro'
] as const satisfies readonly string[]

export const validateReplicateImageModel = createRetiringModelValidator<ReplicateImageModel>('image', 'replicate', SUPPORTED_REPLICATE_IMAGE_MODELS, 'replicate-image')

export const SUPPORTED_FAL_IMAGE_MODELS = [
  'fal-ai/hidream-o1-image',
  'alibaba/qwen-image-3'
] as const satisfies readonly string[]

export const validateFalImageModel = createRetiringModelValidator<FalImageModel>('image', 'fal', SUPPORTED_FAL_IMAGE_MODELS, 'fal-image')
