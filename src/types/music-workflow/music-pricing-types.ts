import type { MusicRuntimeOptions } from '~/types'

export type EstimateMusicCostOptions = Partial<Pick<MusicRuntimeOptions,
  | 'elevenlabsMusicModels' | 'elevenlabsMusicModel'
  | 'minimaxMusicModels' | 'minimaxMusicModel'
  | 'geminiMusicModels' | 'geminiMusicModel'
  | 'musicDuration' | 'musicLyricsFile' | 'musicInstrumental'
>>
