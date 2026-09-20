import type { GeminiMusicModel, MusicGenOptions, MusicTarget } from '~/types'
import { validateGeminiMusicModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { runGeminiMusicGen } from './run-gemini-music-gen'
import { createMediaTargetCollector } from '~/cli/commands/command-shared/media-target-collector'
import { buildMusicRequest, ignoredMusicSettings } from '../../music-targets/music-request-settings'

export const collectGeminiMusicTargets: (options: MusicGenOptions) => MusicTarget[] = createMediaTargetCollector({
  service: 'gemini',
  readModels: (options: MusicGenOptions) => options.geminiMusicModels ?? [],
  validateModel: (rawModel): GeminiMusicModel => validateGeminiMusicModel(rawModel),
  targetFields: (options: MusicGenOptions, model: string): Pick<MusicTarget, 'requestSettings' | 'ignoredSettings'> => ({
    requestSettings: buildMusicRequest(options, model),
    ignoredSettings: ignoredMusicSettings(options, { duration: true, instrumental: true })
  }),
  run: async (options, model, _fields, ...[prompt, outputDir]: Parameters<MusicTarget['run']>) => await runGeminiMusicGen(prompt, outputDir, buildMusicRequest(options, model))
})
