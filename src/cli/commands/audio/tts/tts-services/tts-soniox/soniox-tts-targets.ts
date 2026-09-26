import type { TtsTarget, TtsTargetSelection } from '~/types'
import { validateSonioxTtsModel, validateSonioxTtsVoice } from '~/cli/commands/setup-and-utilities/models/tts-models'
import { resolveTtsTargetInvocationControls } from '../../tts-targets/tts-invocation-controls'
import { resolveTtsTargetInvocationVoiceId } from '../../tts-targets/multi-speaker-capability'
import { sonioxTtsRequestControls } from './soniox-tts-request'
import { runSonioxTts } from './run-soniox-tts'

export const collectSonioxTtsTargets = (selection: TtsTargetSelection): TtsTarget[] => (selection.sonioxModels ?? []).map(rawModel => {
  const model = validateSonioxTtsModel(rawModel)
  const voice = validateSonioxTtsVoice(selection.sonioxVoiceId ?? 'Adrian')
  const defaults = sonioxTtsRequestControls(selection.sonioxLanguage, selection.sonioxSpeed)
  return {
    service: 'soniox', model, voice, chunkCharacterLimit: 500, numericSpeed: defaults.speed,
    run: async (text, outputDir, opts, invocation, requestEvidence) => {
      const voiceId = resolveTtsTargetInvocationVoiceId('soniox', invocation) ?? voice
      const controls = resolveTtsTargetInvocationControls('soniox', invocation, { language: defaults.language, speed: defaults.speed })
      return runSonioxTts(text, outputDir, {
        model, voiceId, language: controls.language, speed: controls.speed,
        chunkScheduler: opts.hostedTtsChunkScheduler, chunking: opts.ttsChunking,
        abortSignal: invocation?.signal, requestEvidence,
      })
    },
  }
})
