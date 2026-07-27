import type { MinimaxMusicModel, MusicGenOptions, MusicTarget } from '~/types'
import { validateMinimaxMusicModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureMinimaxMusicGenSetup } from './minimax-music-gen'
import { runMinimaxMusicGen } from './run-minimax-music-gen'

export const collectMinimaxMusicTargets = (options: MusicGenOptions): MusicTarget[] => {
  const models = options.minimaxMusicModels ?? (options.minimaxMusicModel ? [options.minimaxMusicModel] : [])
  return models.map((rawModel) => {
    const model: MinimaxMusicModel = validateMinimaxMusicModel(rawModel)

    return {
      service: 'minimax',
      model,
      run: async (prompt, outputDir) => {
        await ensureMinimaxMusicGenSetup()
        return await runMinimaxMusicGen(prompt, outputDir, {
          model,
          durationSeconds: options.musicDuration,
          lyricsFile: options.musicLyricsFile,
          forceInstrumental: options.musicInstrumental
        })
      }
    }
  })
}
