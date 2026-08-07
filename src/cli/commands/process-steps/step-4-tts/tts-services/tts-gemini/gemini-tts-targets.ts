import type { GeminiTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import { validateGeminiTtsModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureGeminiTtsSetup } from './gemini-tts'
import { runGeminiTts } from './run-gemini-tts'
import { formatSpeakerRegistrySummary } from './gemini-tts-config'
export const collectGeminiTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.geminiModels) {
    const model: GeminiTtsModel = validateGeminiTtsModel(rawModel)
    const voiceId = selection.geminiVoiceId
    const registry = selection.speakerVoiceRegistry
    const speaker = registry
      ? formatSpeakerRegistrySummary(registry)
      : voiceId

    targets.push({
      service: 'gemini',
      model,
      ...(speaker ? { voice: speaker } : {}),
      run: async (text, outputDir, opts) => {
        await ensureGeminiTtsSetup()
        return await runGeminiTts(text, outputDir, {
          model,
          voiceId,
          speakerVoiceRegistry: registry,
          chunkConcurrency: opts.ttsChunkConcurrency,
          chunkScheduler: opts.hostedTtsChunkScheduler
        })
      }
    })
  }
  return targets
}
