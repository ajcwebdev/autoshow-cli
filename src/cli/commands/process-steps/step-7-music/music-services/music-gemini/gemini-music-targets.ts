import type { GeminiMusicModel, MusicGenOptions, MusicTarget } from '~/types'
import { validateGeminiMusicModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureGeminiMusicGenSetup } from './gemini-music-gen'
import { runGeminiMusicGen } from './run-gemini-music-gen'

export const collectGeminiMusicTargets = (options: MusicGenOptions): MusicTarget[] => {
  const models = options.geminiMusicModels ?? (options.geminiMusicModel ? [options.geminiMusicModel] : [])
  return models.map((rawModel) => {
    const model: GeminiMusicModel = validateGeminiMusicModel(rawModel)

    return {
      service: 'gemini',
      model,
      run: async (prompt, outputDir) => {
        await ensureGeminiMusicGenSetup()
        return await runGeminiMusicGen(prompt, outputDir, {
          model,
          durationSeconds: options.musicDuration,
          lyricsFile: options.musicLyricsFile,
          forceInstrumental: options.musicInstrumental
        })
      }
    }
  })
}
