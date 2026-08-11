import type { TtsOptions } from '~/types'
import { resolveGeminiDialogueStrategy, validateGeminiMultiSpeakerTranscriptFromRegistry } from '../tts-services/tts-gemini/gemini-tts-config'
import { isMultiSpeakerRequested, normalizeDialogueText, parseSpeakerVoiceMappings, resolveDialogueFormat } from '../dialogue-normalizer'

export const validateTtsInput = (text: string, options: TtsOptions): void => {
  if (!isMultiSpeakerRequested(options)) {
    return
  }

  const registry = parseSpeakerVoiceMappings(options.ttsSpeakers)
  const dialogue = normalizeDialogueText(text, resolveDialogueFormat(options), registry)

  const geminiModels = options.geminiTtsModels ?? (options.geminiTtsModel ? [options.geminiTtsModel] : [])
  if (
    geminiModels.length > 0
    && resolveGeminiDialogueStrategy(registry.entries.length, 'auto') === 'native'
  ) {
    validateGeminiMultiSpeakerTranscriptFromRegistry(dialogue.normalizedText, registry)
  }
}
