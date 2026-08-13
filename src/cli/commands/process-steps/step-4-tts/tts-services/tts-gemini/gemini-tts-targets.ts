import type { GeminiTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import { validateGeminiTtsModel, validateGeminiTtsVoice } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureGeminiTtsSetup } from './gemini-tts'
import { runGeminiTts } from './run-gemini-tts'
import { formatSpeakerRegistrySummary } from './gemini-tts-config'
import { resolveTtsTargetInvocationVoiceId } from '../../tts-targets/multi-speaker-capability'
import { resolveTtsTargetInvocationControls } from '../../tts-targets/tts-invocation-controls'
export const collectGeminiTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.geminiModels) {
    const model: GeminiTtsModel = validateGeminiTtsModel(rawModel)
    const voiceId = selection.geminiVoiceId
      ? validateGeminiTtsVoice(selection.geminiVoiceId)
      : undefined
    const registry = selection.speakerVoiceRegistry
    for (const entry of registry?.entries ?? []) {
      validateGeminiTtsVoice(entry.voice)
    }
    const speaker = registry
      ? formatSpeakerRegistrySummary(registry)
      : voiceId

    targets.push({
      service: 'gemini',
      model,
      ...(speaker ? { voice: speaker } : {}),
      run: async (text, outputDir, opts, invocation, requestEvidence) => {
        const invocationVoiceId = resolveTtsTargetInvocationVoiceId('gemini', invocation)
        const controls = resolveTtsTargetInvocationControls('gemini', invocation, {})
        await ensureGeminiTtsSetup()
        return await runGeminiTts(text, outputDir, {
          model,
          voiceId: invocationVoiceId ?? voiceId,
          speakerVoiceRegistry: invocation ? undefined : registry,
          languageCode: controls.languageCode,
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
