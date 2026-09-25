import type { TtsOptions, TtsTargetSelection } from '~/types'
import { isMultiSpeakerRequested, parseSpeakerVoiceMappings } from '../dialogue-normalizer'
const trimmed = (value: string | undefined): string | undefined => value?.trim() || undefined

export const createTtsTargetSelection = (options: TtsOptions): TtsTargetSelection => {
  const elevenLabsPronunciationDictionaryLocators = options.elevenlabsTtsPronunciationDictionaryLocators?.map((item) => item.trim()).filter(Boolean)

  const multiSpeaker = isMultiSpeakerRequested(options)
  const speakerVoiceRegistry = multiSpeaker
    ? parseSpeakerVoiceMappings(options.ttsSpeakers)
    : undefined

  return {
    geminiModels: options.geminiTtsModels ?? [],
    geminiVoice: trimmed(options.geminiTtsVoice),
    geminiInstructions: options.geminiTtsInstructions,
    geminiResponseFormat: options.geminiTtsResponseFormat,
    geminiMode: options.geminiTtsMode,
    geminiBatchWaitSeconds: options.geminiTtsBatchWaitSeconds,
    elevenlabsModels: options.elevenlabsTtsModels ?? [],
    sonioxModels: options.sonioxTtsModels ?? [],
    sonioxVoiceId: options.sonioxTtsVoice,
    sonioxLanguage: options.sonioxTtsLanguage,
    sonioxSpeed: options.sonioxTtsSpeed,
    grokModels: options.grokTtsModels ?? [],
    mistralModels: options.mistralTtsModels ?? [],
    openaiModels: options.openaiTtsModels ?? [],
    inworldModels: options.inworldTtsModels ?? [],
    speakerVoiceRegistry,
    multiSpeakerRequested: multiSpeaker,
    openaiVoiceId: trimmed(options.openaiVoiceId),
    openaiInstructions: trimmed(options.openaiTtsInstructions),
    openaiSpeed: options.openaiTtsSpeed,
    elevenLabsVoiceId: trimmed(options.elevenlabsVoiceId),
    elevenLabsLanguageCode: trimmed(options.elevenlabsTtsLanguageCode),
    elevenLabsStability: options.elevenlabsTtsStability,
    elevenLabsSimilarityBoost: options.elevenlabsTtsSimilarityBoost,
    elevenLabsStyle: options.elevenlabsTtsStyle,
    elevenLabsUseSpeakerBoost: options.elevenlabsTtsUseSpeakerBoost === true,
    elevenLabsSpeed: options.elevenlabsTtsSpeed,
    elevenLabsSeed: options.elevenlabsTtsSeed,
    elevenLabsTextNormalization: trimmed(options.elevenlabsTtsTextNormalization),
    elevenLabsPronunciationDictionaryLocators,
    inworldVoiceId: trimmed(options.inworldTtsVoice),
    inworldInstructions: trimmed(options.inworldTtsInstructions),
    inworldSpeed: options.inworldTtsSpeed,
    grokVoiceId: trimmed(options.grokTtsVoice),
    grokSpeed: options.grokTtsSpeed,
    grokLanguage: trimmed(options.grokTtsLanguage),
    grokTextNormalization: options.grokTtsTextNormalization === true,
    mistralVoiceId: trimmed(options.mistralTtsVoice),
    mistralResponseFormat: trimmed(options.mistralTtsResponseFormat),
    elevenLabsResponseFormat: trimmed(options.elevenlabsTtsResponseFormat),
    dialogueRequested: multiSpeaker
  }
}
