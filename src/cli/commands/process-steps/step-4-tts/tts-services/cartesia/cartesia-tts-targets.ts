import type { CartesiaTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import {
  validateCartesiaTtsModel,
  validateCartesiaTtsVoice
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureCartesiaTtsSetup } from './cartesia-tts'
import { runCartesiaTts } from './run-cartesia-tts'
export const collectCartesiaTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.cartesiaModels) {
    const model: CartesiaTtsModel = validateCartesiaTtsModel(rawModel)
    const voiceId = selection.cartesiaVoiceId ? validateCartesiaTtsVoice(selection.cartesiaVoiceId) : undefined

    targets.push({
      service: 'cartesia',
      model,
      ...(voiceId ? { voice: voiceId } : {}),
      run: async (text, outputDir, opts) => {
        await ensureCartesiaTtsSetup()
        return await runCartesiaTts(text, outputDir, {
          model,
          voiceId,
          language: selection.cartesiaLanguage,
          chunkConcurrency: opts.ttsChunkConcurrency,
          chunkScheduler: opts.hostedTtsChunkScheduler
        })
      }
    })
  }
  return targets
}
