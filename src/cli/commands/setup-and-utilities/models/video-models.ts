import { createRetiringModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'
import type { FalVideoModel, GeminiVideoModel, GrokVideoModel } from '~/types'

export const SUPPORTED_GEMINI_VIDEO_MODELS = [
  'gemini-omni-1.1-flash'
] as const satisfies readonly string[]

export const validateGeminiVideoModel = createRetiringModelValidator<GeminiVideoModel>('video', 'gemini', SUPPORTED_GEMINI_VIDEO_MODELS, 'gemini-video')

export const SUPPORTED_GROK_VIDEO_MODELS = [
  'grok-imagine-video-1.5'
] as const satisfies readonly string[]

export const validateGrokVideoModel = createRetiringModelValidator<GrokVideoModel>('video', 'grok', SUPPORTED_GROK_VIDEO_MODELS, 'grok-video')

export const SUPPORTED_FAL_VIDEO_MODELS = [
  'bytedance/seedance-2.5/text-to-video',
  'bytedance/seedance-2.5/image-to-video',
  'bytedance/seedance-2.5/reference-to-video',
  'minimax/h3-max/text-to-video',
  'minimax/h3-max/image-to-video',
  'minimax/h3-max-turbo/text-to-video',
  'minimax/h3-max-turbo/image-to-video',
  'minimax/h3'
] as const satisfies readonly string[]

export const validateFalVideoModel = createRetiringModelValidator<FalVideoModel>('video', 'fal', SUPPORTED_FAL_VIDEO_MODELS, 'fal-video')
