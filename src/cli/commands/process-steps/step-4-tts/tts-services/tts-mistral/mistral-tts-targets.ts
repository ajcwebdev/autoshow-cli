import { basename } from 'node:path'
import type { MistralTtsModel, TtsOptions, TtsTarget, TtsTargetSelection } from '~/types'
import { validateMistralTtsModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { MISTRAL_DEFAULT_REF_AUDIO } from '~/cli/commands/setup-and-utilities/models/tts-models'
import { runMistralTts } from './run-mistral-tts'
import { CLIUsageError } from '~/utils/error-handler'
const trimmed = (value: string | undefined): string | undefined => value?.trim() || undefined

const resolveRuntimeMistralVoiceOptions = (
  opts: TtsOptions
): { voiceId: string | undefined, refAudioPath: string | undefined, voiceName: string | undefined } => ({
  voiceId: trimmed(opts.mistralTtsVoice),
  refAudioPath: trimmed(opts.mistralTtsRefAudio),
  voiceName: trimmed(opts.mistralTtsVoiceName)
})

export const collectMistralTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.mistralModels) {
    const model: MistralTtsModel = validateMistralTtsModel(rawModel)
    const voiceId = selection.mistralVoiceId
    const refAudioPath = selection.mistralRefAudioPath
    const voiceName = selection.mistralVoiceName
    if (voiceId && refAudioPath) {
      throw CLIUsageError('Mistral TTS requires exactly one voice source. Use either --mistral-tts-voice or --mistral-tts-ref-audio, not both.')
    }
    if (voiceName && !refAudioPath) {
      throw CLIUsageError('Mistral TTS --mistral-tts-voice-name requires --mistral-tts-ref-audio.')
    }
    if (voiceName && voiceId) {
      throw CLIUsageError('Mistral TTS saved voice creation cannot be combined with --mistral-tts-voice.')
    }

    const effectiveRefAudio = refAudioPath ?? (voiceId ? undefined : MISTRAL_DEFAULT_REF_AUDIO)

    targets.push({
      service: 'mistral',
      model,
      ...(voiceId ? { voice: voiceId } : effectiveRefAudio ? { voice: voiceName ? `saved_voice:${voiceName}` : `ref_audio:${basename(effectiveRefAudio)}` } : {}),
      run: async (text, outputDir, opts) => {
        const resolved = resolveRuntimeMistralVoiceOptions(opts)
        return await runMistralTts(text, outputDir, {
          model,
          voiceId: resolved.voiceId,
          refAudioPath: resolved.refAudioPath ?? (resolved.voiceId ? undefined : MISTRAL_DEFAULT_REF_AUDIO),
          voiceName: resolved.voiceName,
          chunkConcurrency: opts.ttsChunkConcurrency,
          chunkScheduler: opts.hostedTtsChunkScheduler
        })
      }
    })
  }
  return targets
}
