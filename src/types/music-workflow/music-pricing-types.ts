import type { ProcessingOptions } from '~/types'

export type EstimateMusicCostOptions = Pick<ProcessingOptions,
  | 'elevenlabsMusicModels' | 'elevenlabsMusicModel'
  | 'minimaxMusicModels' | 'minimaxMusicModel'
  | 'geminiMusicModels' | 'geminiMusicModel'
  | 'musicDuration' | 'musicLyricsFile' | 'musicInstrumental'
>
