import type { ElevenlabsTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import { validateElevenlabsTtsModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureElevenLabsTtsSetup } from './elevenlabs-tts'
import { runElevenLabsTts } from './run-elevenlabs-tts'
import { resolveTtsTargetInvocationVoiceId } from '../../tts-targets/multi-speaker-capability'
import { resolveTtsTargetInvocationControls } from '../../tts-targets/tts-invocation-controls'
import { getSpeakerVoice, normalizeDialogueText, parseSpeakerVoiceMappings, resolveDialogueFormat } from '../../dialogue-normalizer'
import { runElevenLabsNativeDialogue } from './elevenlabs-native-dialogue'
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
        })
        await ensureElevenLabsTtsSetup()
        invocation?.signal?.throwIfAborted()
        if (!invocation && model === 'eleven_v3' && opts.ttsSpeakers?.length) {
          const registry = parseSpeakerVoiceMappings(opts.ttsSpeakers)
          const dialogue = opts.ttsCanonicalTurns
            ? opts.ttsCanonicalTurns.map(turn => ({ turnId: turn.turnId, speaker: turn.speaker, text: turn.text }))
            : normalizeDialogueText(text, resolveDialogueFormat(opts), registry).turns.map((turn, index) => ({ turnId: `dialogue-turn-${String(index + 1).padStart(3, '0')}`, ...turn }))
          return await runElevenLabsNativeDialogue(dialogue.map(turn => ({
            turnId: turn.turnId,
            subjectKey: turn.speaker,
            speaker: turn.speaker,
            canonicalText: turn.text,
            voiceId: getSpeakerVoice(registry, turn.speaker).voice
          })), outputDir, {
            model,
            controls: {
              outputFormat: controls.outputFormat,
              languageCode: controls.languageCode,
              seed: controls.seed,
              textNormalization: controls.textNormalization
            },
            chunkScheduler: opts.hostedTtsChunkScheduler,
            requestEvidence
          })
        }
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
              : undefined
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
