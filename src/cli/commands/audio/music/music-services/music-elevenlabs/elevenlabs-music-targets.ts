import type { ElevenlabsMusicModel, MusicGenOptions, MusicTarget } from '~/types'
import { validateElevenlabsMusicModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { runElevenLabsMusicGen } from './run-elevenlabs-music-gen'
import { createMediaTargetCollector } from '~/cli/commands/command-shared/media-target-collector'
import { buildMusicRequest, ignoredMusicSettings } from '../../music-targets/music-request-settings'

export const collectElevenlabsMusicTargets: (options: MusicGenOptions) => MusicTarget[] = createMediaTargetCollector({
  service: 'elevenlabs',
  readModels: (options: MusicGenOptions) => options.elevenlabsMusicModels ?? [],
  validateModel: (rawModel): ElevenlabsMusicModel => validateElevenlabsMusicModel(rawModel),
  targetFields: (options: MusicGenOptions, model: string): Pick<MusicTarget, 'requestSettings' | 'ignoredSettings'> => ({
    requestSettings: buildMusicRequest(options, model),
    ignoredSettings: ignoredMusicSettings(options, { duration: true, instrumental: true })
  }),
  run: async (options, model, _fields, ...[prompt, outputDir]: Parameters<MusicTarget['run']>) => await runElevenLabsMusicGen(prompt, outputDir, buildMusicRequest(options, model))
})
