import type { MusicRuntimeOptions, ResolvedFlagContext } from '~/types'
import { MUSIC_PRICING_MODEL_KEYS } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'
import {
  parseOptionalIntFlag,
  readBooleanFlag,
  readOptionalStringFlag
} from './flag-readers'
import { resolveProviderConcurrency } from './concurrency'
import { pick } from '~/utils/cli-utils'

export const buildMusicOptions = (ctx: ResolvedFlagContext): MusicRuntimeOptions => {
  const { mergedFlags, explicitFlags, configuredFlags, allShortcutFlags, modelOptions } = ctx

  return {
    ...pick(modelOptions, MUSIC_PRICING_MODEL_KEYS),
    musicProviderConcurrency: resolveProviderConcurrency(mergedFlags, 'music-provider-concurrency', allShortcutFlags['all-music'], explicitFlags, configuredFlags),
    musicDuration: parseOptionalIntFlag(readOptionalStringFlag(mergedFlags, 'duration')),
    musicLyricsFile: readOptionalStringFlag(mergedFlags, 'lyrics-file'),
    musicInstrumental: readBooleanFlag(mergedFlags, 'instrumental'),
  }
}
