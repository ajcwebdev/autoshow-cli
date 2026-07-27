import { createModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { isNativeGeminiImage } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { BflImageModel, GeminiImageModel, GrokImageModel, LumalabsImageModel, OpenAIImageModel, RecraftImageModel, ReplicateImageModel, ReveImageModel } from '~/types'

export const SUPPORTED_GEMINI_IMAGE_MODELS = [
  'gemini-3.1-flash-image-preview'
] as const satisfies readonly string[]

export const validateGeminiImageModel = createModelValidator<GeminiImageModel>(SUPPORTED_GEMINI_IMAGE_MODELS, 'gemini-image')

const isNativeGeminiImageModel = (model: GeminiImageModel): boolean =>
  isNativeGeminiImage(model)

export const supportsGeminiImageSize = (model: GeminiImageModel): boolean =>
  isNativeGeminiImageModel(model)

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
  'flux-2-pro',
  'flux-2-max',
  'flux-2-flex'
] as const satisfies readonly string[]

export const validateBflImageModel = createModelValidator<BflImageModel>(SUPPORTED_BFL_IMAGE_MODELS, 'bfl-image')

export const SUPPORTED_REVE_IMAGE_MODELS = [
  'latest',
  'reve-create@20250915'
] as const satisfies readonly string[]

export const validateReveImageModel = createModelValidator<ReveImageModel>(SUPPORTED_REVE_IMAGE_MODELS, 'reve-image')

export const SUPPORTED_LUMALABS_IMAGE_MODELS = [
  'uni-1',
  'uni-1-max'
] as const satisfies readonly string[]

export const validateLumalabsImageModel = createModelValidator<LumalabsImageModel>(SUPPORTED_LUMALABS_IMAGE_MODELS, 'lumalabs-image')

export const SUPPORTED_RECRAFT_IMAGE_MODELS = [
  'recraftv4_1',
  'recraftv4_1_vector',
  'recraftv4_1_pro',
  'recraftv4_1_pro_vector',
  'recraftv4_1_utility',
  'recraftv4_1_utility_vector',
  'recraftv4_1_utility_pro',
  'recraftv4_1_utility_pro_vector'
] as const satisfies readonly string[]

export const validateRecraftImageModel = createModelValidator<RecraftImageModel>(SUPPORTED_RECRAFT_IMAGE_MODELS, 'recraft-image')

export const SUPPORTED_REPLICATE_IMAGE_MODELS = [
  'bytedance/seedream-4.5',
  'bytedance/seedream-5-lite',
  'qwen/qwen-image-2-pro',
  'qwen/qwen-image-2',
  'wan-video/wan-2.7-image-pro',
  'wan-video/wan-2.7-image'
] as const satisfies readonly string[]

export const validateReplicateImageModel = createModelValidator<ReplicateImageModel>(SUPPORTED_REPLICATE_IMAGE_MODELS, 'replicate-image')
