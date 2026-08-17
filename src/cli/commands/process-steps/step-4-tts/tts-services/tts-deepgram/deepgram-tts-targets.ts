import type { DeepgramTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import {
  validateDeepgramTtsModel,
  validateDeepgramTtsVoice
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureDeepgramTtsSetup } from './deepgram-tts'
import { runDeepgramTts } from './run-deepgram-tts'
import { resolveTtsTargetInvocationVoiceId } from '../../tts-targets/multi-speaker-capability'
import { resolveTtsTargetInvocationControls } from '../../tts-targets/tts-invocation-controls'
export const collectDeepgramTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.deepgramModels) {
    const model: DeepgramTtsModel = validateDeepgramTtsModel(rawModel)
    const voiceId = selection.deepgramVoiceId
      ? validateDeepgramTtsVoice(selection.deepgramVoiceId)
      : undefined

    targets.push({
      service: 'deepgram',
      model,
      ...(voiceId ? { voice: voiceId } : {}),
      run: async (text, outputDir, opts, invocation, requestEvidence) => {
        const invocationVoiceId = resolveTtsTargetInvocationVoiceId('deepgram', invocation)
        const controls = resolveTtsTargetInvocationControls('deepgram', invocation, {
          speed: selection.deepgramSpeed,
        })
        await ensureDeepgramTtsSetup()
        return await runDeepgramTts(text, outputDir, {
          model,
          voiceId: invocationVoiceId ?? voiceId,
          speed: controls.speed,
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
