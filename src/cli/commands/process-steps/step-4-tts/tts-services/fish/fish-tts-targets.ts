import type { FishNativeDialogueTurn, FishTtsModel, TtsOptions, TtsTarget, TtsTargetSelection } from '~/types'
import { resolveCredential } from '~/utils/validate/env-utils'
import { validateFishTtsModel, validateFishTtsVoice } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { getSpeakerVoice, normalizeDialogueText, parseSpeakerVoiceMappings, resolveDialogueFormat } from '../../dialogue-normalizer'
import { resolveTtsTargetInvocationVoiceId } from '../../tts-targets/multi-speaker-capability'
import { resolveTtsTargetInvocationControls } from '../../tts-targets/tts-invocation-controls'
import { runFishNativeDialogue } from './fish-native-dialogue'
import { isFishNativeDialogueModel } from './fish-tts-request'
import { runFishTts } from './run-fish-tts'

export const resolveFishNativeDialogueTurns = (text: string, options: TtsOptions): FishNativeDialogueTurn[] => {
  const registry = parseSpeakerVoiceMappings(options.ttsSpeakers)
  const dialogue = options.ttsCanonicalTurns
    ? options.ttsCanonicalTurns.map(turn => ({ turnId: turn.turnId, speaker: turn.speaker, text: turn.text, ...(turn.delivery ? { delivery: turn.delivery } : {}) }))
    : normalizeDialogueText(text, resolveDialogueFormat(options), registry).turns.map((turn, index) => ({ turnId: `dialogue-turn-${String(index + 1).padStart(3, '0')}`, ...turn }))
  return dialogue.map(turn => ({
    turnId: turn.turnId,
    subjectKey: turn.speaker,
    speaker: turn.speaker,
    canonicalText: turn.text,
    voiceId: getSpeakerVoice(registry, turn.speaker).voice,
    ...(turn.delivery ? { delivery: typeof turn.delivery === 'string' ? turn.delivery : turn.delivery.sourceText } : {}),
  }))
}

export const collectFishTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.fishModels) {
    const model: FishTtsModel = validateFishTtsModel(rawModel)
    const voiceId = selection.fishVoiceId ? validateFishTtsVoice(selection.fishVoiceId) : undefined

    const target: TtsTarget = {
      service: 'fish',
      model,
      voice: voiceId ?? '7f92f8afb8ec43bf81429cc1c9199cb1',
      ...(isFishNativeDialogueModel(model) ? { multiSpeakerStrategy: 'native' as const } : {}),
      run: async (text, outputDir, opts, invocation, requestEvidence) => {
        const invocationVoiceId = resolveTtsTargetInvocationVoiceId('fish', invocation)
        const controls = resolveTtsTargetInvocationControls('fish', invocation, {})
        const apiKey = resolveCredential('fish', 'require', { stage: 'tts:fish', description: 'Fish Audio TTS' })
        if (!invocation && isFishNativeDialogueModel(model) && opts.ttsSpeakers?.length) {
          return await runFishNativeDialogue(resolveFishNativeDialogueTurns(text, opts), outputDir, {
            model,
            apiKey,
            latency: controls.latency as 'normal' | 'balanced' | undefined,
            chunkScheduler: opts.hostedTtsChunkScheduler,
            requestEvidence,
          })
        }
        return await runFishTts(text, outputDir, {
          model,
          apiKey,
          voiceId: invocationVoiceId ?? voiceId,
          latency: controls.latency as 'normal' | 'balanced' | undefined,
          abortSignal: invocation?.signal,
          chunkConcurrency: opts.ttsChunkConcurrency,
          chunkScheduler: opts.hostedTtsChunkScheduler,
          requestEvidence,
        })
      }
    }
    targets.push(target)
  }
  return targets
}
