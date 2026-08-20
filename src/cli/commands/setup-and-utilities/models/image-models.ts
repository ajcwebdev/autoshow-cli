import type { BflImageModel, FalImageModel, GeminiImageModel, GrokImageModel, LumalabsImageModel, OpenAIImageModel, ReplicateImageModel } from '~/types'
import { createRetiringModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'

export const SUPPORTED_GEMINI_IMAGE_MODELS = [
  'gemini-3.1-flash-lite-image',
  'gemini-3.1-flash-image',
  'gemini-3-pro-image'
] as const satisfies readonly string[]

export const validateGeminiImageModel = createRetiringModelValidator<GeminiImageModel>('image', 'gemini', SUPPORTED_GEMINI_IMAGE_MODELS, 'gemini-image')

export const SUPPORTED_OPENAI_IMAGE_MODELS = [
  'gpt-image-2',
] as const satisfies readonly string[]

export const validateOpenAIImageModel = createRetiringModelValidator<OpenAIImageModel>('image', 'openai', SUPPORTED_OPENAI_IMAGE_MODELS, 'openai-image')

export const SUPPORTED_GROK_IMAGE_MODELS = [
  'grok-imagine-image-quality'
] as const satisfies readonly string[]

export const validateGrokImageModel = createRetiringModelValidator<GrokImageModel>('image', 'grok', SUPPORTED_GROK_IMAGE_MODELS, 'grok-image')

export const SUPPORTED_BFL_IMAGE_MODELS = [
  'flux-2-klein-4b',
  'flux-2-klein-9b',
  'flux-2-pro',
  'flux-2-max',
  'flux-2-flex'
] as const satisfies readonly string[]

export const validateBflImageModel = createRetiringModelValidator<BflImageModel>('image', 'bfl', SUPPORTED_BFL_IMAGE_MODELS, 'bfl-image')

export const SUPPORTED_LUMALABS_IMAGE_MODELS = [
  'uni-1',
  'uni-1-max'
] as const satisfies readonly string[]

export const validateLumalabsImageModel = createRetiringModelValidator<LumalabsImageModel>('image', 'lumalabs', SUPPORTED_LUMALABS_IMAGE_MODELS, 'lumalabs-image')

export const SUPPORTED_REPLICATE_IMAGE_MODELS = [
  'bytedance/seedream-4.5',
  'bytedance/seedream-5-lite',
  'bytedance/seedream-5-pro',
  'qwen/qwen-image-2-pro',
  'qwen/qwen-image-2',
  'wan-video/wan-2.7-image-pro',
  'wan-video/wan-2.7-image'
] as const satisfies readonly string[]

export const validateReplicateImageModel = createRetiringModelValidator<ReplicateImageModel>('image', 'replicate', SUPPORTED_REPLICATE_IMAGE_MODELS, 'replicate-image')

export const SUPPORTED_FAL_IMAGE_MODELS = [
  'fal-ai/hidream-o1-image',
  'alibaba/qwen-image-3',
  'reve/2.1'
] as const satisfies readonly string[]

export const validateFalImageModel = createRetiringModelValidator<FalImageModel>('image', 'fal', SUPPORTED_FAL_IMAGE_MODELS, 'fal-image')
