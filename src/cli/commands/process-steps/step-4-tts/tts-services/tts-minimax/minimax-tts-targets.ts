import type { MinimaxTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import { validateMinimaxTtsModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { runMinimaxTts } from './run-minimax-tts'
export const collectMinimaxTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []

  for (const rawModel of selection.minimaxModels) {
    const model: MinimaxTtsModel = validateMinimaxTtsModel(rawModel)
    const voiceId = selection.minimaxVoiceId

    targets.push({
      service: 'minimax',
      model,
      ...(voiceId ? { voice: voiceId } : {}),
      run: async (text, outputDir, opts) => {
        return await runMinimaxTts(text, outputDir, {
          model,
          voiceId,
          languageBoost: selection.minimaxLanguageBoost,
          speed: selection.minimaxSpeed,
          volume: selection.minimaxVolume,
          pitch: selection.minimaxPitch,
          emotion: selection.minimaxEmotion,
          englishNormalization: selection.minimaxEnglishNormalization,
          pronunciations: selection.minimaxPronunciations,
          chunkConcurrency: opts.ttsChunkConcurrency,
          chunkScheduler: opts.hostedTtsChunkScheduler
        })
      }
    })
  }

  return targets
}
