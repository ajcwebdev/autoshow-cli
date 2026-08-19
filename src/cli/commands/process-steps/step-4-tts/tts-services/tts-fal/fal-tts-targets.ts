import type { FalTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import { requireApiKey } from '~/utils/validate/env-utils'
import { validateFalTtsModel, validateFalTtsVoice } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { runFalTts } from './run-fal-tts'
import { resolveTtsTargetInvocationVoiceId } from '../../tts-targets/multi-speaker-capability'
import { resolveTtsTargetInvocationControls } from '../../tts-targets/tts-invocation-controls'
import { resolveFalTtsDefaultVoice } from './fal-tts-request'

export const collectFalTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.falModels) {
    const model: FalTtsModel = validateFalTtsModel(rawModel)
    const voiceId = selection.falVoiceId ? validateFalTtsVoice(selection.falVoiceId) : undefined
    targets.push({
      service: 'fal',
      model,
      voice: voiceId ?? resolveFalTtsDefaultVoice(model),
      run: async (text, outputDir, opts, invocation, requestEvidence) => {
        const invocationVoiceId = resolveTtsTargetInvocationVoiceId('fal', invocation)
        const controls = resolveTtsTargetInvocationControls('fal', invocation, {})
        return await runFalTts(text, outputDir, {
          model,
          apiKey: requireApiKey('FAL_API_KEY', 'tts:fal', 'fal.ai TTS'),
          voiceId: invocationVoiceId ?? voiceId,
          abortSignal: invocation?.signal,
          chunkConcurrency: opts.ttsChunkConcurrency,
          chunkScheduler: opts.hostedTtsChunkScheduler,
          requestEvidence,
          voiceInstruction: typeof (controls as { voiceInstruction?: unknown }).voiceInstruction === 'string'
            ? (controls as { voiceInstruction?: string }).voiceInstruction
            : undefined,
        })
      },
    })
  }
  return targets
}
