import type { GeminiMusicModel, MusicGenOptions, MusicTarget } from '~/types'
import { validateGeminiMusicModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { runGeminiMusicGen } from './run-gemini-music-gen'
import { createMediaTargetCollector } from '~/cli/commands/command-shared/media-target-collector'

export const collectGeminiMusicTargets: (options: MusicGenOptions) => MusicTarget[] = createMediaTargetCollector({
  service: 'gemini',
  readModels: (options: MusicGenOptions) => options.geminiMusicModels ?? [],
  validateModel: (rawModel): GeminiMusicModel => validateGeminiMusicModel(rawModel),
  run: async (options, model, _fields, ...[prompt, outputDir]: Parameters<MusicTarget['run']>) => await runGeminiMusicGen(prompt, outputDir, {
    model,
    durationSeconds: options.musicDuration,
    lyricsFile: options.musicLyricsFile,
    forceInstrumental: options.musicInstrumental
  })
})
