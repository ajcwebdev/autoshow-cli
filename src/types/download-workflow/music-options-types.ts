export type MusicRuntimeOptions = {
  musicProviderConcurrency: number
  musicLocalConcurrency: number
  elevenlabsMusicModels: string[] | undefined
  elevenlabsMusicModel: string | undefined
  minimaxMusicModels: string[] | undefined
  minimaxMusicModel: string | undefined
  geminiMusicModels: string[] | undefined
  geminiMusicModel: string | undefined
  musicDuration: number | undefined
  musicLyricsFile: string | undefined
  musicInstrumental: boolean | undefined
}

export type MusicRuntimeOptionKey = keyof MusicRuntimeOptions
