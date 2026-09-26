import type { TtsTarget, TtsTargetSelection } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { validateGeminiTtsModel } from '~/cli/commands/setup-and-utilities/models/tts-models'
import { resolveTtsTargetInvocationControls } from '../../tts-targets/tts-invocation-controls'
import { resolveTtsTargetInvocationVoiceId } from '../../tts-targets/multi-speaker-capability'
import { validateGeminiVoice, geminiSpeechMime } from './gemini-tts-request'
import { runGeminiTts } from './run-gemini-tts'
import { getSpeakerVoice, normalizeDialogueText, parseSpeakerVoiceMappings, resolveDialogueFormat } from '../../dialogue-normalizer'

export const collectGeminiTtsTargets = (selection: TtsTargetSelection): TtsTarget[] => selection.geminiModels.map(rawModel => {
  const model = validateGeminiTtsModel(rawModel), voice = validateGeminiVoice(selection.geminiVoice ?? 'Kore')
  geminiSpeechMime(selection.geminiResponseFormat, selection.geminiMode === 'stream')
  return {
    service: 'gemini', model, voice, transport: `gemini-${selection.geminiMode ?? 'unary'}`,
    run: async (text, outputDir, opts, invocation, requestEvidence) => {
      if (invocation?.voice.kind === 'ref-audio') throw UsageError('Gemini reference-audio synthesis is unsupported; use voice clone with recorded consent.')
      opts = { ...opts, geminiTtsMode: selection.geminiMode ?? 'unary' }
      const controls = resolveTtsTargetInvocationControls('gemini', invocation, { instructions: selection.geminiInstructions, responseFormat: selection.geminiResponseFormat })
      if (!invocation && opts.ttsSpeakers?.length) {
        const registry = parseSpeakerVoiceMappings(opts.ttsSpeakers)
        const dialogue = opts.ttsCanonicalTurns ?? normalizeDialogueText(text, resolveDialogueFormat(opts), registry).turns.map((turn, index) => ({ ...turn, turnId: `dialogue-turn-${String(index + 1).padStart(3, '0')}`, delivery: undefined }))
        let nativeFormat: string | undefined
        const turns = dialogue.map((turn, index) => {
          const effective = resolveTtsTargetInvocationControls('gemini', { sourceId: turn.turnId, sourceIndex: 0, speaker: turn.speaker, voice: { kind: 'id', value: getSpeakerVoice(registry, turn.speaker).voice }, controls: opts.ttsTurnControls?.[turn.turnId]?.gemini ?? {} }, { ...controls, instructions: turn.delivery ?? controls.instructions })
          if (index === 0) nativeFormat = effective.responseFormat
          return { text: turn.text, speaker: turn.speaker, voice: getSpeakerVoice(registry, turn.speaker).voice, style: effective.instructions }
        })
        return runGeminiTts(text, outputDir, { ...opts, model, voice, ...controls, responseFormat: nativeFormat, turns, requestEvidence })
      }
      const delivery = opts.ttsCanonicalTurns?.find(turn => turn.turnId === invocation?.sourceId)?.delivery
      const effective = resolveTtsTargetInvocationControls('gemini', invocation, { instructions: delivery ?? selection.geminiInstructions, responseFormat: selection.geminiResponseFormat })
      return runGeminiTts(text, outputDir, { ...opts, model, voice: resolveTtsTargetInvocationVoiceId('gemini', invocation) ?? voice, ...effective, invocation, requestEvidence })
    },
  }
})
