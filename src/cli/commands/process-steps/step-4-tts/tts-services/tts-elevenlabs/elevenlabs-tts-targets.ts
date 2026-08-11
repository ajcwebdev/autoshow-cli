import type { ElevenlabsTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import { validateElevenlabsTtsModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureElevenLabsTtsSetup } from './elevenlabs-tts'
import { runElevenLabsTts } from './run-elevenlabs-tts'
import { resolveTtsTargetInvocationVoiceId } from '../../tts-targets/multi-speaker-capability'
import { resolveTtsTargetInvocationControls } from '../../tts-targets/tts-invocation-controls'
export const collectElevenLabsTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []

  for (const rawModel of selection.elevenlabsModels) {
    const model: ElevenlabsTtsModel = validateElevenlabsTtsModel(rawModel)
    const voiceId = selection.elevenLabsVoiceId

    targets.push({
      service: 'elevenlabs',
      model,
      ...(voiceId ? { voice: voiceId } : {}),
      run: async (text, outputDir, opts, invocation, requestEvidence) => {
        invocation?.signal?.throwIfAborted()
        const invocationVoiceId = resolveTtsTargetInvocationVoiceId('elevenlabs', invocation)
        const controls = resolveTtsTargetInvocationControls('elevenlabs', invocation, {
          outputFormat: selection.elevenLabsOutputFormat,
          languageCode: selection.elevenLabsLanguageCode,
          stability: selection.elevenLabsStability,
          similarityBoost: selection.elevenLabsSimilarityBoost,
          style: selection.elevenLabsStyle,
          ...(selection.elevenLabsUseSpeakerBoost ? { useSpeakerBoost: true } : {}),
          speed: selection.elevenLabsSpeed,
          seed: selection.elevenLabsSeed,
          textNormalization: selection.elevenLabsTextNormalization,
          pronunciationDictionaryLocators: selection.elevenLabsPronunciationDictionaryLocators,
          optimizeStreamingLatency: selection.elevenLabsOptimizeStreamingLatency,
        })
        await ensureElevenLabsTtsSetup()
        invocation?.signal?.throwIfAborted()
        return await runElevenLabsTts(text, outputDir, {
          model,
          voiceId: invocationVoiceId ?? voiceId,
          controls: {
            outputFormat: controls.outputFormat,
            languageCode: controls.languageCode,
            voiceSettings: {
              ...(typeof controls.stability === 'number' ? { stability: controls.stability } : {}),
              ...(typeof controls.similarityBoost === 'number' ? { similarity_boost: controls.similarityBoost } : {}),
              ...(typeof controls.style === 'number' ? { style: controls.style } : {}),
              ...(typeof controls.useSpeakerBoost === 'boolean' ? { use_speaker_boost: controls.useSpeakerBoost } : {}),
              ...(typeof controls.speed === 'number' ? { speed: controls.speed } : {})
            },
            seed: controls.seed,
            textNormalization: controls.textNormalization,
            pronunciationDictionaryLocators: controls.pronunciationDictionaryLocators
              ? [...controls.pronunciationDictionaryLocators]
              : undefined,
            optimizeStreamingLatency: controls.optimizeStreamingLatency
          },
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
