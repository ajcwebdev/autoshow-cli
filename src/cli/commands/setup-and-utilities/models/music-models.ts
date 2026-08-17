import { createModelValidator, throwRetiredModelSelection } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { getRetiredModelReplacement } from '~/cli/commands/setup-and-utilities/models/model-loader/retired-model-rates'
import type { ElevenlabsMusicModel, GeminiMusicModel, MinimaxMusicModel } from '~/types'

export const SUPPORTED_ELEVENLABS_MUSIC_MODELS = [
  'music_v2'
] as const satisfies readonly string[]

const validateActiveElevenlabsMusicModel = createModelValidator<ElevenlabsMusicModel>(SUPPORTED_ELEVENLABS_MUSIC_MODELS, 'elevenlabs-music')
export const validateElevenlabsMusicModel = (model: string): ElevenlabsMusicModel => {
  const replacement = getRetiredModelReplacement('music', 'elevenlabs', model)
  if (replacement !== undefined) return throwRetiredModelSelection(model, 'elevenlabs-music', replacement)
  return validateActiveElevenlabsMusicModel(model)
}

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

const validateActiveGeminiMusicModel = createModelValidator<GeminiMusicModel>(SUPPORTED_GEMINI_MUSIC_MODELS, 'gemini-music')
export const validateGeminiMusicModel = (model: string): GeminiMusicModel => {
  const replacement = getRetiredModelReplacement('music', 'gemini', model)
  if (replacement !== undefined) return throwRetiredModelSelection(model, 'gemini-music', replacement)
  return validateActiveGeminiMusicModel(model)
}
