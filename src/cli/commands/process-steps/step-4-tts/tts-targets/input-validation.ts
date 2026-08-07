import type { TtsOptions } from '~/types'
import { validateGeminiMultiSpeakerTranscriptFromRegistry } from '../tts-services/tts-gemini/gemini-tts-config'
import { isMultiSpeakerRequested, parseSpeakerVoiceMappings } from '../dialogue-normalizer'

export const validateTtsInput = (text: string, options: TtsOptions): void => {
  const geminiModels = options.geminiTtsModels ?? (options.geminiTtsModel ? [options.geminiTtsModel] : [])
  if (geminiModels.length === 0) {
    return
  }

  if (isMultiSpeakerRequested(options) && (options.ttsSpeakers?.length ?? 0) > 0) {
    const registry = parseSpeakerVoiceMappings(options.ttsSpeakers)
    validateGeminiMultiSpeakerTranscriptFromRegistry(text, registry)
  }
}
