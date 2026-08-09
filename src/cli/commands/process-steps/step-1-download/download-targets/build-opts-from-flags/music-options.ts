import type { BuildDomainOptionsContext, MusicRuntimeOptionKey, RuntimeOptions } from '~/types'
import { MUSIC_PRICING_MODEL_KEYS } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'
import {
  parseOptionalIntFlag,
  readBooleanFlag,
  readOptionalStringFlag
} from '../options/flag-readers'
import { resolveLocalConcurrency, resolveProviderConcurrency } from './concurrency'
import { pick } from '~/utils/cli-utils'

export const buildMusicOptions = (ctx: BuildDomainOptionsContext): Pick<RuntimeOptions, MusicRuntimeOptionKey> => {
  const { mergedFlags, explicitFlags, configuredFlags, allShortcutFlags, modelOptions, targetCounts } = ctx

  return {
    ...pick(modelOptions, MUSIC_PRICING_MODEL_KEYS),
    musicProviderConcurrency: resolveProviderConcurrency(mergedFlags, 'music-provider-concurrency', allShortcutFlags['all-music'], targetCounts.hostedMusicTargetCount, explicitFlags, configuredFlags),
    musicLocalConcurrency: resolveLocalConcurrency(mergedFlags, 'music-local-concurrency', explicitFlags, configuredFlags),
    musicDuration: parseOptionalIntFlag(readOptionalStringFlag(mergedFlags, 'music-duration')),
    musicLyricsFile: readOptionalStringFlag(mergedFlags, 'music-lyrics-file'),
    musicInstrumental: readBooleanFlag(mergedFlags, 'music-instrumental'),
  }
}
