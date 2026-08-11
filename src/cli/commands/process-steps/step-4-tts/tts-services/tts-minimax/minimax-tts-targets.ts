import type { MinimaxTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import { validateMinimaxTtsModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { runMinimaxTts } from './run-minimax-tts'
import { resolveTtsTargetInvocationVoiceId } from '../../tts-targets/multi-speaker-capability'
import { resolveTtsTargetInvocationControls } from '../../tts-targets/tts-invocation-controls'
export const collectMinimaxTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []

  for (const rawModel of selection.minimaxModels) {
    const model: MinimaxTtsModel = validateMinimaxTtsModel(rawModel)
    const voiceId = selection.minimaxVoiceId

    targets.push({
      service: 'minimax',
      model,
      ...(voiceId ? { voice: voiceId } : {}),
      run: async (text, outputDir, opts, invocation, requestEvidence) => {
        const invocationVoiceId = resolveTtsTargetInvocationVoiceId('minimax', invocation)
        const controls = resolveTtsTargetInvocationControls('minimax', invocation, {
          languageBoost: selection.minimaxLanguageBoost,
          speed: selection.minimaxSpeed,
          volume: selection.minimaxVolume,
          pitch: selection.minimaxPitch,
          emotion: selection.minimaxEmotion,
          ...(selection.minimaxEnglishNormalization ? { englishNormalization: true } : {}),
          pronunciations: selection.minimaxPronunciations,
        })
        return await runMinimaxTts(text, outputDir, {
          model,
          voiceId: invocationVoiceId ?? voiceId,
          languageBoost: controls.languageBoost,
          speed: controls.speed,
          volume: controls.volume,
          pitch: controls.pitch,
          emotion: controls.emotion,
          englishNormalization: controls.englishNormalization,
          pronunciations: controls.pronunciations ? [...controls.pronunciations] : undefined,
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
