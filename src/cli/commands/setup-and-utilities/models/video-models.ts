import { createRetiringModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'
import type { GeminiVideoModel, GrokVideoModel } from '~/types'

export const SUPPORTED_GEMINI_VIDEO_MODELS = [
  'gemini-omni-1.1-flash'
] as const satisfies readonly string[]

export const validateGeminiVideoModel = createRetiringModelValidator<GeminiVideoModel>('video', 'gemini', SUPPORTED_GEMINI_VIDEO_MODELS, 'gemini-video')

export const SUPPORTED_GROK_VIDEO_MODELS = [
  'grok-imagine-video-1.5'
] as const satisfies readonly string[]

export const validateGrokVideoModel = createRetiringModelValidator<GrokVideoModel>('video', 'grok', SUPPORTED_GROK_VIDEO_MODELS, 'grok-video')
