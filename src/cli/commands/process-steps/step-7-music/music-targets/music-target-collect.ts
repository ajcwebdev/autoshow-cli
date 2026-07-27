import type { MusicGenOptions, MusicTarget } from '~/types'
import { collectElevenlabsMusicTargets } from '../music-services/music-elevenlabs/elevenlabs-music-targets'
import { collectMinimaxMusicTargets } from '../music-services/music-minimax/minimax-music-targets'
import { collectGeminiMusicTargets } from '../music-services/music-gemini/gemini-music-targets'

export const collectMusicTargets = (options: MusicGenOptions): MusicTarget[] => [
  ...collectElevenlabsMusicTargets(options),
  ...collectMinimaxMusicTargets(options),
  ...collectGeminiMusicTargets(options)
]
