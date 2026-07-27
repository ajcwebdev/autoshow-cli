import { getMusicModelMeta } from '~/cli/commands/setup-and-utilities/models/model-loader'
import {
isMinimaxInstrumentalMusicModel,
validateElevenlabsMusicModel,
validateGeminiMusicModel,
validateMinimaxMusicModel
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import type { EstimateMusicCostOptions, MusicCostEstimate } from '~/types'
import { InternalError, ValidationError } from '~/utils/error-handler'

const formatRate = (amount: number): string => `${amount.toFixed(2)}¢`
export const DEFAULT_ELEVENLABS_MUSIC_DURATION_SECONDS = 180
const DEFAULT_MINIMAX_MUSIC_DURATION_SECONDS = 120
const GEMINI_CLIP_MUSIC_DURATION_SECONDS = 30
const DEFAULT_GEMINI_PRO_MUSIC_DURATION_SECONDS = 120

const assertValidMusicDuration = (durationSeconds: number | undefined): void => {
  if (durationSeconds !== undefined && (!Number.isFinite(durationSeconds) || durationSeconds <= 0)) {
    throw ValidationError(`Invalid music duration: ${durationSeconds}`, { stage: 'music:pricing' })
  }
}

export const estimateMusicCosts = (options: EstimateMusicCostOptions): MusicCostEstimate[] => {
  assertValidMusicDuration(options.musicDuration)

  const results: MusicCostEstimate[] = []
  const elevenlabsModels = options.elevenlabsMusicModels ?? (options.elevenlabsMusicModel ? [options.elevenlabsMusicModel] : [])
  const minimaxModels = options.minimaxMusicModels ?? (options.minimaxMusicModel ? [options.minimaxMusicModel] : [])
  const geminiModels = options.geminiMusicModels ?? (options.geminiMusicModel ? [options.geminiMusicModel] : [])

  for (const rawModel of elevenlabsModels) {
    const model = validateElevenlabsMusicModel(rawModel)
    const modelMeta = getMusicModelMeta('elevenlabs', model)
    const ratePerMinute = modelMeta?.costPerMinuteCents
    const lyricsSource: MusicCostEstimate['lyricsSource'] = options.musicInstrumental ? 'none' : 'generated'

    if (ratePerMinute === undefined) {
      throw InternalError(`Rate unavailable in model registry for ElevenLabs music model: ${model}`, { stage: 'music:pricing' })
    }

    const durationSeconds = options.musicDuration ?? DEFAULT_ELEVENLABS_MUSIC_DURATION_SECONDS
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw ValidationError(`Invalid music duration: ${durationSeconds}`, { stage: 'music:pricing' })
    }

    results.push({
      provider: 'elevenlabs',
      model,
      durationSeconds,
      totalCost: ratePerMinute * (durationSeconds / 60),
      lyricsSource,
      note: options.musicDuration !== undefined
        ? `Estimated using ${formatRate(ratePerMinute)}/minute (standard API rate)`
        : `Estimated using default ${DEFAULT_ELEVENLABS_MUSIC_DURATION_SECONDS}s duration at ${formatRate(ratePerMinute)}/minute`
    })
  }

  for (const rawModel of minimaxModels) {
    const model = validateMinimaxMusicModel(rawModel)
    const modelMeta = getMusicModelMeta('minimax', model)
    const baseCost = modelMeta?.costPerTrackCents
    const lyricsAddonCost = modelMeta?.lyricsCostPerTrackCents ?? 0
    const supportsInstrumental = isMinimaxInstrumentalMusicModel(model)
    const lyricsSource: MusicCostEstimate['lyricsSource'] = options.musicInstrumental && supportsInstrumental
      ? 'none'
      : options.musicLyricsFile ? 'provided' : 'generated'

    if (baseCost === undefined) {
      throw InternalError(`Rate unavailable in model registry for MiniMax music model: ${model}`, { stage: 'music:pricing' })
    }

    const lyricsCost = lyricsSource === 'generated' ? lyricsAddonCost : 0
    results.push({
      provider: 'minimax',
      model,
      durationSeconds: DEFAULT_MINIMAX_MUSIC_DURATION_SECONDS,
      totalCost: baseCost + lyricsCost,
      lyricsSource,
      note: lyricsSource === 'generated'
        ? `Includes ${formatRate(lyricsAddonCost)} lyrics generation add-on`
        : lyricsSource === 'none'
          ? 'Instrumental mode omits lyrics generation'
          : 'Assumes provided lyrics; no lyrics-generation add-on'
    })
  }

  for (const rawModel of geminiModels) {
    const model = validateGeminiMusicModel(rawModel)
    const modelMeta = getMusicModelMeta('gemini', model)
    const baseCost = modelMeta?.costPerTrackCents
    const lyricsSource: MusicCostEstimate['lyricsSource'] = options.musicInstrumental
      ? 'none'
      : options.musicLyricsFile
        ? 'provided'
        : 'generated'

    if (baseCost === undefined) {
      throw InternalError(`Rate unavailable in model registry for Gemini music model: ${model}`, { stage: 'music:pricing' })
    }

    results.push({
      provider: 'gemini',
      model,
      durationSeconds: model === 'lyria-3-clip-preview'
        ? GEMINI_CLIP_MUSIC_DURATION_SECONDS
        : options.musicDuration ?? DEFAULT_GEMINI_PRO_MUSIC_DURATION_SECONDS,
      totalCost: baseCost,
      lyricsSource,
      note: model === 'lyria-3-clip-preview'
        ? 'Gemini Lyria 3 Clip is billed per 30-second song request.'
        : `Gemini Lyria 3 Pro is billed per song request; timing estimate uses ${options.musicDuration ?? DEFAULT_GEMINI_PRO_MUSIC_DURATION_SECONDS}s.`
    })
  }

  return results
}
