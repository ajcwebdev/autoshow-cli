import type { GroqTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import {
  getGroqDefaultTtsVoiceForModel,
  validateGroqTtsModel,
  validateGroqTtsVoice,
  validateGroqTtsVoiceForModel
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureGroqTtsSetup } from './groq-tts'
import { runGroqTts } from './run-groq-tts'
import { resolveTtsTargetInvocationVoiceId } from '../../tts-targets/multi-speaker-capability'
import { resolveTtsTargetInvocationControls } from '../../tts-targets/tts-invocation-controls'
export const collectGroqTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.groqModels) {
    const model: GroqTtsModel = validateGroqTtsModel(rawModel)
    const voiceId = selection.groqVoiceId ? validateGroqTtsVoice(selection.groqVoiceId) : undefined
    const targetVoice = voiceId
      ? validateGroqTtsVoiceForModel(model, voiceId)
      : getGroqDefaultTtsVoiceForModel(model)

    targets.push({
      service: 'groq',
      model,
      voice: targetVoice,
      run: async (text, outputDir, opts, invocation, requestEvidence) => {
        const invocationVoiceId = resolveTtsTargetInvocationVoiceId('groq', invocation)
        const controls = resolveTtsTargetInvocationControls('groq', invocation, {})
        await ensureGroqTtsSetup()
        return await runGroqTts(text, outputDir, {
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
