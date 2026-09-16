import type { MusicGenOptions, MusicProvider, MusicProviderEntry, MusicTarget } from '~/types'
import { MUSIC_MODEL_ENTRIES } from '~/cli/commands/command-shared/generation-routing/generation-model-registry'
import { collectElevenlabsMusicTargets } from '../music-services/music-elevenlabs/elevenlabs-music-targets'
import { collectMinimaxMusicTargets } from '../music-services/music-minimax/minimax-music-targets'
import { collectGeminiMusicTargets } from '../music-services/music-gemini/gemini-music-targets'

// Exhaustive by type: a new music provider in the selection registry must land a collector here.
const MUSIC_TARGET_COLLECTORS = {
  elevenlabs: collectElevenlabsMusicTargets,
  minimax: collectMinimaxMusicTargets,
  gemini: collectGeminiMusicTargets
} as const satisfies Record<MusicProvider, (options: MusicGenOptions) => MusicTarget[]>

export const MUSIC_PROVIDER_REGISTRY: readonly MusicProviderEntry[] = MUSIC_MODEL_ENTRIES.map(entry => ({
  ...entry,
  collectTargets: MUSIC_TARGET_COLLECTORS[entry.service]
}))
