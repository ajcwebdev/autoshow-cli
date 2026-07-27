import type { GrokTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import {
  validateGrokTtsModel,
  validateGrokTtsVoice
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureGrokTtsSetup } from './grok-tts'
import { runGrokTts } from './run-grok-tts'
export const collectGrokTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.grokModels) {
    const model: GrokTtsModel = validateGrokTtsModel(rawModel)
    const voiceId = selection.grokVoiceId ? validateGrokTtsVoice(selection.grokVoiceId) : undefined

    targets.push({
      service: 'grok',
      model,
      ...(voiceId ? { voice: voiceId } : {}),
      run: async (text, outputDir, opts) => {
        await ensureGrokTtsSetup()
        return await runGrokTts(text, outputDir, {
          model,
          voiceId,
          language: selection.grokLanguage,
          textNormalization: selection.grokTextNormalization,
          chunkConcurrency: opts.ttsChunkConcurrency,
          chunkScheduler: opts.hostedTtsChunkScheduler
        })
      }
    })
  }
  return targets
}
