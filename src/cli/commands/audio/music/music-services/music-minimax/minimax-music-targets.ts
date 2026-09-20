import type { MinimaxMusicModel, MusicGenOptions, MusicTarget } from '~/types'
import { validateMinimaxMusicModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { isMinimaxInstrumentalMusicModel } from '~/cli/commands/setup-and-utilities/models/music-models'
import { runMinimaxMusicGen } from './run-minimax-music-gen'
import { createMediaTargetCollector } from '~/cli/commands/command-shared/media-target-collector'
import { buildMusicRequest, ignoredMusicSettings } from '../../music-targets/music-request-settings'

export const collectMinimaxMusicTargets: (options: MusicGenOptions) => MusicTarget[] = createMediaTargetCollector({
  service: 'minimax',
  readModels: (options: MusicGenOptions) => options.minimaxMusicModels ?? [],
  validateModel: (rawModel): MinimaxMusicModel => validateMinimaxMusicModel(rawModel),
  targetFields: (options: MusicGenOptions, model: string): Pick<MusicTarget, 'requestSettings' | 'ignoredSettings'> => ({
    requestSettings: buildMusicRequest(options, model),
    ignoredSettings: ignoredMusicSettings(options, { duration: false, instrumental: isMinimaxInstrumentalMusicModel(model) })
  }),
  run: async (options, model, _fields, ...[prompt, outputDir]: Parameters<MusicTarget['run']>) => await runMinimaxMusicGen(prompt, outputDir, buildMusicRequest(options, model))
})
