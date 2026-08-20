import { createModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'
import type { ElevenlabsMusicModel, GeminiMusicModel, MinimaxMusicModel } from '~/types'
import { createRetiringModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'

export const SUPPORTED_ELEVENLABS_MUSIC_MODELS = [
  'music_v2'
] as const satisfies readonly string[]

export const validateElevenlabsMusicModel = createRetiringModelValidator<ElevenlabsMusicModel>('music', 'elevenlabs', SUPPORTED_ELEVENLABS_MUSIC_MODELS, 'elevenlabs-music')

export const SUPPORTED_MINIMAX_MUSIC_MODELS = [
  'music-3.0'
] as const satisfies readonly string[]

export const validateMinimaxMusicModel = createModelValidator<MinimaxMusicModel>(SUPPORTED_MINIMAX_MUSIC_MODELS, 'minimax-music')

export const MINIMAX_INSTRUMENTAL_MUSIC_MODELS = [
  'music-3.0'
] as const satisfies readonly string[]

export const isMinimaxInstrumentalMusicModel = (
  model: string
): model is typeof MINIMAX_INSTRUMENTAL_MUSIC_MODELS[number] =>
  (MINIMAX_INSTRUMENTAL_MUSIC_MODELS as readonly string[]).includes(model)

export const SUPPORTED_GEMINI_MUSIC_MODELS = [
  'lyria-3-pro-preview'
] as const satisfies readonly string[]

export const validateGeminiMusicModel = createRetiringModelValidator<GeminiMusicModel>('music', 'gemini', SUPPORTED_GEMINI_MUSIC_MODELS, 'gemini-music')
