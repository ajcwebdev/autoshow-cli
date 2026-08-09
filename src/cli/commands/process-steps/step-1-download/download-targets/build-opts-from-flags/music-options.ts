import type { BuildDomainOptionsContext, MusicRuntimeOptionKey, RuntimeOptions } from '~/types'
import {
  parseOptionalIntFlag,
  readBooleanFlag,
  readOptionalStringFlag
} from '../options/flag-readers'
import { resolveLocalConcurrency, resolveProviderConcurrency } from './concurrency'
import { pick } from '~/utils/cli-utils'

const MUSIC_MODEL_KEYS = [
  'elevenlabsMusicModels', 'elevenlabsMusicModel', 'minimaxMusicModels', 'minimaxMusicModel',
  'geminiMusicModels', 'geminiMusicModel',
] as const satisfies readonly MusicRuntimeOptionKey[]

export const buildMusicOptions = (ctx: BuildDomainOptionsContext): Pick<RuntimeOptions, MusicRuntimeOptionKey> => {
  const { mergedFlags, explicitFlags, configuredFlags, allShortcutFlags, modelOptions, targetCounts } = ctx

  return {
    ...pick(modelOptions, MUSIC_MODEL_KEYS),
    musicProviderConcurrency: resolveProviderConcurrency(mergedFlags, 'music-provider-concurrency', allShortcutFlags['all-music'], targetCounts.hostedMusicTargetCount, explicitFlags, configuredFlags),
    musicLocalConcurrency: resolveLocalConcurrency(mergedFlags, 'music-local-concurrency', explicitFlags, configuredFlags),
    musicDuration: parseOptionalIntFlag(readOptionalStringFlag(mergedFlags, 'music-duration')),
    musicLyricsFile: readOptionalStringFlag(mergedFlags, 'music-lyrics-file'),
    musicInstrumental: readBooleanFlag(mergedFlags, 'music-instrumental'),
  }
}
