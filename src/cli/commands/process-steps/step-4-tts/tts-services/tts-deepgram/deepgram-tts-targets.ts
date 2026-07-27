import type { DeepgramTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import {
  validateDeepgramTtsModel,
  validateDeepgramTtsVoice
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureDeepgramTtsSetup } from './deepgram-tts'
import { runDeepgramTts } from './run-deepgram-tts'
export const collectDeepgramTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.deepgramModels) {
    const model: DeepgramTtsModel = validateDeepgramTtsModel(rawModel)
    const voiceId = selection.deepgramVoiceId
      ? validateDeepgramTtsVoice(selection.deepgramVoiceId)
      : undefined

    targets.push({
      service: 'deepgram',
      model,
      ...(voiceId ? { voice: voiceId } : {}),
      run: async (text, outputDir, opts) => {
        await ensureDeepgramTtsSetup()
        return await runDeepgramTts(text, outputDir, {
          model,
          voiceId,
          encoding: selection.deepgramEncoding,
          container: selection.deepgramContainer,
          bitRate: selection.deepgramBitRate,
          sampleRate: selection.deepgramSampleRate,
          speed: selection.deepgramSpeed,
          chunkConcurrency: opts.ttsChunkConcurrency,
          chunkScheduler: opts.hostedTtsChunkScheduler
        })
      }
    })
  }
  return targets
}
