import type { InworldTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import { validateInworldTtsModel, validateInworldTtsVoice } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { runInworldTts } from './run-inworld-tts'
import { resolveTtsTargetInvocationVoiceId } from '../../tts-targets/multi-speaker-capability'
import { resolveTtsTargetInvocationControls } from '../../tts-targets/tts-invocation-controls'

export const collectInworldTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.inworldModels) {
    const model: InworldTtsModel = validateInworldTtsModel(rawModel)
    const voiceId = selection.inworldVoiceId ? validateInworldTtsVoice(selection.inworldVoiceId) : undefined

    const target: TtsTarget = {
      service: 'inworld',
      model,
      voice: voiceId ?? 'voice_inworld_standard_en',
      run: async (text, outputDir, opts, invocation, requestEvidence) => {
        const invocationVoiceId = resolveTtsTargetInvocationVoiceId('inworld', invocation)
        const controls = resolveTtsTargetInvocationControls('inworld', invocation, {})
        const apiKey = process.env['INWORLD_API_KEY'] ?? ''
        return await runInworldTts(text, outputDir, {
          model,
          apiKey,
          voiceId: invocationVoiceId ?? voiceId,
          abortSignal: invocation?.signal,
          chunkConcurrency: opts.ttsChunkConcurrency,
          chunkScheduler: opts.hostedTtsChunkScheduler,
          requestEvidence,
          steeringPrompt: typeof (controls as { steeringPrompt?: unknown }).steeringPrompt === 'string' ? (controls as { steeringPrompt?: string }).steeringPrompt : undefined,
        })
      }
    }
    targets.push(target)
  }
  return targets
}
