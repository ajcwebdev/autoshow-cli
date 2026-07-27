import type { GeminiTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import { validateGeminiTtsModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureGeminiTtsSetup } from './gemini-tts'
import { runGeminiTts } from './run-gemini-tts'
import { formatGeminiSpeakerSummary, formatSpeakerRegistrySummary } from './gemini-tts-config'
export const collectGeminiTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.geminiModels) {
    const model: GeminiTtsModel = validateGeminiTtsModel(rawModel)
    const voiceId = selection.geminiVoiceId
    const registry = selection.speakerVoiceRegistry
    const multiSpeakerConfig = selection.geminiMultiSpeakerConfig
    const speaker = registry
      ? formatSpeakerRegistrySummary(registry)
      : multiSpeakerConfig
        ? formatGeminiSpeakerSummary(multiSpeakerConfig)
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
          multiSpeakerConfig,
          speakerVoiceRegistry: registry,
          chunkConcurrency: opts.ttsChunkConcurrency,
          chunkScheduler: opts.hostedTtsChunkScheduler
        })
      }
    })
  }
  return targets
}
