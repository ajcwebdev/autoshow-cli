import type { SpeechifyTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import {
  validateSpeechifyTtsModel,
  SPEECHIFY_DEFAULT_TTS_VOICE,
  validateSpeechifyTtsLanguageForModel,
  validateSpeechifyTtsVoiceForModel
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureSpeechifyTtsSetup } from './speechify-tts'
import { runSpeechifyTts } from './run-speechify-tts'
import { resolveTtsTargetInvocationVoiceId } from '../../tts-targets/multi-speaker-capability'
import { resolveTtsTargetInvocationControls } from '../../tts-targets/tts-invocation-controls'
export const collectSpeechifyTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []

  for (const rawModel of selection.speechifyModels) {
    const model: SpeechifyTtsModel = validateSpeechifyTtsModel(rawModel)
    const voiceId = validateSpeechifyTtsVoiceForModel(model, selection.speechifyVoiceId ?? SPEECHIFY_DEFAULT_TTS_VOICE)
    const language = validateSpeechifyTtsLanguageForModel(model, selection.speechifyLanguage)
    targets.push({
      service: 'speechify',
      model,
      voice: voiceId,
      run: async (text, outputDir, opts, invocation, requestEvidence) => {
        invocation?.signal?.throwIfAborted()
        const invocationVoiceId = resolveTtsTargetInvocationVoiceId('speechify', invocation)
        const controls = resolveTtsTargetInvocationControls('speechify', invocation, {
          audioFormat: selection.speechifyAudioFormat,
          language,
        })
        const invocationLanguage = validateSpeechifyTtsLanguageForModel(model, controls.language)
        await ensureSpeechifyTtsSetup()
        invocation?.signal?.throwIfAborted()
        return await runSpeechifyTts(text, outputDir, {
          model,
          voiceId: invocationVoiceId ?? voiceId,
          audioFormat: controls.audioFormat,
          language: invocationLanguage,
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
