import type { HumeTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import {
  validateHumeTtsModel,
  validateHumeTtsVoice
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { runHumeTts } from './run-hume-tts'
import { resolveTtsTargetInvocationVoiceId } from '../../tts-targets/multi-speaker-capability'
import { resolveTtsTargetInvocationControls } from '../../tts-targets/tts-invocation-controls'
import { getSpeakerVoice, normalizeDialogueText, parseSpeakerVoiceMappings, resolveDialogueFormat } from '../../dialogue-normalizer'
import { normalizeTtsTurnControls, resolveTtsTurnControlOverrides } from '../../tts-targets/tts-invocation-controls'
import { runHumeNativeUtterances } from './hume-native-utterances'

export const collectHumeTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.humeModels) {
    const model: HumeTtsModel = validateHumeTtsModel(rawModel)
    const voice = selection.humeVoice ? validateHumeTtsVoice(selection.humeVoice) : undefined

    targets.push({
      service: 'hume',
      model,
      ...(voice ? { voice } : {}),
      run: async (text, outputDir, opts, invocation, requestEvidence) => {
        const invocationVoice = resolveTtsTargetInvocationVoiceId('hume', invocation)
        const controls = resolveTtsTargetInvocationControls('hume', invocation, {
          speed: selection.humeSpeed,
          trailingSilence: selection.humeTrailingSilence,
          description: selection.humeDescription,
          responseFormat: selection.humeResponseFormat as 'mp3' | 'wav' | undefined
        })
        if (!invocation && model === 'octave-2' && opts.ttsSpeakers?.length) {
          const registry = parseSpeakerVoiceMappings(opts.ttsSpeakers)
          const dialogue = opts.ttsCanonicalTurns
            ? opts.ttsCanonicalTurns.map(turn => ({ turnId: turn.turnId, speaker: turn.speaker, text: turn.text }))
            : normalizeDialogueText(text, resolveDialogueFormat(opts), registry).turns.map((turn, index) => ({ turnId: `dialogue-turn-${String(index + 1).padStart(3, '0')}`, ...turn }))
          const turnControls = normalizeTtsTurnControls(opts.ttsTurnControls, dialogue.map(turn => turn.turnId))
          return await runHumeNativeUtterances(dialogue.map(turn => {
            const overrides = resolveTtsTurnControlOverrides('hume', turn.turnId, turnControls)
            const speed = overrides['speed'] === null ? undefined : overrides['speed'] ?? selection.humeSpeed
            return {
              turnId: turn.turnId,
              subjectKey: turn.speaker,
              speaker: turn.speaker,
              canonicalText: turn.text,
              voiceId: getSpeakerVoice(registry, turn.speaker).voice,
              ...(typeof speed === 'number' ? { speed } : {}),
              ...(typeof overrides['trailingSilence'] === 'number' ? { trailingSilence: overrides['trailingSilence'] } : {})
            }
          }), outputDir, {
            model,
            chunkScheduler: opts.hostedTtsChunkScheduler,
            requestEvidence
          })
        }
        return await runHumeTts(text, outputDir, {
          model,
          voice: invocationVoice ?? voice,
          speed: controls.speed,
          trailingSilence: controls.trailingSilence,
          description: controls.description,
          responseFormat: controls.responseFormat,
          chunkConcurrency: opts.ttsChunkConcurrency,
          chunkScheduler: opts.hostedTtsChunkScheduler,
          chunking: opts.ttsChunking,
          abortSignal: invocation?.signal,
          requestEvidence
        })
      }
    })
  }
  return targets
}
