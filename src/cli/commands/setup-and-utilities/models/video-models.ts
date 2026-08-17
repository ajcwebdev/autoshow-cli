import { createModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { getRetiredModelReplacement } from '~/cli/commands/setup-and-utilities/models/model-loader/retired-model-rates'
import { throwRetiredModelSelection } from '~/cli/commands/setup-and-utilities/models/model-validation'
import type { FalVideoModel, GeminiVideoModel, GrokVideoModel, LtxVideoModel, LumalabsVideoModel, ReplicateVideoModel } from '~/types'

export const SUPPORTED_GEMINI_VIDEO_MODELS = [
  'veo-3.1-fast-generate-preview',
  'veo-3.1-generate-preview',
  'veo-3.1-lite-generate-preview'
] as const satisfies readonly string[]

export const validateGeminiVideoModel = createModelValidator<GeminiVideoModel>(SUPPORTED_GEMINI_VIDEO_MODELS, 'gemini-video')

export const SUPPORTED_GROK_VIDEO_MODELS = [
  'grok-imagine-video',
  'grok-imagine-video-1.5'
] as const satisfies readonly string[]

export const validateGrokVideoModel = createModelValidator<GrokVideoModel>(SUPPORTED_GROK_VIDEO_MODELS, 'grok-video')

export const SUPPORTED_LTX_VIDEO_MODELS = [
  'ltx-2-3-fast',
  'ltx-2-3-pro'
] as const satisfies readonly string[]

export const validateLtxVideoModel = createModelValidator<LtxVideoModel>(SUPPORTED_LTX_VIDEO_MODELS, 'ltx-video')

export const SUPPORTED_REPLICATE_VIDEO_MODELS = [
  'alibaba/happyhorse-1.1',
  'bytedance/seedance-2.0',
  'bytedance/seedance-2.0-fast',
  'kwaivgi/kling-v3-video',
  'kwaivgi/kling-v3-omni-video',
  'pixverse/pixverse-v6'
] as const satisfies readonly string[]

const validateActiveReplicateVideoModel = createModelValidator<ReplicateVideoModel>(SUPPORTED_REPLICATE_VIDEO_MODELS, 'replicate-video')
export const validateReplicateVideoModel = (model: string): ReplicateVideoModel => {
  const replacement = getRetiredModelReplacement('video', 'replicate', model)
  if (replacement !== undefined) return throwRetiredModelSelection(model, 'replicate-video', replacement)
  return validateActiveReplicateVideoModel(model)
}

export const SUPPORTED_LUMALABS_VIDEO_MODELS = [
  'ray-3.2'
] as const satisfies readonly string[]

export const validateLumalabsVideoModel = createModelValidator<LumalabsVideoModel>(SUPPORTED_LUMALABS_VIDEO_MODELS, 'lumalabs-video')

export const SUPPORTED_FAL_VIDEO_MODELS = [
  'minimax/h3',
  'fal-ai/pixverse/c1'
] as const satisfies readonly string[]

export const validateFalVideoModel = createModelValidator<FalVideoModel>(SUPPORTED_FAL_VIDEO_MODELS, 'fal-video')
