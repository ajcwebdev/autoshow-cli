import { getMusicModelMeta } from '~/cli/commands/setup-and-utilities/models/model-loader'
import {
  isMinimaxInstrumentalMusicModel,
  validateElevenlabsMusicModel,
  validateGeminiMusicModel,
  validateMinimaxMusicModel
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { deriveGenerationPricingProviders, MUSIC_GENERATION_SELECTION } from '~/cli/flags/service-selector-normalization/provider-targets'
import type { EstimateMusicCostOptions, MusicCostEstimate, MusicProvider, ProviderModelSelectionSpec } from '~/types'
import { InternalError, ValidationError } from '~/utils/error-handler'
import { collectSelections, passThroughKeys } from '~/utils/pricing/model-selection'

export const MUSIC_PRICING_PROVIDERS = deriveGenerationPricingProviders(MUSIC_GENERATION_SELECTION) satisfies readonly ProviderModelSelectionSpec<EstimateMusicCostOptions, MusicProvider>[]

export const MUSIC_PRICING_MODEL_KEYS = passThroughKeys(MUSIC_PRICING_PROVIDERS)

const formatRate = (amount: number): string => `${amount.toFixed(2)}¢`
export const DEFAULT_ELEVENLABS_MUSIC_DURATION_SECONDS = 180
const DEFAULT_MINIMAX_MUSIC_DURATION_SECONDS = 120
const DEFAULT_GEMINI_PRO_MUSIC_DURATION_SECONDS = 120

const assertValidMusicDuration = (durationSeconds: number | undefined): void => {
  if (durationSeconds !== undefined && (!Number.isFinite(durationSeconds) || durationSeconds <= 0)) {
    throw ValidationError(`Invalid music duration: ${durationSeconds}`, { stage: 'music:pricing' })
  }
}

export const estimateMusicCosts = (options: EstimateMusicCostOptions): MusicCostEstimate[] => {
  assertValidMusicDuration(options.musicDuration)

  const results: MusicCostEstimate[] = []
  for (const selection of collectSelections(options, MUSIC_PRICING_PROVIDERS)) {
    switch (selection.service) {
      case 'elevenlabs': {
        const model = validateElevenlabsMusicModel(selection.model)
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
        break
      }
      case 'minimax': {
        const model = validateMinimaxMusicModel(selection.model)
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
        break
      }
      case 'gemini': {
        const model = validateGeminiMusicModel(selection.model)
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
          durationSeconds: options.musicDuration ?? DEFAULT_GEMINI_PRO_MUSIC_DURATION_SECONDS,
          totalCost: baseCost,
          lyricsSource,
          note: `Gemini Lyria 3 Pro is billed per song request; timing estimate uses ${options.musicDuration ?? DEFAULT_GEMINI_PRO_MUSIC_DURATION_SECONDS}s.`
        })
        break
      }
    }
  }

  return results
}
