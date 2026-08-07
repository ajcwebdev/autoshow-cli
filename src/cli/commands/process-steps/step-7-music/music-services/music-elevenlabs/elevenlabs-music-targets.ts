import type { ElevenlabsMusicModel, MusicGenOptions, MusicTarget } from '~/types'
import { validateElevenlabsMusicModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureElevenLabsMusicGenSetup } from './elevenlabs-music-gen'
import { runElevenLabsMusicGen } from './run-elevenlabs-music-gen'

export const collectElevenlabsMusicTargets = (options: MusicGenOptions): MusicTarget[] => {
  const models = options.elevenlabsMusicModels ?? []
  return models.map((rawModel) => {
    const model: ElevenlabsMusicModel = validateElevenlabsMusicModel(rawModel)

    return {
      service: 'elevenlabs',
      model,
      run: async (prompt, outputDir) => {
        await ensureElevenLabsMusicGenSetup()
        return await runElevenLabsMusicGen(prompt, outputDir, {
          model,
          durationSeconds: options.musicDuration,
          forceInstrumental: options.musicInstrumental
        })
      }
    }
  })
}
