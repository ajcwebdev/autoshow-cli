import type { MusicGenOptions } from '~/types'

export const buildMusicRequest = <TModel extends string>(options: MusicGenOptions, model: TModel) => ({
  model,
  durationSeconds: options.musicDuration,
  lyricsFile: options.musicLyricsFile,
  forceInstrumental: options.musicInstrumental
})

// Flags a provider accepts but does not apply, mirroring the warnings each runner logs.
export const ignoredMusicSettings = (
  options: MusicGenOptions,
  support: { duration: boolean, instrumental: boolean }
): string[] => {
  const instrumental = options.musicInstrumental === true && support.instrumental
  return [
    ...(options.musicDuration !== undefined && !support.duration ? ['duration'] : []),
    ...(options.musicInstrumental === true && !support.instrumental ? ['instrumental'] : []),
    ...(instrumental && options.musicLyricsFile ? ['lyrics-file'] : [])
  ]
}
