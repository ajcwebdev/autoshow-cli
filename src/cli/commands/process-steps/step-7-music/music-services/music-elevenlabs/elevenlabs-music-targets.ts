import type { ElevenlabsMusicModel, MusicGenOptions, MusicTarget } from '~/types'
import { validateElevenlabsMusicModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureElevenLabsMusicGenSetup } from './elevenlabs-music-gen'
import { runElevenLabsMusicGen } from './run-elevenlabs-music-gen'
import { createMediaTargetCollector } from '~/cli/commands/process-steps/media-target-collector'

export const collectElevenlabsMusicTargets: (options: MusicGenOptions) => MusicTarget[] = createMediaTargetCollector({
  service: 'elevenlabs',
  readModels: (options: MusicGenOptions) => options.elevenlabsMusicModels ?? [],
  validateModel: (rawModel): ElevenlabsMusicModel => validateElevenlabsMusicModel(rawModel),
  ensureSetup: ensureElevenLabsMusicGenSetup,
  run: async (options, model, _fields, ...[prompt, outputDir]: Parameters<MusicTarget['run']>) => await runElevenLabsMusicGen(prompt, outputDir, {
    model,
    durationSeconds: options.musicDuration,
    lyricsFile: options.musicLyricsFile,
    forceInstrumental: options.musicInstrumental
  })
})
