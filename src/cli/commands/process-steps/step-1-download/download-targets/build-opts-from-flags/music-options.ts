import type { BuildDomainOptionsContext, MusicRuntimeOptionKey, RuntimeOptions } from '~/types'
import {
  parseOptionalIntFlag,
  readBooleanFlag,
  readOptionalStringFlag
} from '../options/flag-readers'
import { resolveLocalConcurrency, resolveProviderConcurrency } from './concurrency'

export const buildMusicOptions = (ctx: BuildDomainOptionsContext): Pick<RuntimeOptions, MusicRuntimeOptionKey> => {
  const { mergedFlags, explicitFlags, configuredFlags, allShortcutFlags, modelOptions, targetCounts } = ctx
  const {
    elevenlabsMusicModels,
    elevenlabsMusicModel,
    minimaxMusicModels,
    minimaxMusicModel,
    geminiMusicModels,
    geminiMusicModel,
  } = modelOptions

  return {
    musicProviderConcurrency: resolveProviderConcurrency(mergedFlags, 'music-provider-concurrency', allShortcutFlags['all-music'], targetCounts.hostedMusicTargetCount, explicitFlags, configuredFlags),
    musicLocalConcurrency: resolveLocalConcurrency(mergedFlags, 'music-local-concurrency', explicitFlags, configuredFlags),
    elevenlabsMusicModels,
    elevenlabsMusicModel,
    minimaxMusicModels,
    minimaxMusicModel,
    geminiMusicModels,
    geminiMusicModel,
    musicDuration: parseOptionalIntFlag(readOptionalStringFlag(mergedFlags, 'music-duration')),
    musicLyricsFile: readOptionalStringFlag(mergedFlags, 'music-lyrics-file'),
    musicInstrumental: readBooleanFlag(mergedFlags, 'music-instrumental'),
  }
}
