import type { MinimaxMusicModel, MusicGenOptions, MusicTarget } from '~/types'
import { validateMinimaxMusicModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureMinimaxMusicGenSetup } from './minimax-music-gen'
import { runMinimaxMusicGen } from './run-minimax-music-gen'
import { createMediaTargetCollector } from '~/cli/commands/process-steps/media-target-collector'

export const collectMinimaxMusicTargets: (options: MusicGenOptions) => MusicTarget[] = createMediaTargetCollector({
  service: 'minimax',
  readModels: (options: MusicGenOptions) => options.minimaxMusicModels ?? [],
  validateModel: (rawModel): MinimaxMusicModel => validateMinimaxMusicModel(rawModel),
  ensureSetup: ensureMinimaxMusicGenSetup,
  run: async (options, model, _fields, ...[prompt, outputDir]: Parameters<MusicTarget['run']>) => await runMinimaxMusicGen(prompt, outputDir, {
    model,
    durationSeconds: options.musicDuration,
    lyricsFile: options.musicLyricsFile,
    forceInstrumental: options.musicInstrumental
  })
})
