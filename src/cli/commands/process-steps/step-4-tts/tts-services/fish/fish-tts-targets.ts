import type { FishTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import { validateFishTtsModel, validateFishTtsVoice } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { runFishTts } from './run-fish-tts'
import { resolveTtsTargetInvocationVoiceId } from '../../tts-targets/multi-speaker-capability'
import { resolveTtsTargetInvocationControls } from '../../tts-targets/tts-invocation-controls'

export const collectFishTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.fishModels) {
    const model: FishTtsModel = validateFishTtsModel(rawModel)
    const voiceId = selection.fishVoiceId ? validateFishTtsVoice(selection.fishVoiceId) : undefined

    const target: TtsTarget = {
      service: 'fish',
      model,
      voice: voiceId ?? '7f92f8afb8ec43bf81429cc1c9199cb1',
      run: async (text, outputDir, opts, invocation, requestEvidence) => {
        const invocationVoiceId = resolveTtsTargetInvocationVoiceId('fish', invocation)
        const controls = resolveTtsTargetInvocationControls('fish', invocation, {})
        const apiKey = process.env['FISH_API_KEY'] ?? ''
        return await runFishTts(text, outputDir, {
          model,
          apiKey,
          voiceId: invocationVoiceId ?? voiceId,
          latency: controls.latency as 'normal' | 'balanced' | undefined,
          abortSignal: invocation?.signal,
          chunkConcurrency: opts.ttsChunkConcurrency,
          chunkScheduler: opts.hostedTtsChunkScheduler,
          requestEvidence,
        })
      }
    }
    targets.push(target)
  }
  return targets
}
