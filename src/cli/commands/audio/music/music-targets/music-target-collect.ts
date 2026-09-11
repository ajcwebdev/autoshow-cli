import type { MusicGenOptions, MusicTarget } from '~/types'
import { collectElevenlabsMusicTargets } from '../music-services/music-elevenlabs/elevenlabs-music-targets'
import { collectMinimaxMusicTargets } from '../music-services/music-minimax/minimax-music-targets'
import { collectGeminiMusicTargets } from '../music-services/music-gemini/gemini-music-targets'
import { filterModelCostTargets } from '~/cli/commands/pricing-orchestration/model-cost-filter'

export const collectMusicTargets = (options: MusicGenOptions): MusicTarget[] => filterModelCostTargets([
  ...collectElevenlabsMusicTargets(options),
  ...collectMinimaxMusicTargets(options),
  ...collectGeminiMusicTargets(options)
], options, 'music')
