import { createModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'
import type { FalVideoModel, GeminiVideoModel, GlmVideoModel, GrokVideoModel, LtxVideoModel, LumalabsVideoModel, MinimaxVideoModel, ReplicateVideoModel, RunwayVideoModel } from '~/types'

export const SUPPORTED_GEMINI_VIDEO_MODELS = [
  'veo-3.1-fast-generate-preview',
  'veo-3.1-generate-preview',
  'veo-3.1-lite-generate-preview'
] as const satisfies readonly string[]

export const validateGeminiVideoModel = createModelValidator<GeminiVideoModel>(SUPPORTED_GEMINI_VIDEO_MODELS, 'gemini-video')

export const SUPPORTED_MINIMAX_VIDEO_MODELS = [
  'T2V-01',
  'T2V-01-Director',
  'MiniMax-Hailuo-2.3',
  'MiniMax-Hailuo-2.3-Fast',
  'I2V-01-Director',
  'I2V-01-live',
  'I2V-01',
  'S2V-01'
] as const satisfies readonly string[]

export const validateMinimaxVideoModel = createModelValidator<MinimaxVideoModel>(SUPPORTED_MINIMAX_VIDEO_MODELS, 'minimax-video')

export const SUPPORTED_GLM_VIDEO_MODELS = [
  'cogvideox-3',
  'viduq1-text',
  'vidu2-image',
  'vidu2-start-end',
  'vidu2-reference'
] as const satisfies readonly string[]

export const validateGlmVideoModel = createModelValidator<GlmVideoModel>(SUPPORTED_GLM_VIDEO_MODELS, 'glm-video')

export const SUPPORTED_GROK_VIDEO_MODELS = [
  'grok-imagine-video',
  'grok-imagine-video-1.5'
] as const satisfies readonly string[]

export const validateGrokVideoModel = createModelValidator<GrokVideoModel>(SUPPORTED_GROK_VIDEO_MODELS, 'grok-video')

export const SUPPORTED_RUNWAY_VIDEO_MODELS = [
  'gen4.5'
] as const satisfies readonly string[]

export const validateRunwayVideoModel = createModelValidator<RunwayVideoModel>(SUPPORTED_RUNWAY_VIDEO_MODELS, 'runway-video')

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
  'pixverse/pixverse-v6',
  'runwayml/aleph-2',
  'wan-video/wan-2.7-t2v'
] as const satisfies readonly string[]

export const validateReplicateVideoModel = createModelValidator<ReplicateVideoModel>(SUPPORTED_REPLICATE_VIDEO_MODELS, 'replicate-video')

export const SUPPORTED_LUMALABS_VIDEO_MODELS = [
  'ray-3.2'
] as const satisfies readonly string[]

export const validateLumalabsVideoModel = createModelValidator<LumalabsVideoModel>(SUPPORTED_LUMALABS_VIDEO_MODELS, 'lumalabs-video')

export const SUPPORTED_FAL_VIDEO_MODELS = [
  'minimax/h3',
  'fal-ai/pixverse/c1'
] as const satisfies readonly string[]

export const validateFalVideoModel = createModelValidator<FalVideoModel>(SUPPORTED_FAL_VIDEO_MODELS, 'fal-video')
