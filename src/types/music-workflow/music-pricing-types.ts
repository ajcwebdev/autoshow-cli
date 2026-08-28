import type { MusicRuntimeOptions } from '~/types'

export type EstimateMusicCostOptions = Partial<Pick<MusicRuntimeOptions,
  | 'elevenlabsMusicModels'
  | 'minimaxMusicModels'
  | 'geminiMusicModels'
  | 'musicDuration' | 'musicLyricsFile' | 'musicInstrumental'
>>
