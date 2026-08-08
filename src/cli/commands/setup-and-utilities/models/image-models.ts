import { createModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'
import type { BflImageModel, FalImageModel, GeminiImageModel, GrokImageModel, LumalabsImageModel, OpenAIImageModel, RecraftImageModel, ReplicateImageModel } from '~/types'

export const SUPPORTED_GEMINI_IMAGE_MODELS = [
  'gemini-3.1-flash-lite-image',
  'gemini-3.1-flash-image',
  'gemini-3-pro-image'
] as const satisfies readonly string[]

export const validateGeminiImageModel = createModelValidator<GeminiImageModel>(SUPPORTED_GEMINI_IMAGE_MODELS, 'gemini-image')

export const SUPPORTED_OPENAI_IMAGE_MODELS = [
  'gpt-image-2',
] as const satisfies readonly string[]

export const validateOpenAIImageModel = createModelValidator<OpenAIImageModel>(SUPPORTED_OPENAI_IMAGE_MODELS, 'openai-image')

export const SUPPORTED_GROK_IMAGE_MODELS = [
  'grok-imagine-image-quality',
  'grok-imagine-image'
] as const satisfies readonly string[]

export const validateGrokImageModel = createModelValidator<GrokImageModel>(SUPPORTED_GROK_IMAGE_MODELS, 'grok-image')

export const SUPPORTED_BFL_IMAGE_MODELS = [
  'flux-2-klein-4b',
  'flux-2-klein-9b',
  'flux-2-pro',
  'flux-2-max',
  'flux-2-flex'
] as const satisfies readonly string[]

export const validateBflImageModel = createModelValidator<BflImageModel>(SUPPORTED_BFL_IMAGE_MODELS, 'bfl-image')

export const SUPPORTED_LUMALABS_IMAGE_MODELS = [
  'uni-1',
  'uni-1-max'
] as const satisfies readonly string[]

export const validateLumalabsImageModel = createModelValidator<LumalabsImageModel>(SUPPORTED_LUMALABS_IMAGE_MODELS, 'lumalabs-image')

export const SUPPORTED_RECRAFT_IMAGE_MODELS = [
  'recraftv4_1',
  'recraftv4_1_pro',
  'recraftv4_1_utility',
  'recraftv4_1_utility_pro'
] as const satisfies readonly string[]

export const validateRecraftImageModel = createModelValidator<RecraftImageModel>(SUPPORTED_RECRAFT_IMAGE_MODELS, 'recraft-image')

export const SUPPORTED_REPLICATE_IMAGE_MODELS = [
  'bytedance/seedream-4.5',
  'bytedance/seedream-5-lite',
  'bytedance/seedream-5-pro',
  'ideogram-ai/ideogram-v4-turbo',
  'ideogram-ai/ideogram-v4-balanced',
  'ideogram-ai/ideogram-v4-quality',
  'prunaai/ernie-image',
  'prunaai/ernie-image-turbo',
  'qwen/qwen-image-2-pro',
  'qwen/qwen-image-2',
  'wan-video/wan-2.7-image-pro',
  'wan-video/wan-2.7-image'
] as const satisfies readonly string[]

export const validateReplicateImageModel = createModelValidator<ReplicateImageModel>(SUPPORTED_REPLICATE_IMAGE_MODELS, 'replicate-image')

export const SUPPORTED_FAL_IMAGE_MODELS = [
  'fal-ai/hidream-o1-image',
  'microsoft/mai-image-2.5',
  'microsoft/mai-image-2.5-pro',
  'alibaba/qwen-image-3',
  'reve/2.1'
] as const satisfies readonly string[]

export const validateFalImageModel = createModelValidator<FalImageModel>(SUPPORTED_FAL_IMAGE_MODELS, 'fal-image')
