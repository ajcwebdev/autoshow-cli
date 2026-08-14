import type { ReplicateTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import { REPLICATE_DEFAULT_TTS_VOICE, validateReplicateTtsModel, validateReplicateTtsVoice } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { runReplicateTts } from './run-replicate-tts'
import { resolveTtsTargetInvocationVoiceId } from '../../tts-targets/multi-speaker-capability'
import { resolveTtsTargetInvocationControls } from '../../tts-targets/tts-invocation-controls'

export const collectReplicateTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.replicateModels) {
    const model: ReplicateTtsModel = validateReplicateTtsModel(rawModel)
    const voiceId = selection.replicateVoiceId ? validateReplicateTtsVoice(selection.replicateVoiceId) : undefined

    const target: TtsTarget = {
      service: 'replicate',
      model,
      voice: voiceId ?? REPLICATE_DEFAULT_TTS_VOICE,
      run: async (text, outputDir, opts, invocation, requestEvidence) => {
        const invocationVoiceId = resolveTtsTargetInvocationVoiceId('replicate', invocation)
        const controls = resolveTtsTargetInvocationControls('replicate', invocation, {})
        const apiKey = process.env['REPLICATE_API_TOKEN'] ?? ''
        return await runReplicateTts(text, outputDir, {
          model,
          apiKey,
          voiceId: invocationVoiceId ?? voiceId,
          abortSignal: invocation?.signal,
          chunkConcurrency: opts.ttsChunkConcurrency,
          chunkScheduler: opts.hostedTtsChunkScheduler,
          requestEvidence,
          speed: typeof (controls as { speed?: unknown }).speed === 'number' ? (controls as { speed?: number }).speed : undefined,
        })
      }
    }
    targets.push(target)
  }
  return targets
}
