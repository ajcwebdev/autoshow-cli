export type MusicRuntimeOptions = {
  musicProviderConcurrency: number
  elevenlabsMusicModels: string[] | undefined
  minimaxMusicModels: string[] | undefined
  geminiMusicModels: string[] | undefined
  musicDuration: number | undefined
  musicLyricsFile: string | undefined
  musicInstrumental: boolean | undefined
}
