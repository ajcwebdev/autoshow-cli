import type { DeepinfraTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import { requireApiKey } from '~/utils/validate/env-utils'
import { validateDeepinfraTtsModel, validateDeepinfraTtsVoice } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { runDeepinfraTts } from './run-deepinfra-tts'
import { resolveTtsTargetInvocationVoiceId } from '../../tts-targets/multi-speaker-capability'
import { resolveTtsTargetInvocationControls } from '../../tts-targets/tts-invocation-controls'
import { resolveDeepinfraTtsDefaultVoice } from './deepinfra-tts-request'

export const collectDeepinfraTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.deepinfraModels) {
    const model: DeepinfraTtsModel = validateDeepinfraTtsModel(rawModel)
    const voiceId = selection.deepinfraVoiceId ? validateDeepinfraTtsVoice(selection.deepinfraVoiceId) : undefined

    const target: TtsTarget = {
      service: 'deepinfra',
      model,
      voice: voiceId ?? resolveDeepinfraTtsDefaultVoice(model),
      allowFailedImplicitDefaultReplan: voiceId === undefined,
      run: async (text, outputDir, opts, invocation, requestEvidence) => {
        const invocationVoiceId = resolveTtsTargetInvocationVoiceId('deepinfra', invocation)
        const controls = resolveTtsTargetInvocationControls('deepinfra', invocation, {})
        const apiKey = requireApiKey('DEEPINFRA_API_KEY', 'tts:deepinfra', 'DeepInfra TTS')
        return await runDeepinfraTts(text, outputDir, {
          model,
          apiKey,
          voiceId: invocationVoiceId ?? voiceId,
          abortSignal: invocation?.signal,
          chunkConcurrency: opts.ttsChunkConcurrency,
          chunkScheduler: opts.hostedTtsChunkScheduler,
          requestEvidence,
          promptInstructions: typeof (controls as { promptInstructions?: unknown }).promptInstructions === 'string' ? (controls as { promptInstructions?: string }).promptInstructions : undefined,
        })
      }
    }
    targets.push(target)
  }
  return targets
}
