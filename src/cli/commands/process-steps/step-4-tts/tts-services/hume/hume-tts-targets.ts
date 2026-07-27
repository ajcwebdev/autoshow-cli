import type { HumeTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import {
  validateHumeTtsModel,
  validateHumeTtsVoice,
  validateHumeTtsVoiceProvider
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureHumeTtsSetup } from './hume-tts'
import { runHumeTts } from './run-hume-tts'
export const collectHumeTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.humeModels) {
    const model: HumeTtsModel = validateHumeTtsModel(rawModel)
    const voice = selection.humeVoice ? validateHumeTtsVoice(selection.humeVoice) : undefined
    const voiceProvider = selection.humeVoiceProvider ? validateHumeTtsVoiceProvider(selection.humeVoiceProvider) : undefined

    targets.push({
      service: 'hume',
      model,
      ...(voice ? { voice } : {}),
      run: async (text, outputDir, opts) => {
        await ensureHumeTtsSetup()
        return await runHumeTts(text, outputDir, {
          model,
          voice,
          voiceProvider,
          chunkConcurrency: opts.ttsChunkConcurrency,
          chunkScheduler: opts.hostedTtsChunkScheduler
        })
      }
    })
  }
  return targets
}
