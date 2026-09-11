import type { GrokTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import {
  validateGrokTtsModel,
  validateGrokTtsVoice
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureGrokTtsSetup } from './grok-tts'
import { runGrokTts } from './run-grok-tts'
import { resolveTtsTargetInvocationVoiceId } from '../../tts-targets/multi-speaker-capability'
import { resolveTtsTargetInvocationControls } from '../../tts-targets/tts-invocation-controls'
export const collectGrokTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.grokModels) {
    const model: GrokTtsModel = validateGrokTtsModel(rawModel)
    const voiceId = selection.grokVoiceId ? validateGrokTtsVoice(selection.grokVoiceId) : undefined

    targets.push({
      service: 'grok',
      model,
      ...(voiceId ? { voice: voiceId } : {}),
      run: async (text, outputDir, opts, invocation, requestEvidence) => {
        const invocationVoiceId = resolveTtsTargetInvocationVoiceId('grok', invocation)
        const controls = resolveTtsTargetInvocationControls('grok', invocation, {
          language: selection.grokLanguage,
          ...(selection.grokTextNormalization ? { textNormalization: true } : {}),
        })
        await ensureGrokTtsSetup()
        return await runGrokTts(text, outputDir, {
          model,
          voiceId: invocationVoiceId ?? voiceId,
          language: controls.language,
          textNormalization: controls.textNormalization,
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
