import type { OpenAITtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import { resolveOpenAITtsVoiceForModel, validateOpenAITtsModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureOpenAITtsSetup } from './openai-tts'
import { runOpenAITts } from './run-openai-tts'
import { resolveTtsTargetInvocationVoiceId } from '../../tts-targets/multi-speaker-capability'
import { resolveTtsTargetInvocationControls } from '../../tts-targets/tts-invocation-controls'

export const collectOpenAITtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []

  for (const rawModel of selection.openaiModels) {
    const model: OpenAITtsModel = validateOpenAITtsModel(rawModel)
    const voiceId = selection.openaiVoiceId
      ? resolveOpenAITtsVoiceForModel(model, selection.openaiVoiceId).voiceId
      : undefined

    targets.push({
      service: 'openai',
      model,
      ...(voiceId ? { voice: voiceId } : {}),
      run: async (text, outputDir, opts, invocation, requestEvidence) => {
        const invocationVoiceId = resolveTtsTargetInvocationVoiceId('openai', invocation)
        const controls = resolveTtsTargetInvocationControls('openai', invocation, {
          instructions: selection.openaiInstructions,
          speed: selection.openaiSpeed,
        })
        await ensureOpenAITtsSetup()
        return await runOpenAITts(text, outputDir, {
          model,
          voiceId: invocationVoiceId ?? voiceId,
          instructions: controls.instructions,
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
