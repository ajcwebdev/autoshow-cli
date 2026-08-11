import type { CartesiaTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import {
  validateCartesiaTtsModel,
  validateCartesiaTtsVoice
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureCartesiaTtsSetup } from './cartesia-tts'
import { runCartesiaTts } from './run-cartesia-tts'
import { resolveTtsTargetInvocationVoiceId } from '../../tts-targets/multi-speaker-capability'
import { resolveTtsTargetInvocationControls } from '../../tts-targets/tts-invocation-controls'
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
      run: async (text, outputDir, opts, invocation, requestEvidence) => {
        const invocationVoiceId = resolveTtsTargetInvocationVoiceId('cartesia', invocation)
        const controls = resolveTtsTargetInvocationControls('cartesia', invocation, {
          language: selection.cartesiaLanguage,
        })
        await ensureCartesiaTtsSetup()
        return await runCartesiaTts(text, outputDir, {
          model,
          voiceId: invocationVoiceId ?? voiceId,
          language: controls.language,
          chunkConcurrency: opts.ttsChunkConcurrency,
          chunkScheduler: opts.hostedTtsChunkScheduler,
          abortSignal: invocation?.signal,
          requestEvidence
        })
      }
    })
  }
  return targets
}
