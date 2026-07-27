import type { OpenAITtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import { validateOpenAITtsModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureOpenAITtsSetup } from './openai-tts'
import { runOpenAITts } from './run-openai-tts'

export const collectOpenAITtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []

  for (const rawModel of selection.openaiModels) {
    const model: OpenAITtsModel = validateOpenAITtsModel(rawModel)
    const voiceId = selection.openaiVoiceId

    targets.push({
      service: 'openai',
      model,
      ...(voiceId ? { voice: voiceId } : {}),
      run: async (text, outputDir, opts) => {
        await ensureOpenAITtsSetup()
        return await runOpenAITts(text, outputDir, {
          model,
          voiceId,
          instructions: selection.openaiInstructions,
          speed: selection.openaiSpeed,
          chunkConcurrency: opts.ttsChunkConcurrency,
          chunkScheduler: opts.hostedTtsChunkScheduler
        })
      }
    })
  }

  return targets
}
